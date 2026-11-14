import cv2
import numpy as np
import random
import base64
import traceback
from deepface import DeepFace

FACE_DETECTOR = "retinaface"
FACE_MODEL = "Facenet"
FACE_METRIC = "cosine"
FACE_THRESHOLD = 0.4
MIN_FRAMES = 4
REQUIRED_PASS = 4

CHALLENGES = [
    {"id": "blink", "instruction": "Blink your eyes naturally 2-3 times", "icon": "👁️"},
    {"id": "turn_left", "instruction": "Slowly turn your head to the LEFT", "icon": "👈"},
    {"id": "turn_right", "instruction": "Slowly turn your head to the RIGHT", "icon": "👉"},
    {"id": "smile", "instruction": "Smile naturally for the camera", "icon": "😄"},
    {"id": "nod", "instruction": "Nod your head UP and DOWN slowly", "icon": "↕️"},
]


def _decode_frame(b64_data):
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw = base64.b64decode(b64_data)
        arr = np.frombuffer(raw, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _detect_face(frame):
    try:
        results = DeepFace.represent(
            img_path=frame,
            enforce_detection=True,
            detector_backend=FACE_DETECTOR,
            model_name=FACE_MODEL,
            distance_metric=FACE_METRIC,
            silent=True,
        )
        if results and len(results) > 0:
            return results[0]
    except Exception:
        pass
    return None


def _get_face_bbox(frame):
    try:
        faces = DeepFace.extract_faces(
            img_path=frame,
            detector_backend=FACE_DETECTOR,
            enforce_detection=True,
            silent=True,
        )
        if faces and len(faces) > 0:
            return faces[0]
    except Exception:
        pass
    return None


def _check_blink(frames):
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    ear_values = []
    brightness_ratios = []

    for f in frames:
        bbox = _get_face_bbox(f)
        if bbox is None:
            continue
        FacialArea = bbox.get("facial_area", {})
        x = FacialArea.get("x", 0)
        y = FacialArea.get("y", 0)
        w = FacialArea.get("w", 0)
        h = FacialArea.get("h", 0)
        if w <= 30 or h <= 30:
            continue
        face_roi = f[y:y + h, x:x + w]
        if face_roi.size == 0:
            continue
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(15, 15))
        if eyes is not None and len(eyes) >= 2:
            sorted_eyes = sorted(eyes, key=lambda e: e[0])
            ex1, ey1, ew1, eh1 = sorted_eyes[0]
            ex2, ey2, ew2, eh2 = sorted_eyes[1]
            ear1 = eh1 / max(ew1, 1)
            ear2 = eh2 / max(ew2, 1)
            ear_values.append((ear1 + ear2) / 2.0)

        eye_region = gray[h // 6:h // 2, w // 8:w - w // 8]
        mouth_region = gray[h * 2 // 3:h - h // 10, w // 8:w - w // 8]
        if eye_region.size > 0 and mouth_region.size > 0:
            eye_mean = float(np.mean(eye_region))
            mouth_mean = float(np.mean(mouth_region))
            if mouth_mean > 0:
                brightness_ratios.append(eye_mean / mouth_mean)

    passed = False
    score = 0.0

    if len(ear_values) >= 2:
        ear_std = float(np.std(ear_values))
        ear_min = min(ear_values)
        ear_max = max(ear_values)
        ear_swing = ear_max - ear_min
        ear_diffs = [abs(ear_values[i] - ear_values[i - 1]) for i in range(1, len(ear_values))]
        max_ear_diff = max(ear_diffs) if ear_diffs else 0
        if ear_std > 0.01 or ear_swing > 0.03 or max_ear_diff > 0.02:
            passed = True
            score = max(ear_std, ear_swing, max_ear_diff)

    if not passed and len(brightness_ratios) >= 2:
        br_std = float(np.std(brightness_ratios))
        br_min = min(brightness_ratios)
        br_max = max(brightness_ratios)
        br_swing = br_max - br_min
        br_diffs = [abs(brightness_ratios[i] - brightness_ratios[i - 1]) for i in range(1, len(brightness_ratios))]
        max_br_diff = max(br_diffs) if br_diffs else 0
        if br_std > 0.005 or br_swing > 0.015 or max_br_diff > 0.01:
            passed = True
            score = max(score, br_std, br_swing, max_br_diff)

    return passed, score


def _check_head_movement(frames):
    positions = []
    for f in frames:
        bbox = _get_face_bbox(f)
        if bbox is None:
            continue
        FacialArea = bbox.get("facial_area", {})
        x = FacialArea.get("x", 0)
        y = FacialArea.get("y", 0)
        w = FacialArea.get("w", 0)
        h = FacialArea.get("h", 0)
        if w <= 0 or h <= 0:
            continue
        cx = x + w / 2
        cy = y + h / 2
        positions.append((cx, cy))
    if len(positions) < 3:
        return False, 0.0
    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]
    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    movement = max(x_range, y_range)
    return movement > 3.0, float(movement)


def _check_texture_print(frames):
    scores = []
    for f in frames:
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        fsize = gray.shape
        if fsize[0] < 8 or fsize[1] < 8:
            continue
        fft = np.fft.fft2(gray.astype(np.float32))
        fft_shift = np.fft.fftshift(fft)
        magnitude = np.abs(fft_shift)
        h, w = fft_shift.shape
        cy, cx = h // 2, w // 2
        radius = max(5, min(h, w) // 8)
        Y, X = np.ogrid[:h, :w]
        mask = ((X - cx) ** 2 + (Y - cy) ** 2) > radius ** 2
        high_freq_energy = np.mean(magnitude[mask])
        total_energy = np.mean(magnitude)
        ratio = high_freq_energy / max(total_energy, 1e-10)
        scores.append(ratio)
    if not scores:
        return False, 0.0
    avg = np.mean(scores)
    passed = avg > 0.15
    return passed, float(avg)


def _check_brightness_flicker(frames):
    if len(frames) < 3:
        return False, 0.0
    means = []
    for f in frames:
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        means.append(float(np.mean(gray)))
    diffs = [abs(means[i] - means[i - 1]) for i in range(1, len(means))]
    max_diff = max(diffs) if diffs else 0
    mean_diff = np.mean(diffs) if diffs else 0
    has_flicker = max_diff > 12 or mean_diff > 5
    passed = not has_flicker
    return passed, float(max_diff)


def _check_motion_consistency(frames):
    diffs = []
    for i in range(1, len(frames)):
        g1 = cv2.cvtColor(frames[i - 1], cv2.COLOR_BGR2GRAY)
        g2 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
        g1 = cv2.resize(g1, (160, 120))
        g2 = cv2.resize(g2, (160, 120))
        diff = cv2.absdiff(g1, g2)
        diffs.append(float(np.mean(diff)))
    if not diffs:
        return False, 0.0
    mean_diff = np.mean(diffs)
    has_motion = mean_diff > 1.5 and mean_diff < 40
    return has_motion, float(mean_diff)


def _check_face_size_consistency(frames):
    sizes = []
    for f in frames:
        bbox = _get_face_bbox(f)
        if bbox is None:
            continue
        FacialArea = bbox.get("facial_area", {})
        w = FacialArea.get("w", 0)
        h = FacialArea.get("h", 0)
        if w > 0 and h > 0:
            sizes.append(w * h)
    if len(sizes) < 3:
        return False, 0.0
    mean_size = np.mean(sizes)
    std_size = np.std(sizes)
    cv = std_size / max(mean_size, 1)
    passed = cv < 0.4
    return passed, float(cv)


def _check_landmark_stability(frames):
    left_positions = []
    right_positions = []
    for f in frames:
        try:
            results = DeepFace.represent(
                img_path=f,
                enforce_detection=True,
                detector_backend=FACE_DETECTOR,
                model_name=FACE_MODEL,
                distance_metric=FACE_METRIC,
                silent=True,
            )
            if results and len(results) > 0:
                lm = results[0].get("facial_confidence", 0)
                if lm > 0:
                    bbox = _get_face_bbox(f)
                    if bbox:
                        fa = bbox.get("facial_area", {})
                        x = fa.get("x", 0)
                        w = fa.get("w", 0)
                        if w > 0:
                            left_positions.append(x)
                            right_positions.append(x + w)
        except Exception:
            continue
    if len(left_positions) < 3:
        return True, 0.0
    lx_std = np.std(left_positions)
    rx_std = np.std(right_positions)
    stability = max(lx_std, rx_std)
    return stability < 50, float(stability)


def verify_liveness(frames_b64, challenge_type, passive_only=False):
    active_checks = not passive_only
    required = 3 if passive_only else REQUIRED_PASS

    results = {
        "blink": False,
        "head_movement": False,
        "texture": False,
        "brightness": False,
        "motion": False,
        "face_size": False,
        "landmarks": False,
    }
    details = {}

    frames = []
    for b64 in frames_b64:
        img = _decode_frame(b64)
        if img is not None:
            frames.append(img)

    if len(frames) < MIN_FRAMES:
        return {
            "passed": False,
            "message": f"Insufficient frames for analysis ({len(frames)}/{MIN_FRAMES})",
            "checks": results,
            "details": details,
            "score": 0,
            "total_checks": len(results),
            "passed_checks": 0,
        }

    if active_checks:
        try:
            passed, val = _check_blink(frames)
            results["blink"] = passed
            details["blink"] = round(val, 4)
        except Exception as e:
            details["blink_error"] = str(e)

        try:
            passed, val = _check_head_movement(frames)
            results["head_movement"] = passed
            details["head_movement"] = round(val, 4)
        except Exception as e:
            details["head_movement_error"] = str(e)

    try:
        passed, val = _check_texture_print(frames)
        results["texture"] = passed
        details["texture"] = round(val, 4)
    except Exception as e:
        details["texture_error"] = str(e)

    try:
        passed, val = _check_brightness_flicker(frames)
        results["brightness"] = passed
        details["brightness"] = round(val, 4)
    except Exception as e:
        details["brightness_error"] = str(e)

    try:
        passed, val = _check_motion_consistency(frames)
        results["motion"] = passed
        details["motion"] = round(val, 4)
    except Exception as e:
        details["motion_error"] = str(e)

    try:
        passed, val = _check_face_size_consistency(frames)
        results["face_size"] = passed
        details["face_size"] = round(val, 4)
    except Exception as e:
        details["face_size_error"] = str(e)

    try:
        passed, val = _check_landmark_stability(frames)
        results["landmarks"] = passed
        details["landmarks"] = round(val, 4)
    except Exception as e:
        details["landmarks_error"] = str(e)

    results = {k: bool(v) for k, v in results.items()}
    details = {k: float(v) if isinstance(v, (int, float, np.floating)) else v for k, v in details.items()}
    passed_count = sum(1 for v in results.values() if v)
    overall = bool(passed_count >= required)

    return {
        "passed": overall,
        "message": "Liveness verified" if overall else "Liveness check failed — please try again",
        "checks": results,
        "details": details,
        "score": int(passed_count),
        "total_checks": int(len(results)),
        "passed_checks": int(passed_count),
    }


def get_random_challenge():
    return random.choice(CHALLENGES)
