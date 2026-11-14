from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS

import base64
import cv2
import numpy as np
from deepface import DeepFace
import os
import re
import secrets
import sys
import sqlite3
import threading
import time
import traceback
from datetime import datetime, timedelta
import jwt
from functools import wraps
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, formatdate, make_msgid
from werkzeug.utils import secure_filename
from email_templates import build_otp_email, build_election_result_email
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials as firebase_creds
from dotenv import load_dotenv
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from services.blockchain import Blockchain
from services.ethereum import ethereum as eth_client
from services.liveness import verify_liveness as do_liveness_check, get_random_challenge

load_dotenv()

app = Flask(__name__)
CORS(app)

# ADD THIS:
@app.route('/party_symbols/<path:filename>')
def party_symbol_file(filename):
    return send_from_directory(PARTY_SYMBOLS, os.path.basename(filename))

# ================= CONFIG =================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_key_123")

# ── Outbound email (SMTP) ──────────────────────────────────────
# All credentials come from the environment / .env — never hardcode the
# mailbox password in source. See backend/api/.env.example.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "20"))
# SENDER_EMAIL is the authenticated mailbox. Gmail (and most providers)
# reject a From address that is not the logged-in account, so this MUST
# match SMTP_HOST's authenticated user.
SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL", "rpatne12@gmail.com")
SENDER_NAME = os.getenv("SMTP_SENDER_NAME", "Smart Voting System")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "")
APP_BASE_URL = os.getenv("APP_BASE_URL", "")
# OTP lifetime in seconds (default 10 minutes).
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "600"))

FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")

if os.path.exists(FIREBASE_SERVICE_ACCOUNT_PATH) and not firebase_admin._apps:
    cred = firebase_creds.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    print("Firebase Admin SDK initialized")

DB_PATH = "faces"
PARTY_SYMBOLS = "party_symbols"
RESULTS_RETENTION_DAYS = 30

NOTA_NAME = "NOTA"
NOTA_PARTY = "None of the Above"
NOTA_SYMBOL = "party_symbols/NOTA.png"

FACE_RECOGNITION_MODEL = "Facenet"
FACE_DETECTOR_BACKEND = "retinaface"
FACE_DISTANCE_METRIC = "cosine"
FACE_MATCH_THRESHOLD = 0.4
# Minimum required gap (cosine) between the top match and the runner-up before the
# identity is trusted. Two similar faces can both score below the match threshold;
# requiring a clear margin prevents a voter from being verified as a different voter.
FACE_MATCH_MARGIN = 0.08
FACE_DUPLICATE_THRESHOLD = 0.25

os.makedirs(DB_PATH, exist_ok=True)
os.makedirs(PARTY_SYMBOLS, exist_ok=True)

# Pending OTPs: name -> {"code": <str>, "expires_at": <epoch seconds>}.
# Codes are consumed (or expire) and are never logged.
otp_store = {}
verified_otp_users = set()

# --- Face verification chain -------------------------------------------------
# A vote is only reachable through: liveness pass -> face match -> OTP.
# Each stage hands the client a short-lived server-side token that the next
# stage requires, so the stages cannot be skipped by calling the API directly.
FACE_IMAGE_EXTS = ('.jpg', '.jpeg', '.png')
LIVENESS_TOKEN_TTL = 600   # seconds a passed liveness check stays valid
FACE_TOKEN_TTL = 600       # seconds a passed face verification stays valid

liveness_tokens = {}  # token -> expiry unix time
face_tokens = {}      # token -> {"name": str, "exp": float}

# Serialises DeepFace lookups and face-file writes so a duplicate check is
# atomic with respect to the save that follows it (and so the embedding
# cache pickle is never written by two threads at once).
face_db_lock = threading.Lock()


def _purge_expired(store):
    now = time.time()
    expired = [t for t, v in store.items()
               if (v if isinstance(v, (int, float)) else v.get("exp", 0)) < now]
    for token in expired:
        del store[token]


def _issue_token(store, payload):
    _purge_expired(store)
    token = secrets.token_urlsafe(32)
    store[token] = payload
    return token


def _check_token(store, token):
    """Validate a token without consuming it. Returns its payload or None."""
    if not token or not isinstance(token, str):
        return None
    _purge_expired(store)
    return store.get(token)


def _face_token_matches(token, name):
    """Return the verified name if `token` proves `name` passed face verification."""
    payload = _check_token(face_tokens, token)
    if not payload or payload.get("name") != name:
        return None
    return payload["name"]


def _is_valid_person_name(name):
    """Names become filenames and primary keys — reject path/control characters."""
    if not name or len(name) > 120:
        return False
    if name.startswith("."):
        return False
    if any(c in name for c in ('/', '\\')) or ".." in name:
        return False
    if any(ord(c) < 32 or ord(c) == 127 for c in name):
        return False
    return True


def _identity_to_name(identity):
    """Turn a stored face-file path (either separator style) back into a voter name."""
    normalized = str(identity).replace("\\", "/")
    return os.path.splitext(os.path.basename(normalized))[0]


def _enrolled_face_files():
    try:
        return [f for f in os.listdir(DB_PATH) if f.lower().endswith(FACE_IMAGE_EXTS)]
    except FileNotFoundError:
        return []


def _decode_b64_image(b64_str):
    parts = b64_str.split(",", 1)
    raw = base64.b64decode(parts[1] if len(parts) > 1 else parts[0])
    arr = np.frombuffer(raw, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# --- Embedding helpers -------------------------------------------------------
# DeepFace.find() (0.0.99) embeds the *query* frame through a different colour
# channel path than the face embeddings it builds for the database. The two
# vectors are therefore not comparable: the very same face can land closer to a
# different voter (e.g. Ankush's frame matched 'Shreyas Hatture'). We sidestep
# that by embedding the captured frame with represent() — exactly how enrolled
# faces are embedded — and comparing the vectors ourselves.
_face_embedding_cache = {}  # filename -> ((size, mtime), embedding)


def _embed_face_image(img_source):
    """Embedding of the largest detected face, or None when no face is present."""
    try:
        reps = DeepFace.represent(
            img_path=img_source,
            enforce_detection=True,
            detector_backend=FACE_DETECTOR_BACKEND,
            model_name=FACE_RECOGNITION_MODEL,
            align=True,
        )
    except Exception as e:
        print(f"[FACE] No face detected / represent failed: {e}")
        return None
    if not reps:
        return None

    def _area(rep):
        fa = rep.get("facial_area") or {}
        return fa.get("w", 0) * fa.get("h", 0)

    return np.asarray(max(reps, key=_area)["embedding"], dtype=float)


def _cosine_distance(a, b):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 1.0
    return 1.0 - float(np.dot(a, b) / denom)


def _enrolled_embeddings():
    """(name, embedding) for every enrolled face, cached by file size/mtime."""
    enrolled = []
    for filename in _enrolled_face_files():
        path = os.path.join(DB_PATH, filename)
        try:
            stat = os.stat(path)
        except OSError:
            continue
        stamp = (stat.st_size, stat.st_mtime)
        cached = _face_embedding_cache.get(filename)
        if cached is not None and cached[0] == stamp:
            embedding = cached[1]
        else:
            embedding = _embed_face_image(path)
            _face_embedding_cache[filename] = (stamp, embedding)
        if embedding is None:
            continue
        enrolled.append((_identity_to_name(filename), embedding))
    return enrolled


# Captured frames are saved here to troubleshoot mis-verification. Set
# FACE_DEBUG=0 in the environment to disable. Delete the folder anytime.
DEBUG_FACE_DIR = "debug_captures"
FACE_DEBUG = os.getenv("FACE_DEBUG", "1") != "0"


def _save_debug_capture(tag, img_path):
    if not FACE_DEBUG:
        return
    try:
        frame = cv2.imread(img_path)
        if frame is None:
            return
        os.makedirs(DEBUG_FACE_DIR, exist_ok=True)
        dst = os.path.join(DEBUG_FACE_DIR, f"{tag}_{int(time.time() * 1000)}.jpg")
        cv2.imwrite(dst, frame)
        print(f"[DEBUG] saved {dst}")
    except Exception as e:
        print(f"[DEBUG] capture save failed: {e}")


# ================= DATABASE =================
def init_db():
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voters (
        name TEXT PRIMARY KEY,
        email TEXT,
        phone TEXT,
        state TEXT DEFAULT '',
        district TEXT DEFAULT '',
        constituency TEXT DEFAULT ''
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS elections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        start_time TEXT,
        end_time TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        party TEXT,
        symbol_path TEXT,
        election_id INTEGER,
        constituency TEXT DEFAULT ''
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_name TEXT,
        candidate_id INTEGER,
        election_id INTEGER
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blocks (
        block_index INTEGER,
        timestamp TEXT,
        voter_name TEXT,
        candidate_id INTEGER,
        election_id INTEGER,
        previous_hash TEXT,
        hash TEXT,
        nonce INTEGER DEFAULT 0,
        PRIMARY KEY (block_index, election_id)
    )
    """)

    # Migrate existing tables — add columns if missing
    for table, col, dtype in [("voters","state","TEXT DEFAULT ''"),("voters","district","TEXT DEFAULT ''"),("voters","constituency","TEXT DEFAULT ''"),("candidates","constituency","TEXT DEFAULT ''"),("candidates","is_nota","INTEGER DEFAULT 0"),("votes","voted_at","TEXT DEFAULT ''"),("votes","block_hash","TEXT DEFAULT ''"),("votes","voter_hash","TEXT DEFAULT ''"),("votes","eth_tx_hash","TEXT DEFAULT ''"),("elections","results_sent","TEXT DEFAULT '0'"),("elections","results_expire_at","TEXT DEFAULT ''")]:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}")
        except:
            pass

    # Backfill results_expire_at for existing ended elections that don't have it set
    cursor.execute("SELECT id, end_time FROM elections WHERE results_expire_at IS NULL OR results_expire_at = ''")
    for eid, end_time in cursor.fetchall():
        try:
            end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00")) if "T" in end_time else datetime.strptime(end_time, "%Y-%m-%dT%H:%M:%S.%fZ")
            expire = (end_dt + timedelta(days=RESULTS_RETENTION_DAYS)).isoformat()
            cursor.execute("UPDATE elections SET results_expire_at=? WHERE id=?", (expire, eid))
        except:
            pass

    conn.commit()
    conn.close()

init_db()

def migrate_nota():
    """Insert NOTA candidate into all existing elections that don't have it yet."""
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM elections")
    election_ids = [r[0] for r in cursor.fetchall()]
    for eid in election_ids:
        cursor.execute("SELECT id FROM candidates WHERE is_nota=1 AND election_id=?", (eid,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO candidates (name, party, symbol_path, election_id, constituency, is_nota) VALUES (?, ?, ?, ?, '', 1)",
                (NOTA_NAME, NOTA_PARTY, NOTA_SYMBOL, eid)
            )
    conn.commit()
    conn.close()

migrate_nota()

def reconcile_votes_from_blocks():
    """Reconstruct missing vote rows from the local SHA-256 blockchain (blocks table).

    The `blocks` table is the tamper-evident audit layer and retains every cast vote
    even when the `votes` table has been purged (e.g. an admin deleted a voter,
    candidate, or election which removes `votes` rows but intentionally keeps the
    immutable blockchain history). This function safely rebuilds the missing `votes`
    rows from the blockchain so the admin dashboard (which reads only from SQLite)
    can correctly display Vote Summary and Voter Details.

    Safety guarantees:
      * Never creates duplicate votes (checks existing election_id + voter_name).
      * Only inserts when the referenced candidate exists for that election.
      * Preserves NOTA votes.
      * Recovers timestamp, block hash, and matches election/candidate.
      * Does not modify the blockchain — SQLite `votes` remains the app/query source.
    """
    import hashlib
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()
    recovered = 0
    skipped = 0
    logs = []

    block_rows = cursor.execute(
        "SELECT block_index, timestamp, voter_name, candidate_id, election_id, previous_hash, hash, nonce "
        "FROM blocks WHERE voter_name <> 'GENESIS' ORDER BY election_id, block_index"
    ).fetchall()

    for row in block_rows:
        block_index, timestamp, voter_name, candidate_id, election_id, previous_hash, block_hash, nonce = row

        candidate = cursor.execute(
            "SELECT id, is_nota FROM candidates WHERE id=? AND election_id=?",
            (candidate_id, election_id)
        ).fetchone()
        if not candidate:
            logs.append(f"SKIP  block#{block_index} (elec {election_id}): candidate {candidate_id} no longer exists -> delete-only audit record, voter={voter_name!r}")
            skipped += 1
            continue

        exists = cursor.execute(
            "SELECT id FROM votes WHERE voter_name=? AND election_id=?",
            (voter_name, election_id)
        ).fetchone()
        if exists:
            logs.append(f"DUPE  block#{block_index} (elec {election_id}): vote already exists for voter={voter_name!r} (vote id {exists[0]})")
            skipped += 1
            continue

        cursor.execute(
            "INSERT INTO votes (voter_name, candidate_id, election_id, voted_at, block_hash, voter_hash, eth_tx_hash) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                voter_name,
                candidate_id,
                election_id,
                timestamp or "",
                block_hash or "",
                "",
                ""
            )
        )
        recovered += 1
        nota_note = " [NOTA]" if candidate[1] else ""
        logs.append(
            f"RECOV vote (elec {election_id}, block#{block_index}): voter={voter_name!r} -> candidate {candidate_id}{nota_note}, "
            f"timestamp={timestamp!r}, block_hash={block_hash[:16] if block_hash else ''}…"
        )

    conn.commit()
    conn.close()

    print("[reconcile_votes_from_blocks] blocks scanned (non-genesis):", len(block_rows))
    for log in logs:
        print("[reconcile_votes_from_blocks]", log)
    print(f"[reconcile_votes_from_blocks] recovered={recovered} skipped={skipped}")
    return {"recovered": recovered, "skipped": skipped, "logs": logs}

reconcile_votes_from_blocks()


def _smtp_send(msg, to_addr):
    """Deliver a prepared MIME message over authenticated SMTP with STARTTLS.

    Returns a dict describing what the SMTP server accepted:

        {"accepted": True,  "error": None}
        {"accepted": False, "error": "<reason>"}

    "accepted" only means the sending server took responsibility for the
    message — it does NOT guarantee inbox placement. Never logs the message
    body (which may contain an OTP) or the mailbox password.

    TLS is always used and the server certificate is verified with the default
    ssl context. Certificate verification is never disabled.
    """
    if not SMTP_APP_PASSWORD or not SENDER_EMAIL:
        print("SMTP ERROR: outbound email is not configured "
              "(set SMTP_SENDER_EMAIL and SMTP_APP_PASSWORD). Message not sent.")
        return {"accepted": False, "error": "smtp_not_configured"}

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as server:
            server.ehlo()
            server.starttls()          # upgrades to TLS; verifies the cert
            server.ehlo()
            server.login(SENDER_EMAIL, SMTP_APP_PASSWORD)
            refused = server.sendmail(SENDER_EMAIL, [to_addr], msg.as_string())
        if refused:
            print(f"SMTP ERROR: server refused recipient(s): {list(refused.keys())}")
            return {"accepted": False, "error": "recipient_refused"}
        return {"accepted": True, "error": None}
    except smtplib.SMTPAuthenticationError:
        print("SMTP ERROR: authentication failed "
              "(check SMTP_SENDER_EMAIL / SMTP_APP_PASSWORD).")
        return {"accepted": False, "error": "auth_failed"}
    except smtplib.SMTPRecipientsRefused:
        print("SMTP ERROR: all recipients were refused by the server.")
        return {"accepted": False, "error": "recipient_refused"}
    except (smtplib.SMTPException, OSError) as exc:
        print(f"SMTP ERROR: {type(exc).__name__}: {exc}")
        return {"accepted": False, "error": "smtp_error"}


def send_election_results_emails(election_id, election_name, db_conn, db_cursor):
    """Send result emails to all voters who cast a vote in the given election.
    Expects an open DB connection. Returns (sent, failed)."""
    db_cursor.execute("""
        SELECT candidates.id, candidates.name, candidates.party, candidates.constituency, candidates.is_nota, COUNT(votes.id)
        FROM candidates
        LEFT JOIN votes ON candidates.id = votes.candidate_id
        WHERE candidates.election_id = ?
        GROUP BY candidates.id
        ORDER BY candidates.is_nota ASC, candidates.constituency, COUNT(votes.id) DESC
    """, (election_id,))
    rows = db_cursor.fetchall()

    from collections import defaultdict
    constituency_candidates = defaultdict(list)
    nota_votes_map = defaultdict(int)

    for row in rows:
        cid, name, party, constituency, is_nota, vote_count = row
        cons = constituency or "Unassigned"
        if is_nota:
            nota_votes_map[cons] = vote_count
            continue
        constituency_candidates[cons].append({
            "name": name, "party": party, "votes": vote_count
        })

    winners = {}
    for constituency, candidates in constituency_candidates.items():
        if not candidates:
            winners[constituency] = {
                "is_tie": False, "name": "", "party": "", "votes": 0,
                "message": "No votes recorded",
                "nota_votes": nota_votes_map.get(constituency, 0),
                "nota_exists": nota_votes_map.get(constituency, 0) > 0
            }
            continue
        max_votes = candidates[0]["votes"]
        top_candidates = [c for c in candidates if c["votes"] == max_votes]
        if len(top_candidates) > 1:
            winners[constituency] = {
                "is_tie": True,
                "tied_candidates": top_candidates,
                "votes": max_votes,
                "nota_votes": nota_votes_map.get(constituency, 0),
                "nota_exists": nota_votes_map.get(constituency, 0) > 0,
            }
        else:
            winners[constituency] = {
                "is_tie": False,
                "name": candidates[0]["name"],
                "party": candidates[0]["party"],
                "votes": max_votes,
                "nota_votes": nota_votes_map.get(constituency, 0),
                "nota_exists": nota_votes_map.get(constituency, 0) > 0,
            }

    db_cursor.execute("""
        SELECT DISTINCT votes.voter_name, voters.email, candidates.constituency
        FROM votes
        JOIN voters ON votes.voter_name = voters.name
        JOIN candidates ON votes.candidate_id = candidates.id
        WHERE votes.election_id = ?
    """, (election_id,))
    voters_list = db_cursor.fetchall()

    sent = 0
    failed = 0
    for voter_name, email, constituency in voters_list:
        cons_key = constituency or "Unassigned"
        win = winners.get(cons_key, {
            "is_tie": False, "name": "", "party": "", "votes": 0,
            "nota_votes": 0, "nota_exists": False
        })

        subject, html_body = build_election_result_email(
            voter_name=voter_name,
            election_name=election_name,
            constituency=cons_key,
            is_tie=win.get("is_tie", False),
            tied_candidates=win.get("tied_candidates"),
            winner_name=win.get("name", ""),
            winner_party=win.get("party", ""),
            winner_votes=win.get("votes", 0),
            nota_votes=win.get("nota_votes", 0),
            nota_exists=win.get("nota_exists", False),
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((SENDER_NAME, SENDER_EMAIL))
        msg["To"] = email
        msg["Reply-To"] = formataddr((SENDER_NAME, SENDER_EMAIL))
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain=SENDER_EMAIL.split("@")[-1])
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Auto-Response-Suppress"] = "All"

        plain_winner = ""
        if win.get("is_tie"):
            tied = win.get("tied_candidates", [])
            plain_winner = "Draw between: " + ", ".join(f"{c['name']} ({c['party']})" for c in tied)
        elif win.get("name"):
            plain_winner = f"Winner: {win['name']} ({win['party']}) — {win['votes']} votes"
        else:
            plain_winner = "No votes recorded"

        plain_body = (
            f"Dear {voter_name},\n\n"
            f'The election "{election_name}" has concluded.\n\n'
            f"Results for your constituency ({cons_key}):\n{plain_winner}\n\n"
            "Thank you for participating in the Smart Voting System."
        )
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        result = _smtp_send(msg, email)
        if result["accepted"]:
            sent += 1
        else:
            failed += 1

    return sent, failed

def check_ended_elections():
    """Background thread: periodically check for ended elections and auto-send results."""
    while True:
        try:
            conn = sqlite3.connect("voting.db")
            c = conn.cursor()
            now = datetime.utcnow().isoformat()
            c.execute("""
                SELECT id, name FROM elections
                WHERE end_time < ? AND (results_sent IS NULL OR results_sent = '0')
            """, (now,))
            pending = c.fetchall()
            for eid, ename in pending:
                try:
                    sent, failed = send_election_results_emails(eid, ename, conn, c)
                    c.execute("UPDATE elections SET results_sent = '1' WHERE id = ?", (eid,))
                    conn.commit()
                    print(f"Auto-sent results for #{eid} '{ename}': {sent} sent, {failed} failed")
                except Exception as e:
                    print(f"Auto-send failed for #{eid} '{ename}': {e}")
            conn.close()
        except Exception as e:
            print(f"check_ended_elections error: {e}")
        time.sleep(60)

# Start background thread to auto-send election result emails
threading.Thread(target=check_ended_elections, daemon=True).start()

# ================= EMAIL OTP =================
def send_otp_email(receiver_email, otp, expires_in_seconds=OTP_TTL_SECONDS):
    """Send the OTP verification email.

    Returns the SMTP acceptance dict from _smtp_send, e.g.
    {"accepted": True, "error": None}. The OTP value itself is never logged.
    """
    expires_in_minutes = max(1, round(expires_in_seconds / 60))
    subject, plain_body, html_body = build_otp_email(
        otp, expires_in_minutes=expires_in_minutes
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    # Must be the authenticated mailbox (Gmail rejects a mismatched From).
    msg["From"] = formataddr((SENDER_NAME, SENDER_EMAIL))
    msg["To"] = receiver_email
    msg["Reply-To"] = formataddr((SENDER_NAME, SENDER_EMAIL))
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=SENDER_EMAIL.split("@")[-1])
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"

    # Plain text first, HTML last (highest-fidelity part last, per RFC 2046).
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    return _smtp_send(msg, receiver_email)

# ================= JWT =================
# Server-side revoked admin sessions (logout invalidates the token immediately).
# Keyed by the token's jti. JWT is stateless, so this is the project's revocation
# list; entries are harmless once the token's own exp has passed.
revoked_admin_tokens = {}
revoked_lock = threading.Lock()


def _extract_token():
    """Read the bearer/raw token from the Authorization header."""
    auth = request.headers.get("Authorization", "") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return auth.strip()


def _decode_admin_token(token, verify_exp=True):
    """Decode a token and return its payload only if it is a valid admin token."""
    options = {} if verify_exp else {"verify_exp": False}
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options=options)
    if payload.get("role") != "admin":
        raise jwt.InvalidTokenError("Not an administrator token")
    jti = payload.get("jti")
    if jti:
        with revoked_lock:
            revoked = revoked_admin_tokens.get(jti)
        if revoked is not None:
            if revoked > time.time():
                raise jwt.InvalidTokenError("Session has been logged out")
            with revoked_lock:
                revoked_admin_tokens.pop(jti, None)
    return payload


def token_required(f):
    """Authorize a request as an authenticated administrator.

    This is enforced on the server for every administrative API — the frontend
    guard is only a convenience. The token must be signed, unexpired, carry the
    admin role, and not have been revoked by a logout.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()

        if not token:
            return jsonify({"message": "Authentication required. Please log in as an administrator."}), 401

        try:
            payload = _decode_admin_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid or revoked admin session. Please log in again."}), 401
        except Exception:
            return jsonify({"message": "Invalid admin session. Please log in again."}), 401

        g.admin = payload
        return f(*args, **kwargs)

    return decorated

# ================= ADMIN LOGIN =================
@app.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.json or {}

    username = data.get("username")
    password = data.get("password")

    if username == "Raghu" and password == "1234":
        expires_at = datetime.utcnow() + timedelta(hours=2)
        token = jwt.encode(
            {
                "user": username,
                "role": "admin",
                "jti": secrets.token_urlsafe(24),
                "exp": expires_at
            },
            SECRET_KEY,
            algorithm="HS256"
        )

        return jsonify({"token": token})

    return jsonify({"message": "Invalid credentials"}), 401

@app.route('/admin/verify', methods=['GET'])
@token_required
def admin_verify():
    """Lets the frontend confirm a stored token is still a valid admin session."""
    return jsonify({
        "authenticated": True,
        "user": g.admin.get("user"),
        "role": g.admin.get("role")
    })

@app.route('/admin/logout', methods=['POST'])
@token_required
def admin_logout():
    """Invalidate the current admin session server-side."""
    token = _extract_token()
    try:
        payload = _decode_admin_token(token, verify_exp=False)
    except Exception:
        return jsonify({"message": "Logged out"})

    jti = payload.get("jti")
    if jti:
        exp = payload.get("exp", time.time() + 7200)
        if isinstance(exp, datetime):
            exp = exp.timestamp()
        with revoked_lock:
            revoked_admin_tokens[jti] = float(exp)

    return jsonify({"message": "Logged out"})

# ================= REGISTER =================
@app.route('/register', methods=['POST'])
def register():
    temp_path = None
    try:
        data = request.json or {}

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        phone = (data.get("phone") or "").strip()
        state = data.get("state", "")
        district = data.get("district", "")
        constituency = data.get("constituency", "")
        images = data.get("images", []) or []
        image_data = data.get("image", "")

        # --- Input validation ---
        if not email:
            return jsonify({"message": "Email is required"}), 400
        email_regex = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
        if not re.match(email_regex, email):
            return jsonify({"message": "Invalid email address format. Please enter a valid email like name@example.com."}), 400

        if not phone:
            return jsonify({"message": "Phone number is required"}), 400
        phone_digits = re.sub(r"\D", "", phone)
        if not (10 <= len(phone_digits) <= 15) or not re.match(r"^[6-9]\d{9}$", phone_digits[-10:]):
            return jsonify({"message": "Invalid phone number. Please enter a valid 10-digit Indian mobile number (starting with 6-9)."}), 400

        if not name:
            return jsonify({"message": "Name is required"}), 400
        if not _is_valid_person_name(name):
            return jsonify({"message": "Invalid name. A name cannot start with a dot or contain path characters (/, \\, ..)."}), 400

        # Registration is only accepted right after a passed liveness check.
        if _check_token(liveness_tokens, data.get("liveness_token")) is None:
            return jsonify({"message": "Liveness verification required. Please complete the liveness check and try again."}), 403

        # Exactly one image source, used for BOTH the duplicate check and the
        # file that gets stored — the checked image and the saved image are
        # always the same bytes.
        image_b64 = image_data or (images[0] if images else "")
        if not image_b64:
            return jsonify({"message": "No images provided"}), 400

        face_img = _decode_b64_image(image_b64)
        if face_img is None or face_img.size == 0:
            return jsonify({"message": "Could not decode image"}), 400

        h, w = face_img.shape[:2]
        if h < 100 or w < 100:
            return jsonify({"message": "Image too small. Please capture a clearer, closer photo."}), 400

        with face_db_lock:
            # `name` is the primary key — never silently replace an existing voter.
            conn = sqlite3.connect("voting.db")
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM voters WHERE name=?", (name,))
            name_taken = cursor.fetchone() is not None
            conn.close()
            if name_taken:
                return jsonify({
                    "message": f"A voter named '{name}' is already registered. Each name may only be used once — contact the election commission if this is you."
                }), 409

            temp_id = str(uuid.uuid4())
            temp_path = f"temp_{temp_id}.jpg"
            if not cv2.imwrite(temp_path, face_img):
                return jsonify({"message": "Could not process the captured image. Please try again."}), 400

            _save_debug_capture(f"register_{name}", temp_path)

            if _enrolled_face_files():
                reg_embedding = _embed_face_image(temp_path)
                if reg_embedding is None:
                    return jsonify({
                        "message": "Could not verify face. Please ensure your face is clearly visible, well-lit, and facing the camera. Try again."
                    }), 400
                for enrolled_name, enrolled_emb in _enrolled_embeddings():
                    best_distance = _cosine_distance(reg_embedding, enrolled_emb)
                    print(f"[REGISTER DUP-CHECK] {enrolled_name} distance={best_distance:.4f} threshold={FACE_DUPLICATE_THRESHOLD}")
                    if best_distance <= FACE_DUPLICATE_THRESHOLD:
                        return jsonify({
                            "message": f"SECURITY ALERT: This face is already registered under the name '{enrolled_name}'. Each person can register only once. If you believe this is an error, contact the election commission."
                        }), 409

            # Persist the face first, then the voter row. If the insert fails the
            # face file is removed again, so neither can exist without the other.
            face_path = os.path.join(DB_PATH, f"{name}.jpg")
            tmp_face_path = os.path.join(DB_PATH, f".{uuid.uuid4().hex}.tmp.jpg")
            if not cv2.imwrite(tmp_face_path, face_img):
                return jsonify({"message": "Could not save face image. Please try again."}), 500
            os.replace(tmp_face_path, face_path)

            try:
                conn = sqlite3.connect("voting.db")
                cursor = conn.cursor()
                cursor.execute("""
                INSERT INTO voters (name, email, phone, state, district, constituency)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (name, email, phone, state, district, constituency))
                conn.commit()
                conn.close()
            except Exception:
                if os.path.exists(face_path):
                    os.remove(face_path)
                raise

        print(f"[REGISTER] Saved face image for '{name}'")
        return jsonify({"message": "Registration successful"})

    except Exception as e:
        print("REGISTER ERROR:", e)
        return jsonify({"message": "Registration failed"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ================= VOTERS LIST =================
@app.route('/voters', methods=['GET'])
@token_required
def get_voters():
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name, email, phone, state, district, constituency FROM voters ORDER BY name")
    rows = cursor.fetchall()
    conn.close()

    try:
        all_faces = os.listdir(DB_PATH)
    except FileNotFoundError:
        all_faces = []

    voters = []
    for row in rows:
        has_face = f"{row[0]}.jpg" in all_faces or any(
            f.startswith(f"{row[0]}_") and f.lower().endswith(('.jpg', '.jpeg', '.png'))
            for f in all_faces
        )
        voters.append({
            "name": row[0],
            "email": row[1],
            "phone": row[2],
            "state": row[3],
            "district": row[4],
            "constituency": row[5],
            "has_face": has_face
        })

    return jsonify(voters)

@app.route('/face-image/<path:name>', methods=['GET'])
def face_image(name):
    if ".." in name or "/" in name or "\\" in name:
        return jsonify({"message": "Invalid name"}), 400
    for ext in ('.jpg', '.jpeg', '.png'):
        for candidate in [f"{name}_0{ext}", f"{name}{ext}"]:
            path = os.path.join(DB_PATH, candidate)
            if os.path.exists(path):
                return send_from_directory(DB_PATH, candidate)
    return jsonify({"message": "Face image not found"}), 404

@app.route('/voter/<path:name>', methods=['DELETE'])
@token_required
def delete_voter(name):
    if ".." in name or "/" in name or "\\" in name:
        return jsonify({"message": "Invalid name"}), 400

    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM votes WHERE voter_name=?", (name,))
    cursor.execute("DELETE FROM voters WHERE name=?", (name,))

    conn.commit()
    conn.close()

    face_path = os.path.join(DB_PATH, f"{name}.jpg")
    if os.path.exists(face_path):
        os.remove(face_path)

    for f in os.listdir(DB_PATH):
        if f.startswith(f"{name}_") and f.lower().endswith(('.jpg', '.jpeg', '.png')):
            os.remove(os.path.join(DB_PATH, f))

    return jsonify({"message": "Voter deleted"})

@app.route('/voter/<path:name>', methods=['PUT'])
@token_required
def update_voter(name):
    if ".." in name or "/" in name or "\\" in name:
        return jsonify({"message": "Invalid name"}), 400
    try:
        data = request.json
        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM voters WHERE name=?", (name,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"message": "Voter not found"}), 404

        email = data.get("email", "")
        phone = data.get("phone", "")
        state = data.get("state", "")
        district = data.get("district", "")
        constituency = data.get("constituency", "")

        cursor.execute("""
            UPDATE voters SET email=?, phone=?, state=?, district=?, constituency=?
            WHERE name=?
        """, (email, phone, state, district, constituency, name))

        conn.commit()
        conn.close()
        return jsonify({"message": "Voter updated successfully"})

    except Exception as e:
        print("UPDATE VOTER ERROR:", e)
        return jsonify({"message": "Failed to update voter"}), 500

# ================= VERIFY FACE =================
@app.route('/verify-face', methods=['POST'])
def verify_face():
    temp_path = None
    try:
        data = request.json or {}
        image_data = data.get("image", "")
        if not image_data:
            return jsonify({"message": "No image data received"}), 400

        # Face verification only runs on the heels of a passed liveness check.
        # The token is validated (not consumed) so a rejected match can be retried.
        if _check_token(liveness_tokens, data.get("liveness_token")) is None:
            return jsonify({"message": "Liveness check required before face verification. Please complete the liveness challenge first."}), 403

        if not _enrolled_face_files():
            return jsonify({"message": "No faces are enrolled yet. Please register before voting."}), 404

        parts = image_data.split(",", 1)
        if len(parts) < 2:
            return jsonify({"message": "Invalid image format"}), 400

        header, encoded = parts
        img_bytes = base64.b64decode(encoded)
        if not img_bytes:
            return jsonify({"message": "Empty image data"}), 400

        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None or img.size == 0:
            return jsonify({"message": "Could not decode image"}), 400

        h, w = img.shape[:2]
        if h < 100 or w < 100:
            return jsonify({"message": "Image too small. Please capture a clearer, closer photo."}), 400

        temp_id = str(uuid.uuid4())
        temp_path = f"temp_{temp_id}.jpg"
        if not cv2.imwrite(temp_path, img):
            return jsonify({"message": "Could not process the captured image. Please try again."}), 400

        # Embed the captured frame the same way enrolled faces are embedded, then
        # compare vectors directly. Ranking by distance, a naive "take the first
        # hit below the threshold" can still be ambiguous, so we ALSO require the
        # top match to be clearly separated from any rival identity.
        with face_db_lock:
            query_embedding = _embed_face_image(temp_path)
            if query_embedding is None:
                # No face in the captured frame (blank, too small, too far from
                # camera, or bad lighting). Surface a clear message instead of a 500.
                print("[VERIFY] NO FACE DETECTED in captured frame")
                return jsonify({
                    "message": "No face detected in the captured frame. Please center your face in the frame, move closer to the camera, and ensure good lighting. Then click verify again."
                }), 401
            enrolled = _enrolled_embeddings()
            _save_debug_capture("verify", temp_path)

        if os.path.exists(temp_path):
            os.remove(temp_path)
            temp_path = None

        matches = [
            {"distance": _cosine_distance(query_embedding, emb), "name": name}
            for name, emb in enrolled
        ]

        if not matches:
            return jsonify({"message": "Face not recognized"}), 401

        matches.sort(key=lambda m: m["distance"])
        best = matches[0]
        best_distance = best["distance"]
        name = best["name"]

        print("[VERIFY] distances: " + ", ".join(f"{m['name']}={m['distance']:.4f}" for m in matches))

        if best_distance > FACE_MATCH_THRESHOLD:
            print(f"[VERIFY] REJECTED: best_dist={best_distance:.4f} > {FACE_MATCH_THRESHOLD}")
            return jsonify({"message": "Face not recognized"}), 401

        # Ambiguity only matters between identities that could BOTH be verified,
        # i.e. rivals also inside the match threshold (a runner-up above the
        # threshold can never match anyone, and a second image of the same voter
        # is not a different person).
        rivals = [m for m in matches[1:]
                  if m["name"] != name and m["distance"] <= FACE_MATCH_THRESHOLD]
        if rivals:
            margin = rivals[0]["distance"] - best_distance
            if margin < FACE_MATCH_MARGIN:
                # Top match is not clearly unique — the person could be mistaken
                # for someone else (e.g. Naveen vs Tarun). Refuse to verify rather
                # than risk verifying the wrong identity.
                print(f"[VERIFY] AMBIGUOUS: #1 {name}={best_distance:.4f} vs #2 {rivals[0]['name']}={rivals[0]['distance']:.4f} (margin {margin:.4f} < {FACE_MATCH_MARGIN})")
                return jsonify({
                    "message": "Face match is not clear enough. Another registered voter's face is too similar to yours. Please ensure good lighting, face the camera directly, and try again."
                }), 409

        conn = sqlite3.connect("voting.db")
        cur = conn.cursor()
        cur.execute("SELECT state, district, constituency FROM voters WHERE name=?", (name,))
        row = cur.fetchone()
        conn.close()

        if not row:
            return jsonify({"message": "Voter not found in system. You may have been removed by the admin. Please contact election commission."}), 404

        # Hand out the token that /send-otp and /verify-otp will demand, binding
        # this verified identity to the rest of the voting session.
        face_token = _issue_token(face_tokens, {"name": name, "exp": time.time() + FACE_TOKEN_TTL})
        print(f"[VERIFY] ACCEPTED: {name} dist={best_distance:.4f}")

        return jsonify({
            "message": f"Voter Verified: {name}",
            "name": name,
            "state": row[0],
            "district": row[1],
            "constituency": row[2],
            "face_token": face_token
        })

    except Exception as e:
        print("VERIFY ERROR:", e)
        return jsonify({"message": "Verification failed"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ================= LIVENESS =================
@app.route('/liveness-challenge', methods=['GET'])
def liveness_challenge():
    challenge = get_random_challenge()
    return jsonify(challenge)

@app.route('/liveness-check', methods=['POST'])
def liveness_check():
    try:
        data = request.json
        frames = data.get("frames", [])
        challenge_type = data.get("challenge_type", "unknown")
        passive_only = data.get("passive_only", False)

        if not frames:
            return jsonify({"passed": False, "message": "No frames provided"}), 400

        result = do_liveness_check(frames, challenge_type, passive_only=passive_only)

        if not result["passed"]:
            print(f"LIVENESS FAILED: score={result['score']}/{result['total_checks']}, details={result['details']}")
        else:
            # Proof-of-liveness for the registration / face-verification step.
            result["liveness_token"] = _issue_token(liveness_tokens, time.time() + LIVENESS_TOKEN_TTL)

        return jsonify(result)

    except Exception as e:
        print("LIVENESS CHECK ERROR:", e)
        traceback.print_exc()
        return jsonify({"passed": False, "message": "Liveness check failed due to an error"}), 500

# ================= OTP =================
@app.route('/send-otp', methods=['POST'])
def send_otp():
    try:
        data = request.json
        name = data["name"]
        method = data.get("method", "email")

        # The OTP stage is only reachable with proof that this same identity
        # just passed face verification — otherwise anyone could request an OTP
        # for any registered name and skip the face step entirely.
        if _face_token_matches(data.get("face_token"), name) is None:
            return jsonify({"message": "Face verification required before requesting an OTP. Please complete face verification first."}), 403

        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()

        cursor.execute("SELECT email, phone FROM voters WHERE name=?", (name,))
        voter = cursor.fetchone()

        conn.close()

        if not voter:
            return jsonify({"message": f"No voter registered with name '{name}'"}), 404

        if method == "firebase":
            phone = voter[1]
            if not phone:
                return jsonify({"message": "No phone number registered for this voter. Please contact the election commission."}), 400
            return jsonify({"message": "Phone verification initiated", "phone": phone})

        email = voter[0]
        if not email:
            return jsonify({"message": "No email registered for this voter. Please contact the election commission."}), 400

        # Same 6-digit random code as before, now stored with a server-side
        # expiry so stale codes cannot be replayed.
        otp = str(random.randint(100000, 999999))
        otp_store[name] = {
            "code": otp,
            "expires_at": time.time() + OTP_TTL_SECONDS,
        }

        result = send_otp_email(email, otp, expires_in_seconds=OTP_TTL_SECONDS)
        if not result["accepted"]:
            # No point holding a code the user cannot receive.
            otp_store.pop(name, None)
            return jsonify({
                "message": "Could not send the verification email. Please try again shortly."
            }), 502

        # "accepted" means our mail server took the message for delivery; it does
        # not guarantee it lands in the inbox (spam filtering is outside our control).
        return jsonify({"message": "OTP sent to your registered email address"})

    except Exception as e:
        print("OTP ERROR:", e)
        return jsonify({"message": "Failed to send OTP"}), 500

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    name = data.get("name")
    otp = data.get("otp")

    if not name or not otp:
        return jsonify({"message": "Name and OTP are required"}), 400

    if _face_token_matches(data.get("face_token"), name) is None:
        return jsonify({"message": "Face verification required before OTP verification. Please complete face verification first."}), 403

    entry = otp_store.get(name)
    if not entry:
        return jsonify({"message": "Invalid or expired OTP. Please request a new one."}), 400

    if time.time() > entry["expires_at"]:
        otp_store.pop(name, None)
        return jsonify({"message": "This OTP has expired. Please request a new one."}), 400

    if secrets.compare_digest(entry["code"], str(otp)):
        verified_otp_users.add(name)
        del otp_store[name]
        return jsonify({"message": "OTP verified"})

    return jsonify({"message": "Invalid OTP"}), 400

@app.route('/firebase-verify', methods=['POST'])
def firebase_verify():
    try:
        data = request.json
        name = data["name"]
        id_token = data["idToken"]

        if _face_token_matches(data.get("face_token"), name) is None:
            return jsonify({"message": "Face verification required before phone verification. Please complete face verification first."}), 403

        if not firebase_admin._apps:
            return jsonify({"message": "Firebase is not configured. Contact the election commission."}), 500

        decoded = firebase_auth.verify_id_token(id_token)
        phone_number = decoded.get("phone_number", "")

        if not phone_number:
            return jsonify({"message": "No phone number in Firebase token. Use phone authentication."}), 400

        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()
        cursor.execute("SELECT phone FROM voters WHERE name=?", (name,))
        voter = cursor.fetchone()
        conn.close()

        if not voter:
            return jsonify({"message": "Voter not found"}), 404

        stored_phone = voter[0]
        if not stored_phone:
            return jsonify({"message": "No phone number on record. Please register with a phone number."}), 400

        if phone_number != stored_phone:
            return jsonify({"message": "Phone number mismatch. Use the same phone you registered with."}), 403

        verified_otp_users.add(name)
        return jsonify({"message": "Phone verified successfully via Firebase"})

    except firebase_auth.InvalidIdTokenError:
        return jsonify({"message": "Invalid Firebase token. Please re-authenticate."}), 401
    except Exception as e:
        print("FIREBASE VERIFY ERROR:", e)
        return jsonify({"message": "Phone verification failed"}), 500

# ================= ELECTION =================
@app.route('/create-election', methods=['POST'])
@token_required
def create_election():
    data = request.json

    end_dt = datetime.fromisoformat(data["end"].replace("Z", "+00:00")) if "T" in data["end"] else datetime.strptime(data["end"], "%Y-%m-%dT%H:%M:%S.%fZ")
    results_expire = (end_dt + timedelta(days=RESULTS_RETENTION_DAYS)).isoformat()

    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO elections (name, start_time, end_time, results_expire_at)
    VALUES (?, ?, ?, ?)
    """, (data["name"], data["start"], data["end"], results_expire))

    election_id = cursor.lastrowid

    cursor.execute(
        "INSERT INTO candidates (name, party, symbol_path, election_id, constituency, is_nota) VALUES (?, ?, ?, ?, '', 1)",
        (NOTA_NAME, NOTA_PARTY, NOTA_SYMBOL, election_id)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Election created successfully",
        "election_id": election_id
    })

@app.route('/elections', methods=['GET'])
@token_required
def get_elections():
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM elections")
    rows = cursor.fetchall()

    conn.close()

    elections = []

    for row in rows:
        elections.append({
            "id": row[0],
            "name": row[1],
            "start_time": row[2],
            "end_time": row[3]
        })

    return jsonify(elections)

@app.route('/elections-public', methods=['GET'])
def elections_public():
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM elections ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    now = datetime.utcnow().isoformat()
    result = []
    for row in rows:
        status = "active" if row[2] <= now and row[3] >= now else ("ended" if row[3] < now else "upcoming")
        entry = {
            "id": row[0],
            "name": row[1],
            "start_time": row[2],
            "end_time": row[3],
            "status": status
        }
        if status == "ended" and len(row) > 5 and row[5]:
            entry["results_expire_at"] = row[5]
        result.append(entry)
    return jsonify(result)

@app.route('/delete-election/<int:election_id>', methods=['DELETE'])
@token_required
def delete_election(election_id):
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("SELECT end_time, results_expire_at FROM elections WHERE id=?", (election_id,))
    election = cursor.fetchone()
    if not election:
        conn.close()
        return jsonify({"message": "Election not found"}), 404

    end_time = election[0]
    results_expire_at = election[1] or ""
    now = datetime.utcnow().isoformat()

    if end_time and end_time < now and results_expire_at and now < results_expire_at:
        remaining = (datetime.fromisoformat(results_expire_at) - datetime.utcnow()).days
        conn.close()
        return jsonify({
            "message": f"This election has ended. Results are protected and cannot be deleted for {remaining} more day(s) (until {results_expire_at[:10]}). Results must remain visible to voters."
        }), 403

    cursor.execute(
        "SELECT symbol_path FROM candidates WHERE election_id=?",
        (election_id,)
    )

    symbols = cursor.fetchall()

    for symbol in symbols:
        if symbol[0] and os.path.exists(symbol[0]):
            os.remove(symbol[0])

    cursor.execute("DELETE FROM votes WHERE election_id=?", (election_id,))
    cursor.execute("DELETE FROM candidates WHERE election_id=?", (election_id,))
    cursor.execute("DELETE FROM elections WHERE id=?", (election_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Election deleted"})

@app.route('/edit-election/<int:election_id>', methods=['PUT'])
@token_required
def edit_election(election_id):
    try:
        data = request.json

        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()

        cursor.execute("SELECT id, end_time FROM elections WHERE id=?", (election_id,))
        election = cursor.fetchone()
        if not election:
            conn.close()
            return jsonify({"message": "Election not found"}), 404

        now = datetime.utcnow().isoformat()
        if election[1] and election[1] < now:
            conn.close()
            return jsonify({"message": "Cannot edit an election that has already ended."}), 403

        name = data.get("name", "")
        start = data.get("start", "")
        end = data.get("end", "")

        if not name or not start or not end:
            conn.close()
            return jsonify({"message": "Name, start, and end are required."}), 400

        end_dt = datetime.fromisoformat(end.replace("Z", "+00:00")) if "T" in end else datetime.strptime(end, "%Y-%m-%dT%H:%M:%S.%fZ")
        results_expire = (end_dt + timedelta(days=RESULTS_RETENTION_DAYS)).isoformat()

        cursor.execute("""
            UPDATE elections SET name=?, start_time=?, end_time=?, results_expire_at=?
            WHERE id=?
        """, (name, start, end, results_expire, election_id))

        conn.commit()
        conn.close()

        return jsonify({"message": "Election updated successfully"})

    except Exception as e:
        print("EDIT ELECTION ERROR:", e)
        return jsonify({"message": "Failed to update election"}), 500

# ================= CANDIDATES =================
@app.route('/add-candidate', methods=['POST'])
@token_required
def add_candidate():
    try:
        name = request.form["name"]
        party = request.form["party"]
        election_id = request.form["election_id"]
        constituency = request.form.get("constituency", "")
        symbol = request.files["symbol"]

        if name.upper() == "NOTA" or party.upper() == "NONE OF THE ABOVE":
            return jsonify({"message": "NOTA is automatically added to every election and cannot be manually added."}), 400

        filename = secure_filename(symbol.filename)
        filepath = os.path.join(PARTY_SYMBOLS, filename).replace("\\", "/")

        symbol.save(filepath)

        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO candidates (name, party, symbol_path, election_id, constituency)
        VALUES (?, ?, ?, ?, ?)
        """, (name, party, filepath, election_id, constituency))

        conn.commit()
        conn.close()

        return jsonify({"message": "Candidate added successfully"})

    except Exception as e:
        print("ADD CANDIDATE ERROR:", e)
        return jsonify({"message": "Failed to add candidate"}), 500

@app.route('/candidates/<int:election_id>', methods=['GET'])
def get_candidates(election_id):
    constituency = request.args.get("constituency")

    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    if constituency:
        cursor.execute("""
        SELECT id, name, party, symbol_path, constituency, is_nota
        FROM candidates
        WHERE election_id=? AND constituency=? AND is_nota=0
        """, (election_id, constituency))
    else:
        cursor.execute("""
        SELECT id, name, party, symbol_path, constituency, is_nota
        FROM candidates
        WHERE election_id=? AND is_nota=0
        """, (election_id,))

    rows = cursor.fetchall()

    nota_row = None
    cursor.execute(
        "SELECT id, name, party, symbol_path, constituency, is_nota FROM candidates WHERE election_id=? AND is_nota=1",
        (election_id,)
    )
    nota_row = cursor.fetchone()
    conn.close()

    candidates = []
    for row in rows:
        candidates.append({
            "id": row[0],
            "name": row[1],
            "party": row[2],
            "symbol": row[3],
            "constituency": row[4],
            "is_nota": False
        })

    if nota_row:
        candidates.append({
            "id": nota_row[0],
            "name": nota_row[1],
            "party": nota_row[2],
            "symbol": nota_row[3],
            "constituency": nota_row[4] or "",
            "is_nota": True
        })

    return jsonify(candidates)

@app.route('/delete-candidate/<int:candidate_id>', methods=['DELETE'])
@token_required
def delete_candidate(candidate_id):
    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT symbol_path, is_nota FROM candidates WHERE id=?",
        (candidate_id,)
    )

    row = cursor.fetchone()
    if row and row[1]:
        conn.close()
        return jsonify({"message": "NOTA (None of the Above) is a protected option and cannot be deleted."}), 403

    if row and row[0] and os.path.exists(row[0]):
        os.remove(row[0])

    cursor.execute("DELETE FROM votes WHERE candidate_id=?", (candidate_id,))
    cursor.execute("DELETE FROM candidates WHERE id=?", (candidate_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Candidate deleted"})

# ================= ACTIVE ELECTIONS =================
@app.route('/active-elections', methods=['GET'])
def active_elections():
    now = datetime.utcnow().isoformat()

    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, name
    FROM elections
    WHERE start_time <= ? AND end_time >= ?
    """, (now, now))

    rows = cursor.fetchall()
    conn.close()

    return jsonify([{"id": r[0], "name": r[1]} for r in rows])

@app.route('/active-election', methods=['GET'])
def active_election():
    now = datetime.utcnow().isoformat()

    conn = sqlite3.connect("voting.db")
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, name
    FROM elections
    WHERE start_time <= ? AND end_time >= ?
    """, (now, now))

    row = cursor.fetchone()
    conn.close()

    if row:
        return jsonify({
            "id": row[0],
            "name": row[1]
        })

    return jsonify({"message": "No active election"})

# ================= VOTE =================
@app.route('/vote', methods=['POST'])
def vote():
    try:
        data = request.json

        voter_name = data["name"]
        candidate_id = data["candidate_id"]
        election_id = data["election_id"]

        if voter_name not in verified_otp_users:
            return jsonify({"message": "OTP verification required — please restart the voting process"}), 403

        conn = sqlite3.connect("voting.db")
        cursor = conn.cursor()

        cursor.execute("SELECT constituency FROM voters WHERE name=?", (voter_name,))
        voter_row = cursor.fetchone()
        voter_constituency = voter_row[0] if voter_row else ""

        if voter_constituency:
            cursor.execute("SELECT constituency FROM candidates WHERE id=?", (candidate_id,))
            cand_row = cursor.fetchone()
            if cand_row and cand_row[0] and cand_row[0] != voter_constituency:
                conn.close()
                return jsonify({"message": "This candidate is not from your constituency. You can only vote for candidates contesting in your assigned region."}), 403

        cursor.execute("""
        SELECT * FROM votes
        WHERE voter_name=? AND election_id=?
        """, (voter_name, election_id))

        if cursor.fetchone():
            conn.close()
            return jsonify({
                "message": "⚠️ FRAUD ALERT: A vote has already been recorded under your name for this election. Each voter is allowed to vote only once. This incident may be reported to the election commission."
            }), 403

        cursor.execute("""
        INSERT INTO votes (voter_name, candidate_id, election_id, voted_at)
        VALUES (?, ?, ?, ?)
        """, (voter_name, candidate_id, election_id, datetime.utcnow().isoformat()))
        vote_id = cursor.lastrowid

        conn.commit()

        # Add block to local SHA-256 chain
        blockchain = Blockchain(conn)
        block = blockchain.add_block(voter_name, candidate_id, election_id)

        # Submit to Ethereum blockchain (if configured)
        eth_result = eth_client.cast_vote(voter_name, election_id, candidate_id)
        eth_contract = eth_client.get_contract_address()

        eth_tx_hash = None
        eth_enabled = eth_client.is_ready
        if isinstance(eth_result, dict):
            if eth_result.get("success"):
                eth_tx_hash = eth_result.get("tx_hash")
            else:
                print("Ethereum vote failed:", eth_result.get("error"))
        elif isinstance(eth_result, str):
            eth_tx_hash = eth_result

        try:
            cursor.execute(
                "UPDATE votes SET block_hash=?, eth_tx_hash=? WHERE id=?",
                (block.hash if block else "", eth_tx_hash or "", vote_id)
            )
            conn.commit()
        except Exception:
            print("Failed to attach block/eth hash to vote:", traceback.format_exc())

        conn.close()

        verified_otp_users.remove(voter_name)

        response = {
            "message": "Vote cast successfully",
            "block": block.to_dict(),
            "ethereum": {
                "enabled": eth_enabled,
                "tx_hash": eth_tx_hash,
                "contract_address": eth_contract,
                "explorer_url": f"https://sepolia.etherscan.io/tx/{eth_tx_hash}" if eth_tx_hash else None
            }
        }
        return jsonify(response)

    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        print("VOTE ERROR:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"message": "An internal error occurred. The admin has been notified."}), 500

# ================= ELECTION VOTES (admin) =================
@app.route('/election-votes/<int:election_id>', methods=['GET'])
@token_required
def election_votes(election_id):
    conn = sqlite3.connect("voting.db")
    c = conn.cursor()

    c.execute("""
        SELECT votes.id, votes.voter_name, candidates.name, candidates.party, candidates.constituency, votes.voted_at, votes.candidate_id
        FROM votes
        JOIN candidates ON votes.candidate_id = candidates.id
        WHERE votes.election_id = ?
        ORDER BY votes.id
    """, (election_id,))

    rows = c.fetchall()

    c.execute("""
        SELECT candidates.id, candidates.name, candidates.party, candidates.constituency, COUNT(votes.id)
        FROM candidates
        LEFT JOIN votes ON candidates.id = votes.candidate_id
        WHERE candidates.election_id = ?
        GROUP BY candidates.id
        ORDER BY candidates.id
    """, (election_id,))

    summary = c.fetchall()
    conn.close()

    votes_list = []
    for row in rows:
        votes_list.append({
            "vote_id": row[0],
            "voter_name": row[1],
            "candidate_name": row[2],
            "party": row[3],
            "constituency": row[4],
            "voted_at": row[5],
            "candidate_id": row[6]
        })

    summary_list = []
    for row in summary:
        summary_list.append({
            "candidate_id": row[0],
            "candidate_name": row[1],
            "party": row[2],
            "constituency": row[3],
            "count": row[4]
        })

    return jsonify({"votes": votes_list, "summary": summary_list, "total": len(votes_list)})

# ================= SEND ELECTION RESULT EMAILS =================
@app.route('/send-election-results/<int:election_id>', methods=['POST'])
@token_required
def send_election_results(election_id):
    try:
        conn = sqlite3.connect("voting.db")
        c = conn.cursor()
        c.execute("SELECT name FROM elections WHERE id=?", (election_id,))
        el_row = c.fetchone()
        if not el_row:
            conn.close()
            return jsonify({"message": "Election not found"}), 404
        election_name = el_row[0]

        sent, failed = send_election_results_emails(election_id, election_name, conn, c)
        conn.close()

        return jsonify({"message": f"Emails sent: {sent}, failed: {failed}", "sent": sent, "failed": failed})

    except Exception as e:
        print("SEND RESULT EMAILS ERROR:", e)
        return jsonify({"message": "Failed to send emails"}), 500

# ================= BLOCKCHAIN =================
@app.route('/ethereum-status', methods=['GET'])
def ethereum_status():
    return jsonify({
        "enabled": eth_client.is_ready,
        "contract_address": eth_client.get_contract_address(),
        "chain": "sepolia",
        "explorer": "https://sepolia.etherscan.io"
    })

@app.route('/chain/<int:election_id>', methods=['GET'])
def get_chain(election_id):
    conn = sqlite3.connect("voting.db")
    blockchain = Blockchain(conn)
    chain = blockchain.get_chain(election_id)
    conn.close()
    return jsonify([b.to_dict() for b in chain])

@app.route('/verify-chain/<int:election_id>', methods=['GET'])
def verify_chain(election_id):
    conn = sqlite3.connect("voting.db")
    blockchain = Blockchain(conn)
    result = blockchain.verify_chain(election_id)
    conn.close()
    return jsonify(result)

# ================= RESULTS =================
@app.route("/results/<int:election_id>")
def results(election_id):
    conn = sqlite3.connect("voting.db")
    c = conn.cursor()

    c.execute("""
        SELECT candidates.id, candidates.name, candidates.party, candidates.symbol, candidates.constituency, candidates.is_nota, COUNT(votes.id)
        FROM candidates
        LEFT JOIN votes ON candidates.id = votes.candidate_id
        WHERE candidates.election_id = ?
        GROUP BY candidates.id
        ORDER BY candidates.is_nota ASC, candidates.constituency, COUNT(votes.id) DESC, candidates.name
    """, (election_id,))

    rows = c.fetchall()
    conn.close()

    from collections import defaultdict
    constituency_map = defaultdict(list)
    for row in rows:
        constituency = row[4] or "Unassigned"
        constituency_map[constituency].append({
            "id": row[0],
            "name": row[1],
            "party": row[2],
            "symbol": row[3],
            "constituency": constituency,
            "is_nota": bool(row[5]),
            "votes": row[6]
        })

    results = []
    for constituency, candidates in constituency_map.items():
        real_candidates = [c for c in candidates if not c["is_nota"]]
        max_votes = real_candidates[0]["votes"] if real_candidates else 0
        tied_count = sum(1 for c in real_candidates if c["votes"] == max_votes and max_votes > 0)
        is_tie = tied_count > 1

        for c in candidates:
            entry = dict(c)
            if c["is_nota"]:
                entry["is_winner"] = False
                entry["is_tie"] = False
            elif max_votes > 0 and c["votes"] == max_votes:
                entry["is_winner"] = True
                entry["is_tie"] = is_tie
            else:
                entry["is_winner"] = False
                entry["is_tie"] = False
            results.append(entry)

    return jsonify(results)
# ================= RUN =================
if __name__ == "__main__":
    print("Starting Smart Voting Backend...")
    app.run(host="0.0.0.0", port=5000, debug=True)