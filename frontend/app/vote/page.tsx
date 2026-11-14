"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

/* ══ Toast ═════════════════════════════════════════════════ */
type TT = "success" | "error" | "info" | "warning";
interface Toast { id: number; type: TT; title: string; msg: string; }
let _tid = 0, _add: ((t: Omit<Toast, "id">) => void) | null = null;
function toast(type: TT, title: string, msg = "") { _add?.({ type, title, msg }); }
function ToastBox() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    _add = (t) => { const id = ++_tid; setList(p => [...p, { ...t, id }]); setTimeout(() => setList(p => p.filter(x => x.id !== id)), 4200); };
    return () => { _add = null; };
  }, []);
  const clr: Record<TT, string> = { success: "#34d399", error: "#f87171", warning: "#fbbf24", info: "#60a5fa" };
  const ic: Record<TT, string> = { success: "✓", error: "✕", warning: "#fbbf24", info: "ℹ" };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {list.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(9,12,22,.97)", border: `1px solid ${clr[t.type]}44`, borderRadius: 14, padding: "13px 18px", minWidth: 280, maxWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,.55)", animation: "tIn .3s cubic-bezier(.34,1.56,.64,1)", pointerEvents: "auto" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: `${clr[t.type]}1a`, color: clr[t.type] }}>{ic[t.type]}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>{t.title}</div>
            {t.msg && <div style={{ fontSize: 12, color: "rgba(241,245,249,.45)", lineHeight: 1.5 }}>{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══ Types ══════════════════════════════════════════════════ */
type Candidate = { id: number; name: string; party: string; symbol: string; constituency?: string; is_nota?: boolean; };

/* ══ Step bar ═══════════════════════════════════════════════ */
const STEPS = ["Liveness Check", "Face Verify", "OTP Check", "Cast Vote"];
function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: "2.5rem" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: i < current ? "linear-gradient(135deg,#34d399,#059669)" : i === current ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,.05)", border: i >= current && i !== current ? "1.5px solid rgba(255,255,255,.1)" : "none", color: i <= current ? "#fff" : "rgba(255,255,255,.3)", boxShadow: i === current ? "0 4px 16px rgba(99,102,241,.4)" : "none", transition: "all .3s" }}>
              {i < current ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: .68 + "rem", fontWeight: 600, color: i === current ? "#a5b4fc" : i < current ? "#6ee7b7" : "rgba(148,163,184,.4)", letterSpacing: .06 + "em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{s}</div>
          </div>
          {i < STEPS.length - 1 && <div style={{ width: 64, height: 1.5, margin: "0 10px", marginBottom: 22, background: i < current ? "linear-gradient(90deg,#34d399,#059669)" : "rgba(255,255,255,.07)", transition: "background .3s" }} />}
        </div>
      ))}
    </div>
  );
}

/* ══ OTP input boxes ════════════════════════════════════════ */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useMemo(() => Array.from({ length: 6 }, () => React.createRef<HTMLInputElement>()), []);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const update = (idx: number, ch: string) => {
    if (!/^\d?$/.test(ch)) return;
    const arr = [...digits]; arr[idx] = ch;
    onChange(arr.join(""));
    if (ch && idx < 5) refs[idx + 1].current?.focus();
  };
  const onKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
  };
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "1.5rem 0" }}>
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]} maxLength={1} value={d} onChange={e => update(i, e.target.value)} onKeyDown={e => onKey(i, e)}
          style={{ width: 52, height: 60, textAlign: "center", fontSize: "1.4rem", fontWeight: 700, background: d ? "rgba(99,102,241,.14)" : "rgba(255,255,255,.04)", border: `1.5px solid ${d ? "rgba(99,102,241,.5)" : "rgba(255,255,255,.08)"}`, borderRadius: 14, color: "#f1f5f9", outline: "none", transition: "all .2s", fontFamily: "inherit", caretColor: "#818cf8" }}
        />
      ))}
    </div>
  );
}

/* ══ Main ═══════════════════════════════════════════════════ */
export default function Vote() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0); // 0=liveness, 1=face, 2=otp, 3=ballot, 4=done
  const [voterName, setVoterName] = useState("");
  const [voterConstituency, setVoterConstituency] = useState("");
  const [electionId, setElectionId] = useState<number | null>(null);
  const [electionName, setElectionName] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [votedId, setVotedId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [blockIndex, setBlockIndex] = useState<number | null>(null);
  const [ethTxHash, setEthTxHash] = useState<string | null>(null);
  const [ethExplorerUrl, setEthExplorerUrl] = useState<string | null>(null);
  const [ethEnabled, setEthEnabled] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedCand, setSelectedCand] = useState<number | null>(null);
  const [electionLoaded, setElectionLoaded] = useState(false);
  const [hasActiveElection, setHasActiveElection] = useState(false);
  const [livenessChallenge, setLivenessChallenge] = useState("");
  const [livenessChallengeId, setLivenessChallengeId] = useState("");
  const [livenessCountdown, setLivenessCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [capturingFrames, setCapturingFrames] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [livenessChecking, setLivenessChecking] = useState(false);
  const [livenessResult, setLivenessResult] = useState<"pass" | "fail" | null>(null);
  const [livenessFrames, setLivenessFrames] = useState<string[]>([]);
  const [livenessToken, setLivenessToken] = useState("");
  const [faceToken, setFaceToken] = useState("");

  const setupCamera = async () => {
    try {
      const old = videoRef.current?.srcObject as MediaStream | null;
      old?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraOn(true);
      }
    } catch {
      toast("error", "Camera denied", "Allow camera access and reload.");
    }
  };

  useEffect(() => {
    setupCamera();
  }, []);

  useEffect(() => {
    if (step === 0 || step === 1) {
      setupCamera();
    }
  }, [step]);

  useEffect(() => {
    fetch("http://localhost:5000/active-election").then(r => r.json()).then(d => {
      if (d.id) {
        setElectionId(d.id); setElectionName(d.name);
        setHasActiveElection(true);
      } else {
        toast("warning", "No active election", "Check back later or contact admin.");
        setHasActiveElection(false);
      }
      setElectionLoaded(true);
    }).catch(() => {
      toast("error", "Server error", "Cannot reach backend.");
      setElectionLoaded(true);
      setHasActiveElection(false);
    });
  }, []);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
  };

  const captureImage = (): string | null => {
    if (!videoRef.current) return null;
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) return null;
    const c = document.createElement("canvas");
    c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    const data = c.toDataURL("image/jpeg", 0.9);
    if (!data || data === "data:,") return null;
    return data;
  };

  const TARGET_FRAMES = 6;
  const FRAME_INTERVAL = 500;

  const startLivenessCheck = async () => {
    setLivenessResult(null);
    setLivenessFrames([]);
    setFrameCount(0);
    setCapturingFrames(false);
    setIsCountingDown(false);

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/liveness-challenge");
      const challenge = await res.json();
      setLivenessChallenge(challenge.instruction);
      setLivenessChallengeId(challenge.id);

      setFlash(true);
      setTimeout(() => setFlash(false), 350);
      setLivenessCountdown(3);
      setIsCountingDown(true);

      let count = 3;
      const countdownInterval = setInterval(() => {
        count--;
        setLivenessCountdown(count);
        if (count <= 0) {
          clearInterval(countdownInterval);
          setIsCountingDown(false);
          startFrameCapture(challenge.id);
        }
      }, 1000);
    } catch {
      toast("error", "Error", "Failed to get liveness challenge.");
      setLoading(false);
    }
  };

  const startFrameCapture = (challengeId: string) => {
    setCapturingFrames(true);
    setFrameCount(0);
    const frames: string[] = [];
    let count = 0;

    const captureInterval = setInterval(() => {
      const image = captureImage();
      if (image) {
        frames.push(image);
        count++;
        setFrameCount(count);
        setLivenessFrames([...frames]);
      }
      if (count >= TARGET_FRAMES) {
        clearInterval(captureInterval);
        setCapturingFrames(false);
        submitLiveness(frames, challengeId);
      }
    }, FRAME_INTERVAL);
  };

  const submitLiveness = async (frames: string[], challengeId: string) => {
    setLivenessChecking(true);
    try {
      const res = await fetch("http://localhost:5000/liveness-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, challenge_type: challengeId }),
      });
      const result = await res.json();
      if (result.passed) {
        setLivenessToken(result.liveness_token || "");
        setLivenessResult("pass");
        toast("success", "Liveness verified!", "You appear to be a real person.");
        setTimeout(() => { setStep(1); }, 1000);
      } else {
        setLivenessResult("fail");
        toast("error", "Liveness check failed", result.message || "Please try again.");
        setLivenessChallenge("");
        setLivenessChallengeId("");
      }
    } catch {
      toast("error", "Error", "Failed to verify liveness.");
      setLivenessResult("fail");
    } finally {
      setLivenessChecking(false);
      setLoading(false);
    }
  };

  /* ── Face verify ── */
  const verifyFace = async () => {
    let image = captureImage();
    if (!image && videoRef.current) {
      await new Promise(r => setTimeout(r, 300));
      image = captureImage();
    }
    if (!image) { toast("error", "Camera not ready", "Please wait for the camera to initialize and try again."); return; }
    setFlash(true); setTimeout(() => setFlash(false), 350);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/verify-face", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, liveness_token: livenessToken }) });
      const d = await res.json();
      if (d.name) {
        setFaceToken(d.face_token || "");
        setVoterName(d.name);
        setVoterConstituency(d.constituency || "");
        toast("success", "Face recognised!", `Welcome, ${d.name}`);
        setTimeout(() => { stopCamera(); setStep(2); }, 700);
      } else {
        toast("error", "Not recognised", d.message || "Face not found in database.");
      }
    } catch { toast("error", "Network error", "Cannot reach backend."); }
    finally { setLoading(false); }
  };

  /* ── Send OTP ── */
  const sendOtp = async () => {
    if (!voterName) {
      toast("error", "Face not verified", "Please complete face verification first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voterName, method: "email", face_token: faceToken }),
      });
      const d = await res.json();
      if (res.ok) {
        setOtpSent(true);
        toast("success", "OTP sent!", "Check your registered email.");
      } else if (res.status === 404) {
        toast("error", "Voter not found", `No voter registered as "${voterName}". Re-register with the exact same name.`);
      } else {
        toast("error", "Failed", d.message);
      }
    } catch (e: any) {
      toast("error", "Error", e?.message || "Cannot send OTP.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Verify OTP ── */
  const verifyOtp = async () => {
    if (otp.length < 6) { toast("warning", "Incomplete", "Enter all 6 digits."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: voterName, otp, face_token: faceToken }) });
      const d = await res.json();
      if (res.ok) { 
        toast("success", "OTP verified!", "Proceed to cast your vote.");
        if (electionId) {
          const url = voterConstituency
            ? `http://localhost:5000/candidates/${electionId}?constituency=${encodeURIComponent(voterConstituency)}`
            : `http://localhost:5000/candidates/${electionId}`;
          fetch(url).then(r => r.json()).then(c => { if (Array.isArray(c)) setCandidates(c); });
        }
        setTimeout(() => setStep(3), 500);
      }
      else { toast("error", "Wrong OTP", d.message || "Please try again."); }
    } catch (e: any) {
      toast("error", "Error", e?.message || "Verification failed.");
    }
    finally { setLoading(false); }
  };

  /* ── Cast vote ── */
  const castVote = async (cid: number) => {
    setSelectedCand(cid);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: voterName, candidate_id: cid, election_id: electionId }) });
      const d = await res.json();
      if (res.ok) {
        const block = d.block;
        const eth = d.ethereum || {};
        setTxHash(block.hash);
        setBlockIndex(block.index);
        setEthTxHash(eth.tx_hash || null);
        setEthExplorerUrl(eth.explorer_url || null);
        setEthEnabled(eth.enabled || false);
        setVotedId(cid);
        setStep(4);
        toast("success", "Vote cast!", "Your vote is recorded on the blockchain.");
      } else {
        toast("error", "Failed", d.message || "Could not cast vote.");
        setSelectedCand(null);
      }
    } catch { toast("error", "Network error"); }
    finally { setLoading(false); }
  };

  const votedCandidate = candidates.find(c => c.id === votedId);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#080c18}
        @keyframes tIn   {from{opacity:0;transform:scale(.88) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes drift {from{transform:translate(0,0)}to{transform:translate(40px,30px)}}
        @keyframes spin  {to{transform:rotate(360deg)}}
        @keyframes flash {0%{opacity:0}30%{opacity:.9}100%{opacity:0}}
        @keyframes popIn {0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
        @keyframes pdot  {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes scan  {0%,100%{top:10%}50%{top:85%}}

        .root{min-height:100vh;background:#080c18;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;padding:2.5rem 1rem 5rem;position:relative;overflow:hidden}
        .blob{position:fixed;border-radius:50%;filter:blur(100px);opacity:.09;pointer-events:none}
        .b1{width:600px;height:600px;background:radial-gradient(circle,#3b82f6,transparent);top:-200px;left:-150px;animation:drift 15s ease-in-out infinite alternate}
        .b2{width:500px;height:500px;background:radial-gradient(circle,#6366f1,transparent);bottom:-100px;right:-100px;animation:drift 19s ease-in-out infinite alternate-reverse}
        .grid-bg{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(59,130,246,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.03) 1px,transparent 1px);background-size:44px 44px}

        .page-wrap{width:100%;max-width:600px;position:relative;z-index:1;opacity:0;animation:fadeUp .45s ease .05s forwards}

        /* header */
        .page-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:100px;padding:5px 14px 5px 9px;font-size:.68rem;color:#93c5fd;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.25rem}
        .pdot{width:7px;height:7px;background:#3b82f6;border-radius:50%;box-shadow:0 0 8px #3b82f6;animation:pdot 2s ease-in-out infinite}
        .page-title{font-family:'Syne',sans-serif;font-size:2.2rem;font-weight:800;color:#f1f5f9;letter-spacing:-.03em;text-align:center;margin-bottom:.4rem}
        .page-title span{background:linear-gradient(135deg,#60a5fa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .page-sub{font-size:.88rem;color:rgba(148,163,184,.5);text-align:center;margin-bottom:2.5rem}
        .election-tag{display:inline-block;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24;border-radius:100px;padding:4px 14px;font-size:.72rem;font-weight:600;margin-bottom:2rem}

        /* card */
        .card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:22px;padding:2.25rem;backdrop-filter:blur(20px);box-shadow:0 0 0 1px rgba(59,130,246,.05),0 20px 48px rgba(0,0,0,.4);width:100%}

        /* camera */
        .cam-wrap{position:relative;border-radius:18px;overflow:hidden;border:2px solid rgba(255,255,255,.08);box-shadow:0 12px 40px rgba(0,0,0,.5);margin-bottom:1.5rem}
        .cam-wrap video{width:100%;display:block;background:#000;aspect-ratio:4/3;object-fit:cover}
        .cam-corner{position:absolute;width:24px;height:24px;border-color:#6366f1;border-style:solid;border-width:0}
        .tl{top:12px;left:12px;border-top-width:2.5px;border-left-width:2.5px;border-radius:4px 0 0 0}
        .tr{top:12px;right:12px;border-top-width:2.5px;border-right-width:2.5px;border-radius:0 4px 0 0}
        .bl{bottom:12px;left:12px;border-bottom-width:2.5px;border-left-width:2.5px;border-radius:0 0 0 4px}
        .br{bottom:12px;right:12px;border-bottom-width:2.5px;border-right-width:2.5px;border-radius:0 0 4px 0}
        .scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#6366f1,#3b82f6,transparent);animation:scan 2.5s ease-in-out infinite;opacity:.7}
        .flash-el{position:absolute;inset:0;background:#fff;pointer-events:none;opacity:0;border-radius:18px;animation:flash .35s ease forwards}

        .voter-chip{display:flex;align-items:center;gap:10px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:14px;padding:12px 16px;margin-bottom:1.5rem}
        .voter-avatar{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .voter-name{font-size:.95rem;font-weight:700;color:#f1f5f9}
        .voter-sub{font-size:.72rem;color:rgba(148,163,184,.5)}

        /* otp section */
        .otp-label{font-size:.78rem;color:rgba(148,163,184,.5);text-align:center;margin-bottom:.5rem}
        .resend-btn{background:none;border:none;color:#818cf8;font-size:.8rem;cursor:pointer;font-family:inherit;font-weight:500;text-decoration:underline;display:block;margin:.5rem auto 0}

        /* candidates grid */
        .cands-grid{display:flex;flex-direction:column;gap:.875rem}
        .cand-card{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.03);border:1.5px solid rgba(255,255,255,.07);border-radius:16px;padding:1rem 1.25rem;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
        .cand-card:hover{background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.35);transform:translateX(4px)}
        .cand-card.selected{background:rgba(99,102,241,.14);border-color:rgba(99,102,241,.5);box-shadow:0 4px 20px rgba(99,102,241,.2)}
        .cand-card.nota{border-color:rgba(239,68,68,.2);background:rgba(239,68,68,.04)}
        .cand-card.nota:hover{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35);transform:translateX(4px)}
        .cand-card.nota.selected{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.5);box-shadow:0 4px 20px rgba(239,68,68,.2)}
        .cand-sym{width:56px;height:56px;border-radius:12px;object-fit:cover;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.2);flex-shrink:0}
        .cand-sym-ph{width:56px;height:56px;border-radius:12px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
        .cand-name{font-family:'Syne',sans-serif;font-size:1rem;font-weight:700;color:#f1f5f9;margin-bottom:3px}
        .cand-party{font-size:.78rem;color:rgba(148,163,184,.5)}
        .vote-arrow{margin-left:auto;font-size:1.2rem;color:rgba(148,163,184,.25);transition:color .2s,transform .2s}
        .cand-card:hover .vote-arrow{color:#818cf8;transform:translateX(3px)}
        .cand-card.selected .vote-arrow{color:#818cf8}

        /* buttons */
        .btn{width:100%;padding:.9rem;border:none;border-radius:12px;cursor:pointer;font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,box-shadow .15s,opacity .15s;margin-top:.5rem}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .btn-green{background:linear-gradient(135deg,#16a34a,#059669);color:#fff;box-shadow:0 4px 20px rgba(22,163,74,.25)}
        .btn-green:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(22,163,74,.38)}
        .btn-blue{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 4px 20px rgba(99,102,241,.3)}
        .btn-blue:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(99,102,241,.45)}
        .btn-ghost{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8}
        .btn-ghost:hover:not(:disabled){background:rgba(255,255,255,.08)}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite}

        /* success screen */
        .success-wrap{text-align:center;animation:popIn .5s cubic-bezier(.34,1.56,.64,1)}
        .success-icon{width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 1.25rem;box-shadow:0 8px 32px rgba(52,211,153,.35)}
        .success-title{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;color:#f1f5f9;margin-bottom:.5rem}
        .success-sub{font-size:.88rem;color:rgba(148,163,184,.55);margin-bottom:1.5rem}
        .tx-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;text-align:left;margin-bottom:1.5rem}
        .tx-label{font-size:.68rem;font-weight:600;color:rgba(148,163,184,.45);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
        .tx-hash{font-size:.72rem;color:#818cf8;word-break:break-all;font-family:monospace;line-height:1.5}
        .voted-chip{display:flex;align-items:center;gap:12px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:12px 16px;margin-bottom:1.25rem}
      `}</style>

      <ToastBox />

      <div className="root">
        <div className="blob b1" /><div className="blob b2" />
        <div className="grid-bg" />

        <div className="page-wrap">
          <div style={{ textAlign: "center" }}>
            <div className="page-badge" style={{ display: "inline-flex" }}><span className="pdot" />Secure Voting</div>
            <h1 className="page-title">Cast Your <span>Vote</span></h1>
            <p className="page-sub">Complete 3 steps: face recognition → OTP → ballot</p>
            {electionName && <div className="election-tag">🗳️ {electionName}</div>}
          </div>

          {electionLoaded && !hasActiveElection && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
              <div style={{ fontSize: 56, marginBottom: "1rem" }}>⏸️</div>
              <h2 style={{ fontFamily: "Syne,sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "#f1f5f9", marginBottom: ".75rem" }}>No Active Election</h2>
              <p style={{ fontSize: ".9rem", color: "rgba(148,163,184,.55)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
                There is no active election right now. Please check back later or contact the admin.
              </p>
            </div>
          )}

          {hasActiveElection && <div className="card">
            {/* ── STEP 0: LIVENESS ── */}
            {step === 0 && (
              <>
                <div className="cam-wrap">
                  <video ref={videoRef} autoPlay muted playsInline />
                  <div className="cam-corner tl" /><div className="cam-corner tr" />
                  <div className="cam-corner bl" /><div className="cam-corner br" />
                  {cameraOn && <div className="scan-line" />}
                  {flash && <div className="flash-el" />}

                  {isCountingDown && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.55)", zIndex: 5 }}>
                      <div style={{ fontSize: "3rem", fontWeight: 800, fontFamily: "Syne,sans-serif", color: "#f1f5f9", textShadow: "0 4px 24px rgba(0,0,0,.5)" }}>
                        {livenessCountdown}
                      </div>
                    </div>
                  )}

                  {capturingFrames && (
                    <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
                      <div style={{ background: "rgba(0,0,0,.75)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", animation: "pdot 1s ease-in-out infinite" }} />
                        <div style={{ fontSize: ".78rem", color: "#f1f5f9", fontWeight: 600 }}>
                          Capturing frames... {frameCount}/{TARGET_FRAMES}
                        </div>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(frameCount / TARGET_FRAMES) * 100}%`, background: "linear-gradient(90deg,#34d399,#059669)", transition: "width .3s" }} />
                      </div>
                    </div>
                  )}

                  {livenessChecking && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", zIndex: 5 }}>
                      <div className="spinner" style={{ width: 28, height: 28, marginBottom: 12 }} />
                      <div style={{ fontSize: ".85rem", color: "#f1f5f9", fontWeight: 600 }}>Analyzing liveness...</div>
                    </div>
                  )}

                  {livenessResult === "pass" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,150,105,.3)", zIndex: 5 }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                      <div style={{ fontSize: ".9rem", color: "#34d399", fontWeight: 700 }}>Liveness Verified</div>
                    </div>
                  )}

                  {livenessResult === "fail" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,.2)", zIndex: 5 }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>✕</div>
                      <div style={{ fontSize: ".9rem", color: "#f87171", fontWeight: 700 }}>Liveness Failed</div>
                    </div>
                  )}
                </div>

                {livenessChallenge && !isCountingDown && !capturingFrames && !livenessChecking && !livenessResult && (
                  <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 14, padding: "14px 16px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      👁️
                    </div>
                    <div>
                      <div style={{ fontSize: ".68rem", fontWeight: 600, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Challenge</div>
                      <div style={{ fontSize: ".88rem", color: "#f1f5f9", fontWeight: 500 }}>{livenessChallenge}</div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: ".78rem", color: "rgba(148,163,184,.4)", textAlign: "center", marginBottom: "1.25rem" }}>
                  {cameraOn
                    ? !livenessChallenge
                      ? "Click below to start the liveness verification process"
                      : isCountingDown
                        ? "Get ready... follow the instruction above"
                        : capturingFrames
                          ? "Follow the challenge instruction — frames are being captured"
                          : livenessChecking
                            ? "Analyzing your liveness..."
                            : livenessResult === "pass"
                              ? "Liveness verified! Moving to face verification..."
                              : "Click retry to try again with a new challenge"
                    : "Starting camera..."}
                </div>

                {(!livenessChallenge || livenessResult === "fail") && !isCountingDown && !capturingFrames && !livenessChecking && (
                  <button className="btn btn-green" onClick={startLivenessCheck} disabled={loading || !cameraOn}>
                    {livenessResult === "fail" ? "🔄 Retry Liveness Check" : "🔍 Start Liveness Check"}
                  </button>
                )}
              </>
            )}

            {/* ── STEP 1: FACE VERIFY ── */}
            {step === 1 && (
              <>
                <div className="cam-wrap">
                  <video ref={videoRef} autoPlay muted playsInline />
                  <div className="cam-corner tl" /><div className="cam-corner tr" />
                  <div className="cam-corner bl" /><div className="cam-corner br" />
                  {cameraOn && <div className="scan-line" />}
                  {flash && <div className="flash-el" />}
                </div>
                <div style={{ fontSize: ".78rem", color: "rgba(148,163,184,.4)", textAlign: "center", marginBottom: "1.25rem" }}>
                  {cameraOn ? "Look directly at the camera and click verify" : "Starting camera..."}
                </div>
                <button className="btn btn-green" onClick={verifyFace} disabled={loading || !cameraOn}>
                  {loading ? <><div className="spinner" />Scanning...</> : "Verify My Face"}
                </button>
              </>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 2 && (
              <>
                <div className="voter-chip">
                  <div className="voter-avatar">👤</div>
                  <div>
                    <div className="voter-name">{voterName}</div>
                    <div className="voter-sub">{voterConstituency ? `📍 ${voterConstituency}` : "Authenticated via FaceID"}</div>
                  </div>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={{ fontSize: ".85rem", color: "rgba(148,163,184,.6)", textAlign: "center", marginBottom: "1.25rem" }}>
                    Click below to receive a one-time verification code on your registered email.
                  </p>
                  {!otpSent ? (
                    <button className="btn btn-blue" onClick={sendOtp} disabled={loading}>
                      {loading ? <><div className="spinner" />Sending…</> : "📨 Send OTP to Email"}
                    </button>
                  ) : (
                    <>
                      <p className="otp-label">Enter the 6-digit verification code sent to your email.</p>
                      <OtpInput value={otp} onChange={setOtp} />
                      <button className="btn btn-blue" onClick={verifyOtp} disabled={loading}>
                        {loading ? <><div className="spinner" />Verifying…</> : "Verify & Continue →"}
                      </button>
                      <button className="resend-btn" onClick={sendOtp} disabled={loading}>
                        Resend Code via Email
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── STEP 3: BALLOT BOX ── */}
            {step === 3 && (
              <>
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: ".85rem", fontWeight: 600, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Official Ballot</div>
                  <div style={{ fontSize: ".72rem", color: "rgba(148,163,184,.5)" }}>Select one candidate below. Action is irreversible.</div>
                  {voterConstituency && (
                    <div style={{ marginTop: 8, fontSize: ".75rem", color: "#fbbf24", display: "flex", alignItems: "center", gap: 6 }}>
                      🏛️ Constituency: <strong>{voterConstituency}</strong>
                    </div>
                  )}
                </div>
                <div className="cands-grid">
                  {candidates.map(c => (
                    <div key={c.id} className={`cand-card ${c.is_nota ? "nota" : ""} ${selectedCand === c.id ? "selected" : ""}`} onClick={() => !loading && castVote(c.id)}>
                      {c.symbol 
                        ? <img src={`http://localhost:5000/party_symbols/${c.symbol.split("/").pop()}`} alt="" className="cand-sym" />
                        : <div className="cand-sym-ph">🏛️</div>
                      }
                      <div>
                        <div className="cand-name">{c.name}</div>
                        <div className="cand-party">{c.party}</div>
                      </div>
                      <div className="vote-arrow">
                        {selectedCand === c.id && loading ? <div className="spinner" style={{ borderColor: "rgba(129,138,248,.3)", borderTopColor: "#818cf8" }} /> : "🗳️"}
                      </div>
                    </div>
                  ))}
                  {candidates.length === 0 && (
                    <div style={{ padding: "2rem", textAlign: "center", color: "rgba(148,163,184,.4)", fontSize: ".9rem" }}>No candidates available for this election.</div>
                  )}
                </div>
              </>
            )}

            {/* ── STEP 4: DONE ── */}
            {step === 4 && (
              <div className="success-wrap">
                <div className="success-icon">✓</div>
                <div className="success-title">Vote Recorded!</div>
                <div className="success-sub">Your vote has been securely submitted.</div>

                {votedCandidate && (
                  <div className="voted-chip">
                    {votedCandidate.symbol
                      ? <img src={`http://localhost:5000/party_symbols/${votedCandidate.symbol.split("/").pop()}`} alt="" className="cand-sym" style={{ width: 44, height: 44 }} />
                      : <div className="cand-sym-ph" style={{ width: 44, height: 44, fontSize: 20 }}>🏛️</div>
                    }
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#f1f5f9" }}>{votedCandidate.name}</div>
                      <div style={{ fontSize: ".75rem", color: "rgba(148,163,184,.5)" }}>{votedCandidate.party}</div>
                    </div>
                  </div>
                )}

                <div className="tx-box">
                  <div className="tx-label">Block #<span style={{color:"#34d399"}}>{blockIndex}</span> — SHA-256 Local Hash</div>
                  <div className="tx-hash">{txHash}</div>
                </div>

                {ethTxHash && (
                  <div className="tx-box" style={{borderColor:"rgba(52,211,153,.2)",marginBottom:".75rem"}}>
                    <div className="tx-label" style={{color:"#34d399"}}>⛓️ Ethereum Sepolia — Transaction Hash</div>
                    <div className="tx-hash" style={{color:"#34d399",marginBottom:8}}>{ethTxHash}</div>
                    {ethExplorerUrl && (
                      <a href={ethExplorerUrl} target="_blank" rel="noopener noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:".72rem",color:"#818cf8",textDecoration:"underline"}}>
                        View on Etherscan ↗
                      </a>
                    )}
                  </div>
                )}

                <a href="/results" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", borderRadius: 12, padding: ".85rem 2rem", fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: ".9rem", textDecoration: "none", boxShadow: "0 4px 20px rgba(99,102,241,.35)" }}>
                  View Live Results →
                </a>
              </div>
            )}
          </div>}
        </div>
      </div>
    </>
  );
}