"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

function getAdminToken(): string {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : "";
}

function redirectToLogin() {
  if (typeof window !== "undefined") window.location.href = "/admin/login";
}

/* Every administrative request goes through here. If the server rejects the
   session (401/403) the local token is cleared and the admin is sent to login,
   so an expired/forged/revoked token can never be used to drive the dashboard. */
async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAdminToken();
  if (token) headers.set("Authorization", token);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("admin_token");
    redirectToLogin();
    throw new Error("unauthorized");
  }
  return res;
}

/* ══════════════════════════════════════════════════════════
   TOAST SYSTEM
══════════════════════════════════════════════════════════ */
type TT = "success" | "error" | "info" | "warning";
interface Toast { id: number; type: TT; title: string; msg: string; }
let _tid = 0;
let _add: ((t: Omit<Toast, "id">) => void) | null = null;
function toast(type: TT, title: string, msg = "") { _add?.({ type, title, msg }); }

function ToastBox() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    _add = (t) => {
      const id = ++_tid;
      setList((p) => [...p, { ...t, id }]);
      setTimeout(() => setList((p) => p.filter((x) => x.id !== id)), 4200);
    };
    return () => { _add = null; };
  }, []);
  const clr: Record<TT, string> = { success:"#34d399", error:"#f87171", warning:"#fbbf24", info:"#60a5fa" };
  const ic:  Record<TT, string> = { success:"✓",       error:"✕",       warning:"⚠",        info:"ℹ"     };
  return (
    <div style={{ position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none" }}>
      {list.map((t) => (
        <div key={t.id} style={{
          display:"flex",alignItems:"flex-start",gap:12,
          background:"rgba(9,12,22,0.97)",border:`1px solid ${clr[t.type]}44`,
          borderRadius:14,padding:"13px 18px",minWidth:280,maxWidth:340,
          boxShadow:"0 8px 32px rgba(0,0,0,.55)",
          animation:"tIn .3s cubic-bezier(.34,1.56,.64,1)",pointerEvents:"auto",
        }}>
          <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:`${clr[t.type]}1a`,color:clr[t.type] }}>{ic[t.type]}</div>
          <div>
            <div style={{ fontSize:13,fontWeight:600,color:"#f1f5f9",marginBottom:2 }}>{t.title}</div>
            {t.msg && <div style={{ fontSize:12,color:"rgba(241,245,249,.45)",lineHeight:1.5 }}>{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CONFIRM DIALOG
══════════════════════════════════════════════════════════ */
function ConfirmDialog({ open, message, onConfirm, onCancel }: {
  open: boolean; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:8888,background:"rgba(0,0,0,.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"rgba(11,15,26,.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"2rem 2.5rem",maxWidth:380,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.6)",animation:"tIn .25s cubic-bezier(.34,1.56,.64,1)",textAlign:"center" }}>
        <div style={{ fontSize:38,marginBottom:14 }}>⚠️</div>
        <div style={{ color:"#f1f5f9",fontSize:15,lineHeight:1.65,marginBottom:24 }}>{message}</div>
        <div style={{ display:"flex",gap:12,justifyContent:"center" }}>
          <button onClick={onCancel} style={{ padding:"10px 24px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#94a3b8",fontSize:14,cursor:"pointer",fontWeight:600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding:"10px 24px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:600,boxShadow:"0 4px 16px rgba(239,68,68,.35)" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
interface Election { id: number; name: string; start_time: string; end_time: string; results_expire_at?: string; }
interface Candidate { id: number; name: string; party: string; symbol: string; election_id?: number; constituency?: string; is_nota?: boolean; }
interface Voter { name: string; email: string; phone: string; state: string; district: string; constituency: string; has_face: boolean; }
interface VoteEntry { vote_id: number; voter_name: string; candidate_name: string; party: string; constituency?: string; voted_at?: string; candidate_id: number; }
interface VoteSummary { candidate_id: number; candidate_name: string; party: string; constituency?: string; count: number; }
interface VoteData { votes: VoteEntry[]; summary: VoteSummary[]; total: number; }
interface ResultItem { name:string; party:string; symbol:string; constituency:string; votes:number; is_nota?:boolean; }

/* ══════════════════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════════════════ */
function StatCard({ icon, label, value, color }: { icon:string; label:string; value:string|number; color:string }) {
  return (
    <div style={{ background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:"1.25rem 1.5rem",display:"flex",alignItems:"center",gap:14 }}>
      <div style={{ width:44,height:44,borderRadius:12,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:24,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.02em",fontFamily:"Syne,sans-serif" }}>{value}</div>
        <div style={{ fontSize:12,color:"rgba(148,163,184,.55)",marginTop:1 }}>{label}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
export default function Admin() {
  /* ── Create election form ── */
  const [electionName, setElectionName] = useState("");
  const [startDate,    setStartDate]    = useState("");
  const [endDate,      setEndDate]      = useState("");
  const [startTime,    setStartTime]    = useState("");
  const [endTime,      setEndTime]      = useState("");
  const [startPeriod,  setStartPeriod]  = useState("AM");
  const [endPeriod,    setEndPeriod]    = useState("PM");

  /* ── Add candidate form ── */
  const [electionId,     setElectionId]     = useState<number | null>(null);
  const [candidateName,  setCandidateName]  = useState("");
  const [party,          setParty]          = useState("");
  const [candidateConstituency, setCandidateConstituency] = useState("");
  const [symbol,         setSymbol]         = useState<File | null>(null);
  const [preview,        setPreview]        = useState("");

  /* ── Data from backend ── */
  const [elections,   setElections]   = useState<Election[]>([]);
  const [candidates,  setCandidates]  = useState<Candidate[]>([]);
  const [voters,      setVoters]      = useState<Voter[]>([]);
  const [activeElec,  setActiveElec]  = useState<{ id:number; name:string } | null>(null);

  /* ── Votes data ── */
  const [voteElectionId,   setVoteElectionId]   = useState<number | null>(null);
  const [voteData,         setVoteData]         = useState<VoteData | null>(null);

  /* ── Results data ── */
  const [resultElectionId, setResultElectionId] = useState<number | null>(null);
  const [resultData,       setResultData]       = useState<ResultItem[] | null>(null);
  const [resultLoading,    setResultLoading]    = useState(false);

  /* ── UI state ── */
  const [authed,           setAuthed]           = useState(false);
  const [electionLoading,  setElectionLoading]  = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [voterLoading,     setVoterLoading]     = useState(false);
  const [voterError,       setVoterError]       = useState("");
  const [confirmLogout,    setConfirmLogout]     = useState(false);
  const [confirmDelElec,   setConfirmDelElec]    = useState<number | null>(null);
  const [confirmDelCand,   setConfirmDelCand]    = useState<number | null>(null);
  const [confirmDelVoter,  setConfirmDelVoter]   = useState<string | null>(null);
  const [activeTab,        setActiveTab]         = useState<"create"|"candidates"|"elections"|"voters"|"votes"|"results">("create");
  const [editVoter,          setEditVoter]          = useState<Voter | null>(null);
  const [editVoterForm,      setEditVoterForm]      = useState({ email:"", phone:"", state:"", district:"", constituency:"" });
  const [editElection,       setEditElection]       = useState<Election | null>(null);
  const [editElectionForm,   setEditElectionForm]   = useState({ name:"", startDate:"", startTime:"", startPeriod:"AM" as "AM"|"PM", endDate:"", endTime:"", endPeriod:"PM" as "AM"|"PM" });
  const [sendingEmail,       setSendingEmail]       = useState(false);
  const [chainVerifyResult, setChainVerifyResult] = useState<{valid:boolean; message:string; blocks:number} | null>(null);
  const [chainVerifying,    setChainVerifying]    = useState(false);
  const [ethInfo,           setEthInfo]           = useState<{enabled:boolean; contract_address:string|null; explorer:string} | null>(null);

  const loadElections = async () => {
    try {
      const res  = await adminFetch("/elections");
      const data = await res.json();
      if (Array.isArray(data)) setElections(data);
    } catch { /* silent */ }
  };

  const loadCandidates = async (eid: number) => {
    try {
      const res  = await fetch(`${API_BASE}/candidates/${eid}`);
      const data = await res.json();
      if (Array.isArray(data)) setCandidates(data);
    } catch { /* silent */ }
  };

  const loadVoters = async () => {
    setVoterLoading(true);
    try {
      const res  = await adminFetch("/voters");
      const data = await res.json();
      if (Array.isArray(data)) {
        /* Replace the whole list by name — the server is the source of truth,
           so additions/updates/deletions sync without duplicate entries. */
        setVoters(data);
        setVoterError("");
      }
    } catch (e) {
      if ((e as Error)?.message !== "unauthorized") {
        setVoterError("Could not sync voters. Retrying…");
      }
    } finally { setVoterLoading(false); }
  };

  const loadVotes = async (eid: number) => {
    try {
      const res  = await adminFetch(`/election-votes/${eid}`);
      const data = await res.json();
      if (data.votes) setVoteData(data);
    } catch { /* silent */ }
  };

  const loadResults = async (eid: number) => {
    setResultLoading(true);
    try {
      const res  = await fetch(`http://localhost:5000/results/${eid}`);
      const data = await res.json();
      if (Array.isArray(data)) setResultData(data);
    } catch { /* silent */ }
    finally { setResultLoading(false); }
  };

  const loadActive = async () => {
    try {
      const res  = await fetch(`${API_BASE}/active-election`);
      const data = await res.json();
      if (data.id) { setActiveElec(data); setElectionId(data.id); loadCandidates(data.id); }
    } catch { /* silent */ }
  };

  const loadAll = useCallback(async () => {
    await Promise.all([loadElections(), loadActive(), loadVoters()]);
    fetch(`${API_BASE}/ethereum-status`).then(r => r.json()).then(d => setEthInfo(d)).catch(() => {});
  }, []);

  /* ── Auth guard: verify the session server-side, not just localStorage ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAdminToken();
      if (!token) { redirectToLogin(); return; }
      try {
        const res = await fetch(`${API_BASE}/admin/verify`, { headers: { Authorization: token } });
        if (!res.ok) { localStorage.removeItem("admin_token"); redirectToLogin(); return; }
        const data = await res.json();
        if (!data?.authenticated) { localStorage.removeItem("admin_token"); redirectToLogin(); return; }
        if (cancelled) return;
        setAuthed(true);
        await loadAll();
      } catch {
        /* Backend unreachable — don't destroy a possibly-valid session. */
        redirectToLogin();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Real-time voter sync ──
     Poll the voter list so a newly registered voter appears (and the count
     updates) without a manual page refresh. The list is replaced wholesale, so
     there are never duplicate entries. */
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(() => { loadVoters(); }, 5000);
    return () => clearInterval(interval);
  }, [authed]);

  const convertToISO = (date: string, time: string, period: string) => {
    const [h0, m] = time.split(":").map(Number);
    let h = h0;
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    const dt = new Date(date); dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  };

  /* ── Create Election ── */
  const createElection = async () => {
    if (!electionName || !startDate || !endDate || !startTime || !endTime) {
      toast("warning", "Missing fields", "Fill in all election details."); return;
    }
    setElectionLoading(true);
    try {
      const res  = await adminFetch("/create-election", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ name:electionName, start:convertToISO(startDate,startTime,startPeriod), end:convertToISO(endDate,endTime,endPeriod) }),
      });
      const data = await res.json();
      if (data.election_id) {
        setElectionId(data.election_id);
        toast("success", "Election created!", `"${electionName}" — ID #${data.election_id}`);
        setElectionName(""); setStartDate(""); setEndDate(""); setStartTime(""); setEndTime("");
        await loadElections();
        setActiveTab("candidates");
      } else {
        toast("error", "Failed", data.message || "Could not create election.");
      }
    } catch { toast("error", "Network error", "Cannot reach the backend."); }
    finally { setElectionLoading(false); }
  };

  /* ── Delete Election ── */
  const deleteElection = async (eid: number) => {
    try {
      const res = await adminFetch(`/delete-election/${eid}`, { method:"DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Election deleted", `ID #${eid} removed.`);
        setElections((p) => p.filter((e) => e.id !== eid));
        if (electionId === eid) { setElectionId(null); setCandidates([]); }
      } else {
        toast("error", "Cannot delete", data.message || "Failed to delete election.");
      }
    } catch { toast("error", "Network error", "Cannot reach the backend."); }
    finally { setConfirmDelElec(null); }
  };

  /* ── Add Candidate ── */
  const addCandidate = async () => {
    if (!candidateName || !party || !symbol || !electionId || !candidateConstituency) {
      toast("warning", "Missing fields", !electionId ? "Select or create an election first." : "Fill name, party, constituency and upload symbol.");
      return;
    }
    setCandidateLoading(true);
    const fd = new FormData();
    fd.append("name", candidateName); fd.append("party", party);
    fd.append("election_id", electionId.toString()); fd.append("constituency", candidateConstituency);
    fd.append("symbol", symbol);
    try {
      const res  = await adminFetch("/add-candidate", { method:"POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Candidate added!", `${candidateName} (${party})`);
        setCandidateName(""); setParty(""); setCandidateConstituency(""); setSymbol(null); setPreview("");
        await loadCandidates(electionId);
      } else { toast("error", "Failed", data.message); }
    } catch { toast("error", "Network error", "Cannot reach the backend."); }
    finally { setCandidateLoading(false); }
  };

  /* ── Delete Candidate ── */
  const deleteCandidate = async (cid: number) => {
    try {
      const res  = await adminFetch(`/delete-candidate/${cid}`, { method:"DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Candidate removed");
        setCandidates((p) => p.filter((c) => c.id !== cid));
      } else { toast("error", "Failed", data.message); }
    } catch { toast("error", "Network error", "Cannot reach the backend."); }
    finally { setConfirmDelCand(null); }
  };

  const deleteVoter = async (name: string) => {
    try {
      const res = await adminFetch(`/voter/${encodeURIComponent(name)}`, { method:"DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Voter deleted", `${name} removed.`);
        setVoters((p) => p.filter((v) => v.name !== name));
      } else { toast("error", "Failed", data.message); }
    } catch { toast("error", "Network error", "Cannot reach the backend."); }
    finally { setConfirmDelVoter(null); }
  };

  const saveVoterEdit = async () => {
    if (!editVoter) return;
    try {
      const res = await adminFetch(`/voter/${encodeURIComponent(editVoter.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editVoterForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Voter updated", `${editVoter.name} details saved.`);
        setEditVoter(null);
        loadVoters();
      } else {
        toast("error", "Failed", data.message);
      }
    } catch {
      toast("error", "Network error", "Cannot reach backend.");
    }
  };

  const openEditVoter = (v: Voter) => {
    setEditVoter(v);
    setEditVoterForm({ email: v.email, phone: v.phone, state: v.state, district: v.district, constituency: v.constituency });
  };

  const parseISOToDateTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toISOString().slice(0, 10);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    const time = `${h.toString().padStart(2, "0")}:${m}`;
    return { date, time, period: period as "AM" | "PM" };
  };

  const openEditElection = (el: Election) => {
    const start = parseISOToDateTime(el.start_time);
    const end = parseISOToDateTime(el.end_time);
    setEditElection(el);
    setEditElectionForm({
      name: el.name,
      startDate: start.date,
      startTime: start.time,
      startPeriod: start.period,
      endDate: end.date,
      endTime: end.time,
      endPeriod: end.period,
    });
  };

  const saveElectionEdit = async () => {
    if (!editElection) return;
    if (!editElectionForm.name || !editElectionForm.startDate || !editElectionForm.startTime || !editElectionForm.endDate || !editElectionForm.endTime) {
      toast("warning", "Missing fields", "Fill in all election details."); return;
    }
    try {
      const res = await adminFetch(`/edit-election/${editElection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editElectionForm.name,
          start: convertToISO(editElectionForm.startDate, editElectionForm.startTime, editElectionForm.startPeriod),
          end: convertToISO(editElectionForm.endDate, editElectionForm.endTime, editElectionForm.endPeriod),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Election updated", `ID #${editElection.id} saved.`);
        setEditElection(null);
        loadElections();
      } else {
        toast("error", "Failed", data.message);
      }
    } catch {
      toast("error", "Network error", "Cannot reach backend.");
    }
  };

  const sendResultEmails = async () => {
    if (!voteElectionId) { toast("warning", "Select an election"); return; }
    setSendingEmail(true);
    try {
      const res = await adminFetch(`/send-election-results/${voteElectionId}`, { method:"POST" });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Emails sent!", `Sent: ${data.sent}, Failed: ${data.failed}`);
      } else { toast("error", "Failed", data.message); }
    } catch { toast("error", "Network error"); }
    finally { setSendingEmail(false); }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/admin/logout`, {
        method: "POST",
        headers: { Authorization: getAdminToken() },
      });
    } catch { /* backend unreachable — still clear the local session */ }
    localStorage.removeItem("admin_token");
    redirectToLogin();
  };

  const totalVoters = voters.length;

  /* ── Don't render the dashboard until an admin session is verified ── */
  if (!authed) {
    return (
      <>
        <style>{`@keyframes adminSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{minHeight:"100vh",background:"#080c18",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(148,163,184,.6)",fontFamily:"'DM Sans',sans-serif",fontSize:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:18,height:18,border:"2px solid rgba(255,255,255,.15)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"adminSpin .7s linear infinite"}}/>
            Checking admin session…
          </div>
        </div>
      </>
    );
  }

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#080c18}
        @keyframes tIn    { from{opacity:0;transform:scale(.88) translateY(-8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes drift  { from{transform:translate(0,0)} to{transform:translate(40px,30px)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pdot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

        .root{min-height:100vh;background:#080c18;font-family:'DM Sans',sans-serif;position:relative;overflow-x:hidden}
        .blob{position:fixed;border-radius:50%;filter:blur(100px);opacity:.09;pointer-events:none}
        .b1{width:650px;height:650px;background:radial-gradient(circle,#3b82f6,transparent);top:-200px;left:-150px;animation:drift 15s ease-in-out infinite alternate}
        .b2{width:500px;height:500px;background:radial-gradient(circle,#6366f1,transparent);bottom:-100px;right:-100px;animation:drift 19s ease-in-out infinite alternate-reverse}
        .b3{width:400px;height:400px;background:radial-gradient(circle,#0ea5e9,transparent);top:45%;left:55%;animation:drift 13s ease-in-out infinite alternate}
        .grid-bg{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(59,130,246,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.03) 1px,transparent 1px);background-size:44px 44px}

        .inner{max-width:1180px;margin:0 auto;padding:2rem 1.5rem 5rem;position:relative;z-index:1;opacity:0;animation:fadeUp .5s ease .05s forwards}

        /* topbar */
        .topbar{display:flex;align-items:center;justify-content:space-between;padding-bottom:1.75rem;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:2rem}
        .tl{display:flex;align-items:center;gap:14px}
        .brand-icon{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 18px rgba(99,102,241,.4)}
        .brand-title{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#f1f5f9;letter-spacing:-.025em}
        .brand-title span{background:linear-gradient(135deg,#60a5fa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .live-pill{display:flex;align-items:center;gap:6px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:100px;padding:4px 12px 4px 8px}
        .ldot{width:7px;height:7px;background:#34d399;border-radius:50%;box-shadow:0 0 8px #34d399;animation:pdot 2s ease-in-out infinite}
        .ltxt{font-size:.68rem;color:#6ee7b7;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
        .logout-btn{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;color:#fca5a5;font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:500;padding:9px 18px;cursor:pointer;transition:background .2s,border-color .2s,transform .15s}
        .logout-btn:hover{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.4);transform:translateY(-1px)}

        /* stats */
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin-bottom:2rem}

        /* active banner */
        .active-banner{display:flex;align-items:center;gap:12px;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.18);border-radius:14px;padding:14px 20px;margin-bottom:1.75rem;font-size:.88rem;color:#6ee7b7}
        .active-banner strong{color:#34d399;font-weight:700}

        /* tabs */
        .tabs{display:flex;gap:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px;margin-bottom:1.75rem;width:fit-content}
        .tab{padding:9px 22px;border-radius:10px;font-size:.82rem;font-weight:600;cursor:pointer;border:none;background:transparent;color:rgba(148,163,184,.5);transition:all .2s;font-family:'DM Sans',sans-serif}
        .tab.active{background:rgba(99,102,241,.18);color:#a5b4fc;box-shadow:0 2px 8px rgba(99,102,241,.2)}
        .tab:hover:not(.active){color:rgba(148,163,184,.8)}

        /* cards */
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
        @media(max-width:780px){.grid2{grid-template-columns:1fr}}
        .card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:22px;padding:2rem;backdrop-filter:blur(20px);box-shadow:0 0 0 1px rgba(59,130,246,.05),0 20px 48px rgba(0,0,0,.4)}
        .card-full{grid-column:1/-1}
        .ch{display:flex;align-items:center;gap:12px;margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(255,255,255,.06)}
        .ci{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
        .ct{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;color:#f1f5f9;letter-spacing:-.01em}
        .cs{font-size:.72rem;color:rgba(148,163,184,.45);margin-top:2px}

        /* fields */
        .field{margin-bottom:1rem}
        .fl{display:block;font-size:.7rem;font-weight:600;color:rgba(148,163,184,.6);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
        .iw{display:flex;align-items:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,box-shadow .2s,background .2s}
        .iw:focus-within{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.06);box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .ii{padding:0 12px;font-size:16px;color:rgba(148,163,184,.3);flex-shrink:0;transition:color .2s}
        .iw:focus-within .ii{color:#818cf8}
        .iw input,.iw select{flex:1;background:transparent;border:none;outline:none;color:#f1f5f9;font-size:14px;padding:.75rem .75rem .75rem 0;font-family:inherit;colorScheme:dark}
        .iw input::placeholder{color:rgba(148,163,184,.25)}
        .bare-input{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;color:#f1f5f9;font-size:14px;padding:.75rem 1rem;outline:none;font-family:inherit;transition:border-color .2s,box-shadow .2s,background .2s;colorScheme:dark}
        .bare-input:focus{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.06);box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .bare-select{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#f1f5f9;font-size:14px;padding:.75rem 1rem;outline:none;font-family:inherit;cursor:pointer;transition:border-color .2s}
        .bare-select:focus{border-color:rgba(99,102,241,.5)}
        .row2{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}

        /* file upload */
        .upload{position:relative;border:1.5px dashed rgba(255,255,255,.1);border-radius:14px;padding:1.5rem;text-align:center;cursor:pointer;background:rgba(255,255,255,.015);transition:border-color .2s,background .2s}
        .upload:hover{border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.04)}
        .upload input[type="file"]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
        .prev{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 14px;margin-top:.75rem}
        .prev img{width:50px;height:50px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.1)}

        /* buttons */
        .btn{width:100%;margin-top:.5rem;padding:.9rem;border:none;border-radius:12px;cursor:pointer;font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,box-shadow .15s,opacity .15s}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .btn-blue{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 4px 20px rgba(99,102,241,.3)}
        .btn-blue:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(99,102,241,.45)}
        .btn-green{background:linear-gradient(135deg,#059669,#0d9488);color:#fff;box-shadow:0 4px 20px rgba(5,150,105,.25)}
        .btn-green:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(5,150,105,.38)}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite}

        /* election list */
        .elec-item{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05)}
        .elec-item:last-child{border-bottom:none}
        .elec-name{font-size:.9rem;font-weight:600;color:#f1f5f9;margin-bottom:4px}
        .elec-time{font-size:.72rem;color:rgba(148,163,184,.45)}
        .elec-badge{font-size:.65rem;font-weight:600;padding:3px 10px;border-radius:100px;border:1px solid;display:inline-block;margin-bottom:6px}
        .badge-active{color:#34d399;background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.25)}
        .badge-ended{color:#94a3b8;background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.15)}
        .badge-upcoming{color:#fbbf24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.2)}
        .del-btn{flex-shrink:0;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;color:#f87171;font-size:.75rem;font-weight:600;padding:7px 13px;cursor:pointer;transition:background .2s,border-color .2s;font-family:'DM Sans',sans-serif}
        .del-btn:hover{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.4)}
        .edit-btn{flex-shrink:0;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;color:#818cf8;font-size:.75rem;font-weight:600;padding:7px 13px;cursor:pointer;transition:background .2s,border-color .2s;font-family:'DM Sans',sans-serif}
        .edit-btn:hover{background:rgba(99,102,241,.18);border-color:rgba(99,102,241,.4)}

        /* candidate list */
        .cand-item{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)}
        .cand-item:last-child{border-bottom:none}
        .cand-sym{width:42px;height:42px;border-radius:10px;object-fit:cover;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.2);flex-shrink:0}
        .cand-sym-ph{width:42px;height:42px;border-radius:10px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .cname{font-size:.88rem;font-weight:600;color:#f1f5f9}
        .cparty{font-size:.72rem;color:rgba(148,163,184,.45);margin-top:2px}
        .empty{text-align:center;padding:2rem;color:rgba(148,163,184,.35);font-size:.85rem}

        /* election selector */
        .elec-select-row{display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px 16px}
        .elec-select-lbl{font-size:.75rem;font-weight:600;color:rgba(148,163,184,.5);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}
        .elec-select-dd{flex:1;background:transparent;border:none;outline:none;color:#f1f5f9;font-size:.88rem;font-family:inherit;cursor:pointer;colorScheme:dark}
        .elec-select-dd option{background:#0d1120}

        .hint{font-size:.72rem;color:rgba(248,113,113,.55);margin-top:.4rem}
      `}</style>

      <ToastBox />
      <ConfirmDialog open={confirmLogout} message="Are you sure you want to log out?"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)} />
      <ConfirmDialog open={confirmDelElec !== null} message={`Delete election #${confirmDelElec}? All candidates and votes will be permanently removed.`}
        onConfirm={() => confirmDelElec !== null && deleteElection(confirmDelElec)}
        onCancel={() => setConfirmDelElec(null)} />
      <ConfirmDialog open={confirmDelCand !== null} message="Remove this candidate? Their votes will also be deleted."
        onConfirm={() => confirmDelCand !== null && deleteCandidate(confirmDelCand)}
        onCancel={() => setConfirmDelCand(null)} />
      <ConfirmDialog open={confirmDelVoter !== null} message={`Delete voter "${confirmDelVoter}"? Their face data and vote history will be permanently removed.`}
        onConfirm={() => confirmDelVoter !== null && deleteVoter(confirmDelVoter)}
        onCancel={() => setConfirmDelVoter(null)} />
      {editVoter !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:8888,background:"rgba(0,0,0,.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"rgba(11,15,26,.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"2rem 2.5rem",maxWidth:420,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.6)",animation:"tIn .25s cubic-bezier(.34,1.56,.64,1)" }}>
            <div style={{ fontSize:32,marginBottom:10,textAlign:"center" }}>✏️</div>
            <div style={{ color:"#f1f5f9",fontSize:15,fontWeight:600,marginBottom:4,textAlign:"center" }}>Edit Voter</div>
            <div style={{ fontSize:13,color:"rgba(148,163,184,.55)",marginBottom:18,textAlign:"center" }}>{editVoter.name}</div>
            {(["email","phone","state","district","constituency"] as const).map(f => (
              <div key={f} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"rgba(148,163,184,.5)",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{f}</div>
                <input value={editVoterForm[f]} onChange={e => setEditVoterForm(p => ({...p, [f]: e.target.value}))}
                  style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none"}} />
              </div>
            ))}
            <div style={{ display:"flex",gap:12,justifyContent:"center",marginTop:6 }}>
              <button onClick={() => setEditVoter(null)}
                style={{ padding:"10px 24px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#94a3b8",fontSize:14,cursor:"pointer",fontWeight:600 }}>Cancel</button>
              <button onClick={saveVoterEdit}
                style={{ padding:"10px 24px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:600,boxShadow:"0 4px 16px rgba(99,102,241,.35)" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      {editElection !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:8888,background:"rgba(0,0,0,.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"rgba(11,15,26,.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"2rem 2.5rem",maxWidth:440,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.6)",animation:"tIn .25s cubic-bezier(.34,1.56,.64,1)" }}>
            <div style={{ fontSize:32,marginBottom:10,textAlign:"center" }}>✏️</div>
            <div style={{ color:"#f1f5f9",fontSize:15,fontWeight:600,marginBottom:4,textAlign:"center" }}>Edit Election</div>
            <div style={{ fontSize:13,color:"rgba(148,163,184,.55)",marginBottom:18,textAlign:"center" }}>ID #{editElection.id}</div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(148,163,184,.5)",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Election Name</div>
              <input value={editElectionForm.name} onChange={e => setEditElectionForm(p => ({...p, name: e.target.value}))}
                style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none"}} />
            </div>

            <div style={{fontSize:11,color:"rgba(148,163,184,.5)",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>Start</div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input type="date" value={editElectionForm.startDate} onChange={e => setEditElectionForm(p => ({...p, startDate: e.target.value}))}
                style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",colorScheme:"dark"}} />
              <input type="time" value={editElectionForm.startTime} onChange={e => setEditElectionForm(p => ({...p, startTime: e.target.value}))}
                style={{width:110,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",colorScheme:"dark"}} />
              <select value={editElectionForm.startPeriod} onChange={e => setEditElectionForm(p => ({...p, startPeriod: e.target.value as "AM"|"PM"}))}
                style={{width:70,padding:"10px 8px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                <option>AM</option><option>PM</option>
              </select>
            </div>

            <div style={{fontSize:11,color:"rgba(148,163,184,.5)",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>End</div>
            <div style={{display:"flex",gap:8,marginBottom:18}}>
              <input type="date" value={editElectionForm.endDate} onChange={e => setEditElectionForm(p => ({...p, endDate: e.target.value}))}
                style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",colorScheme:"dark"}} />
              <input type="time" value={editElectionForm.endTime} onChange={e => setEditElectionForm(p => ({...p, endTime: e.target.value}))}
                style={{width:110,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",colorScheme:"dark"}} />
              <select value={editElectionForm.endPeriod} onChange={e => setEditElectionForm(p => ({...p, endPeriod: e.target.value as "AM"|"PM"}))}
                style={{width:70,padding:"10px 8px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                <option>AM</option><option>PM</option>
              </select>
            </div>

            <div style={{ display:"flex",gap:12,justifyContent:"center" }}>
              <button onClick={() => setEditElection(null)}
                style={{ padding:"10px 24px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#94a3b8",fontSize:14,cursor:"pointer",fontWeight:600 }}>Cancel</button>
              <button onClick={saveElectionEdit}
                style={{ padding:"10px 24px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:600,boxShadow:"0 4px 16px rgba(99,102,241,.35)" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="root">
        <div className="blob b1"/><div className="blob b2"/><div className="blob b3"/>
        <div className="grid-bg"/>

        <div className="inner">
          {/* ── TOPBAR ── */}
          <div className="topbar">
            <div className="tl">
              <div className="brand-icon">🛡️</div>
              <div>
                <div className="brand-title">Admin <span>Dashboard</span></div>
              </div>
              <div className="live-pill"><span className="ldot"/><span className="ltxt">Live</span></div>
              {ethInfo && (
                <div style={{display:"flex",alignItems:"center",gap:6,background:ethInfo.enabled?"rgba(52,211,153,.08)":"rgba(148,163,184,.05)",border:`1px solid ${ethInfo.enabled?"rgba(52,211,153,.2)":"rgba(148,163,184,.1)"}`,borderRadius:100,padding:"4px 12px 4px 8px",marginLeft:8}}>
                  <span style={{fontSize:14}}>⛓️</span>
                  <span style={{fontSize:".65rem",fontWeight:600,color:ethInfo.enabled?"#34d399":"rgba(148,163,184,.4)",letterSpacing:".04em",whiteSpace:"nowrap"}}>
                    {ethInfo.enabled ? "Sepolia" : "Local Chain"}
                  </span>
                </div>
              )}
            </div>
            <button className="logout-btn" onClick={() => setConfirmLogout(true)}>
              🚪 Logout
            </button>
          </div>

          {/* ── STATS ── */}
          <div className="stats">
            <StatCard icon="🗳️" label="Total Elections"  value={elections.length}  color="#3b82f6"/>
            <StatCard icon="👥" label="Voters"            value={totalVoters}       color="#34d399"/>
            <StatCard icon="🏆" label="Candidates"        value={candidates.length} color="#6366f1"/>
            <StatCard icon="✅" label="Active Election"   value={activeElec ? "Yes" : "None"} color="#fbbf24"/>
          </div>

          {/* ── ACTIVE BANNER ── */}
          {activeElec && (
            <div className="active-banner">
              🟢 &nbsp;<span>Active election: <strong>{activeElec.name}</strong> — ID #{activeElec.id}</span>
            </div>
          )}

          {/* ── TABS ── */}
          <div className="tabs">
            {(["create","candidates","elections","voters","votes","results"] as const).map((t) => (
              <button key={t} className={`tab ${activeTab===t?"active":""}`} onClick={() => setActiveTab(t)}>
                { t==="create" ? "➕ Create" : t==="candidates" ? "👤 Candidates" : t==="elections" ? "📋 Elections" : t==="voters" ? "👥 Voters" : t==="votes" ? "🗳️ Vote Summary" : "📊 Results" }
              </button>
            ))}
          </div>

          {/* ════ TAB: CREATE ELECTION + ADD CANDIDATE ════ */}
          {activeTab === "create" && (
            <div className="grid2">
              {/* Create Election */}
              <div className="card">
                <div className="ch">
                  <div className="ci" style={{background:"rgba(59,130,246,.15)"}}>📅</div>
                  <div><div className="ct">Create Election</div><div className="cs">Set up a new voting event</div></div>
                </div>

                <div className="field">
                  <label className="fl">Election Name</label>
                  <div className="iw"><span className="ii">🗳️</span>
                    <input placeholder="e.g. General Election 2026" value={electionName} onChange={(e)=>setElectionName(e.target.value)}/>
                  </div>
                </div>

                <div className="field">
                  <label className="fl">Start Date</label>
                  <input type="date" className="bare-input" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/>
                </div>
                <div className="field">
                  <label className="fl">Start Time</label>
                  <div className="row2">
                    <input type="time" className="bare-input" value={startTime} onChange={(e)=>setStartTime(e.target.value)}/>
                    <select className="bare-select" value={startPeriod} onChange={(e)=>setStartPeriod(e.target.value)}>
                      <option>AM</option><option>PM</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="fl">End Date</label>
                  <input type="date" className="bare-input" value={endDate} onChange={(e)=>setEndDate(e.target.value)}/>
                </div>
                <div className="field">
                  <label className="fl">End Time</label>
                  <div className="row2">
                    <input type="time" className="bare-input" value={endTime} onChange={(e)=>setEndTime(e.target.value)}/>
                    <select className="bare-select" value={endPeriod} onChange={(e)=>setEndPeriod(e.target.value)}>
                      <option>AM</option><option>PM</option>
                    </select>
                  </div>
                </div>

                <button className="btn btn-blue" onClick={createElection} disabled={electionLoading}>
                  {electionLoading ? <><div className="spinner"/>Creating…</> : "Create Election →"}
                </button>
              </div>

              {/* Add Candidate */}
              <div className="card">
                <div className="ch">
                  <div className="ci" style={{background:"rgba(52,211,153,.12)"}}>👤</div>
                  <div><div className="ct">Add Candidate</div>
                    <div className="cs">{electionId ? `Adding to Election #${electionId}` : "Create an election first"}</div>
                  </div>
                </div>

                {/* Election selector */}
                {elections.length > 0 && (
                  <div className="elec-select-row">
                    <span className="elec-select-lbl">Election</span>
                    <select className="elec-select-dd" value={electionId ?? ""} onChange={(e)=>{ const id=Number(e.target.value); setElectionId(id); loadCandidates(id); }}>
                      <option value="">— select —</option>
                      {elections.map((el)=><option key={el.id} value={el.id}>#{el.id} {el.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label className="fl">Candidate Name</label>
                  <div className="iw"><span className="ii">👤</span>
                    <input placeholder="Full name" value={candidateName} onChange={(e)=>setCandidateName(e.target.value)}/>
                  </div>
                </div>
                <div className="field">
                  <label className="fl">Party Name</label>
                  <div className="iw"><span className="ii">🏛️</span>
                    <input placeholder="Political party" value={party} onChange={(e)=>setParty(e.target.value)}/>
                  </div>
                </div>

                <div className="field">
                  <label className="fl">Constituency</label>
                  <div className="iw"><span className="ii">🏛️</span>
                    <input placeholder="e.g. Pune North" value={candidateConstituency} onChange={(e)=>setCandidateConstituency(e.target.value)}/>
                  </div>
                </div>

                <div className="field">
                  <label className="fl">Party Symbol</label>
                  <div className="upload">
                    <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(f){setSymbol(f);setPreview(URL.createObjectURL(f));} }}/>
                    <div style={{fontSize:28,marginBottom:6}}>🖼️</div>
                    <div style={{fontSize:.8+"rem",color:"rgba(148,163,184,.4)"}}>
                      <strong style={{color:"#818cf8"}}>Click to upload</strong> or drag & drop
                    </div>
                    <div style={{fontSize:.72+"rem",color:"rgba(148,163,184,.3)",marginTop:4}}>PNG, JPG up to 5 MB</div>
                  </div>
                  {preview && (
                    <div className="prev">
                      <img src={preview} alt="sym"/>
                      <div style={{fontSize:.8+"rem",color:"rgba(148,163,184,.5)"}}>
                        <strong style={{color:"#f1f5f9",display:"block",fontSize:.85+"rem"}}>{symbol?.name}</strong>
                        Ready to upload
                      </div>
                    </div>
                  )}
                </div>

                <button className="btn btn-green" onClick={addCandidate} disabled={candidateLoading||!electionId}>
                  {candidateLoading ? <><div className="spinner"/>Adding…</> : "Add Candidate →"}
                </button>
                {!electionId && <p className="hint">⚠ Select or create an election to enable this.</p>}
              </div>
            </div>
          )}

          {/* ════ TAB: CANDIDATES ════ */}
          {activeTab === "candidates" && (
            <div className="grid2">
              <div className="card card-full">
                <div className="ch">
                  <div className="ci" style={{background:"rgba(99,102,241,.15)"}}>👥</div>
                  <div><div className="ct">Candidates</div>
                    <div className="cs">{electionId ? `Election #${electionId}` : "Select an election"}</div>
                  </div>
                </div>

                {/* Selector */}
                {elections.length > 0 && (
                  <div className="elec-select-row" style={{marginBottom:"1.5rem"}}>
                    <span className="elec-select-lbl">View Election</span>
                    <select className="elec-select-dd" value={electionId??""} onChange={(e)=>{ const id=Number(e.target.value); setElectionId(id); loadCandidates(id); }}>
                      <option value="">— select —</option>
                      {elections.map((el)=><option key={el.id} value={el.id}>#{el.id} {el.name}</option>)}
                    </select>
                  </div>
                )}

                {candidates.length === 0 ? (
                  <div className="empty">
                    {electionId ? "No candidates added yet for this election." : "Select an election above to see candidates."}
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"1rem"}}>
                    {candidates.map((c) => (
                      <div key={c.id} style={{ background: c.is_nota ? "rgba(239,68,68,.04)" : "rgba(255,255,255,.02)",border: c.is_nota ? "1px solid rgba(239,68,68,.2)" : "1px solid rgba(255,255,255,.07)",borderRadius:16,padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:14 }}>
                        {c.symbol
                          ? <img src={`http://localhost:5000/party_symbols/${c.symbol.split("/").pop()}`} alt={c.name} className="cand-sym"/>
                          : <div className="cand-sym-ph">🏛️</div>
                        }
                        <div style={{flex:1}}>
                          <div className="cname">{c.name}</div>
                          <div className="cparty">{c.party}</div>
                          {c.constituency && <div style={{fontSize:".68rem",color:"rgba(251,191,36,.6)",marginTop:2}}>📍 {c.constituency}</div>}
                          {c.is_nota && <div style={{fontSize:".62rem",color:"rgba(239,68,68,.7)",marginTop:2,fontWeight:600}}>🔒 Protected — Auto-added</div>}
                        </div>
                        {c.is_nota
                          ? <div style={{fontSize:".65rem",color:"rgba(148,163,184,.35)",textAlign:"right",flexShrink:0,minWidth:70}}>🔒 Protected</div>
                          : <button className="del-btn" onClick={()=>setConfirmDelCand(c.id)}>✕</button>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB: ALL ELECTIONS ════ */}
          {activeTab === "elections" && (
            <div className="card">
              <div className="ch">
                <div className="ci" style={{background:"rgba(251,191,36,.1)"}}>📋</div>
                <div><div className="ct">All Elections</div><div className="cs">{elections.length} total · Results retained for 30 days after election ends</div></div>
              </div>

              {elections.length === 0
                ? <div className="empty">No elections created yet.</div>
                : elections.map((el) => {
                    const now = new Date();
                    const start = new Date(el.start_time);
                    const end   = new Date(el.end_time);
                    const status = now < start ? "upcoming" : now > end ? "ended" : "active";
                    const canDelete = status !== "ended" || (el.results_expire_at && now >= new Date(el.results_expire_at));
                    const daysLeft = el.results_expire_at && status === "ended" ? Math.max(0, Math.ceil((new Date(el.results_expire_at).getTime() - now.getTime()) / (1000*60*60*24))) : 0;
                    return (
                      <div key={el.id} className="elec-item">
                        <div style={{flex:1}}>
                          <span className={`elec-badge ${status==="active"?"badge-active":status==="ended"?"badge-ended":"badge-upcoming"}`}>
                            {status==="active"?"🟢 Active":status==="ended"?"⚪ Ended":"🟡 Upcoming"}
                          </span>
                          <div className="elec-name">#{el.id} — {el.name}</div>
                          <div className="elec-time">
                            Start: {new Date(el.start_time).toLocaleString()} &nbsp;|&nbsp; End: {new Date(el.end_time).toLocaleString()}
                          </div>
                          {status === "ended" && el.results_expire_at && !canDelete && (
                            <div style={{fontSize:".7rem",color:"rgba(251,191,36,.7)",marginTop:4}}>
                              📊 Results protected — available for {daysLeft} more day(s) (until {new Date(el.results_expire_at).toLocaleDateString()})
                            </div>
                          )}
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          {status !== "ended" && (
                            <button className="edit-btn" onClick={()=>openEditElection(el)}>✏️ Edit</button>
                          )}
                          {canDelete
                            ? <button className="del-btn" onClick={()=>setConfirmDelElec(el.id)}>🗑 Delete</button>
                            : <div style={{fontSize:".65rem",color:"rgba(148,163,184,.35)",textAlign:"right",flexShrink:0,minWidth:70}}>🔒 Protected</div>
                          }
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {/* ════ TAB: VOTERS ════ */}
          {activeTab === "voters" && (
            <div className="card">
              <div className="ch">
                <div className="ci" style={{background:"rgba(52,211,153,.12)"}}>👥</div>
                <div><div className="ct">Registered Voters</div><div className="cs">{voters.length} total{voterLoading ? " · syncing…" : ""}</div></div>
              </div>

              {voterError && (
                <div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.25)",borderRadius:12,padding:"10px 14px",marginBottom:"1rem",fontSize:".8rem",color:"#f87171"}}>
                  ⚠ {voterError}
                </div>
              )}

              {voters.length === 0 ? (
                <div className="empty">{voterLoading ? "Loading voters…" : "No voters registered yet."}</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:"1rem"}}>
                  {voters.map((v) => (
                    <div key={v.name} style={{
                      background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",
                      borderRadius:16,padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:14
                    }}>
                      <div style={{
                        width:48,height:48,borderRadius:12,background:"rgba(99,102,241,.15)",
                        border:"1px solid rgba(99,102,241,.2)",flexShrink:0,overflow:"hidden",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20
                      }}>
                        {v.has_face
                          ? <img src={`http://localhost:5000/face-image/${encodeURIComponent(v.name)}`} alt={v.name}
                              style={{width:"100%",height:"100%",objectFit:"cover"}}
                              onError={(e) => { (e.target as HTMLElement).style.display="none"; (e.target as HTMLElement).parentElement!.innerHTML="👤"; }} />
                          : "👤"
                        }
                      </div>
                      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                        <div style={{fontSize:.9+"rem",fontWeight:600,color:"#f1f5f9",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.name}</div>
                        <div style={{fontSize:.75+"rem",color:"rgba(148,163,184,.55)",display:"flex",flexDirection:"column",gap:1,minWidth:0}}>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>📧 {v.email}</span>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>📞 {v.phone}</span>
                          {v.constituency && <span style={{color:"rgba(251,191,36,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>🏛️ {v.constituency}, {v.district}, {v.state}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>openEditVoter(v)}
                          style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.25)",borderRadius:8,color:"#818cf8",fontSize:12,cursor:"pointer",padding:"6px 10px",fontWeight:600,fontFamily:"inherit"}}>
                          ✏️
                        </button>
                        <button className="del-btn" onClick={()=>setConfirmDelVoter(v.name)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB: RESULTS ════ */}
          {activeTab === "results" && (
            <div className="card">
              <div className="ch">
                <div className="ci" style={{background:"rgba(251,191,36,.12)"}}>📊</div>
                <div><div className="ct">Election Results</div>
                  <div className="cs">{resultElectionId ? `Election #${resultElectionId}` : "Select an election"}</div>
                </div>
              </div>

              {elections.length > 0 && (
                <div className="elec-select-row" style={{marginBottom:"1.5rem"}}>
                  <span className="elec-select-lbl">Election</span>
                  <select className="elec-select-dd" value={resultElectionId??""} onChange={(e)=>{ const id=Number(e.target.value); setResultElectionId(id); loadResults(id); }}>
                    <option value="">— select —</option>
                    {elections.map((el)=><option key={el.id} value={el.id}>#{el.id} {el.name}</option>)}
                  </select>
                </div>
              )}

              {resultLoading && <div className="empty"><div style={{width:24,height:24,border:"2px solid rgba(255,255,255,.08)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin .65s linear infinite",margin:"0 auto 12px"}}/>Loading…</div>}

              {!resultLoading && !resultElectionId && (
                <div className="empty">Select an election above to view results.</div>
              )}

              {!resultLoading && resultElectionId && resultData && resultData.length === 0 && (
                <div className="empty">No candidates in this election.</div>
              )}

              {!resultLoading && resultData && resultData.length > 0 && (
                (() => {
                  const grouped: Record<string, ResultItem[]> = {};
                  resultData.forEach(r => {
                    const key = r.constituency;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(r);
                  });
                  return Object.entries(grouped).map(([constituency, candidates]) => {
                    const sorted = candidates.sort((a, b) => {
                    if (a.is_nota && !b.is_nota) return 1;
                    if (!a.is_nota && b.is_nota) return -1;
                    return b.votes - a.votes;
                  });
                    const totalVotes = sorted.reduce((s, c) => s + c.votes, 0);
                    const realCandidates = sorted.filter(c => !c.is_nota);
                    return (
                      <div key={constituency} style={{marginBottom:"1.5rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1rem"}}>
                          <div style={{width:34,height:34,borderRadius:10,background:"rgba(251,191,36,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏛️</div>
                          <div>
                            <div style={{fontSize:"1rem",fontWeight:700,color:"#fbbf24",fontFamily:"Syne,sans-serif"}}>{constituency}</div>
                            <div style={{fontSize:".72rem",color:"rgba(148,163,184,.45)"}}>{realCandidates.length} candidates · {totalVotes} votes</div>
                          </div>
                        </div>
                        {sorted.map((r, i) => (
                          <div key={r.name} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)", opacity: r.is_nota ? 0.7 : 1}}>
                            <div style={{width:44,height:44,borderRadius:10,flexShrink:0,overflow:"hidden",background: r.is_nota ? "rgba(239,68,68,.12)" : "rgba(99,102,241,.15)",border: r.is_nota ? "1px solid rgba(239,68,68,.2)" : "1px solid rgba(99,102,241,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                              {r.symbol
                                ? <img src={`http://localhost:5000/party_symbols/${r.symbol.split("/").pop()}`} alt={r.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                                : "🏛️"
                              }
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:.9+"rem",fontWeight:600,color: r.is_nota ? "#f87171" : "#f1f5f9"}}>{r.name}</div>
                              <div style={{fontSize:.75+"rem",color:"rgba(148,163,184,.5)"}}>{r.party}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:"1.2rem",fontWeight:800,color: r.is_nota ? "#f87171" : (i===0?"#fbbf24":"#a5b4fc"),fontFamily:"Syne,sans-serif"}}>{r.votes}</div>
                              <div style={{fontSize:.68+"rem",color:"rgba(148,163,184,.4)"}}>
                                {totalVotes > 0 ? Math.round(r.votes / totalVotes * 100) : 0}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          )}

          {/* ════ TAB: VOTES ════ */}
          {activeTab === "votes" && (
            <div className="grid2">
              <div className="card">
                <div className="ch">
                  <div className="ci" style={{background:"rgba(99,102,241,.15)"}}>📊</div>
                  <div><div className="ct">Vote Summary</div>
                    <div className="cs">{voteElectionId ? `Election #${voteElectionId}` : "Select an election"}</div>
                  </div>
                </div>

                {elections.length > 0 && (
                  <div className="elec-select-row" style={{marginBottom:"1.5rem"}}>
                    <span className="elec-select-lbl">Election</span>
                    <select className="elec-select-dd" value={voteElectionId??""} onChange={(e)=>{ const id=Number(e.target.value); setVoteElectionId(id); loadVotes(id); }}>
                      <option value="">— select —</option>
                      {elections.map((el)=><option key={el.id} value={el.id}>#{el.id} {el.name}</option>)}
                    </select>
                  </div>
                )}

                {voteElectionId && (
                  <>
                    <button className="btn btn-green" onClick={sendResultEmails} disabled={sendingEmail} style={{marginBottom:".75rem"}}>
                      {sendingEmail ? <><div className="spinner"/>Sending…</> : "📧 Send Result Emails to Voters"}
                    </button>
                    <button className="btn btn-blue" onClick={async () => {
                      setChainVerifying(true); setChainVerifyResult(null);
                      try {
                        const r = await fetch(`http://localhost:5000/verify-chain/${voteElectionId}`);
                        const d = await r.json();
                        setChainVerifyResult(d);
                      } catch { setChainVerifyResult({ valid: false, message: "Cannot reach backend", blocks: 0 }); }
                      finally { setChainVerifying(false); }
                    }} disabled={chainVerifying} style={{marginBottom:"1.25rem"}}>
                      {chainVerifying ? <><div className="spinner"/>Verifying…</> : "⛓️ Verify Blockchain Integrity"}
                    </button>
                    {chainVerifyResult && (
                      <div style={{
                        padding:"12px 16px",borderRadius:12,marginBottom:"1.25rem",
                        background: chainVerifyResult.valid ? "rgba(52,211,153,.08)" : "rgba(248,113,113,.08)",
                        border: `1px solid ${chainVerifyResult.valid ? "rgba(52,211,153,.25)" : "rgba(248,113,113,.25)"}`,
                        color: chainVerifyResult.valid ? "#34d399" : "#f87171",
                        fontSize:".82rem",display:"flex",alignItems:"center",gap:10
                      }}>
                        <span style={{fontSize:20}}>{chainVerifyResult.valid ? "✅" : "❌"}</span>
                        <div>
                          <strong>{chainVerifyResult.valid ? "Chain Verified" : "Chain Tampered"}</strong>
                          <div style={{fontSize:".72rem",opacity:.7,marginTop:2}}>
                            {chainVerifyResult.message} · {chainVerifyResult.blocks} block{(chainVerifyResult.blocks||0) !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!voteElectionId ? (
                  <div className="empty">Select an election above to view vote data.</div>
                ) : !voteData ? (
                  <div className="empty">Loading…</div>
                ) : voteData.total === 0 ? (
                  <div className="empty">No votes cast in this election yet.</div>
                ) : (
                  <>
                    <div style={{fontSize:".85rem",color:"rgba(148,163,184,.6)",marginBottom:"1rem"}}>
                      Total votes cast: <strong style={{color:"#f1f5f9"}}>{voteData.total}</strong>
                    </div>
                    {voteData.summary.map((s) => (
                      <div key={s.candidate_name} style={{
                        display:"flex",alignItems:"center",gap:12,
                        background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",
                        borderRadius:14,padding:".9rem 1.1rem",marginBottom:".6rem"
                      }}>
                        <div style={{
                          width:44,height:44,borderRadius:12,background:"rgba(99,102,241,.13)",
                          border:"1px solid rgba(99,102,241,.2)",flexShrink:0,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18
                        }}>🏛️</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:.9+"rem",fontWeight:600,color:"#f1f5f9"}}>{s.candidate_name}</div>
                          <div style={{fontSize:.75+"rem",color:"rgba(148,163,184,.5)"}}>{s.party}</div>
                          {s.constituency && <div style={{fontSize:.68+"rem",color:"rgba(251,191,36,.5)",marginTop:2}}>📍 {s.constituency}</div>}
                        </div>
                        <div style={{
                          background:"rgba(99,102,241,.15)",borderRadius:10,
                          padding:"4px 14px",fontSize:"1.1rem",fontWeight:800,color:"#a5b4fc"
                        }}>{s.count}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="card">
                <div className="ch">
                  <div className="ci" style={{background:"rgba(52,211,153,.12)"}}>📝</div>
                  <div><div className="ct">Voter Details</div>
                    <div className="cs">{voteData ? `${voteData.total} entries` : "—"}</div>
                  </div>
                </div>

                {elections.length > 0 && (
                  <div className="elec-select-row" style={{marginBottom:"1.5rem"}}>
                    <span className="elec-select-lbl">Election</span>
                    <select className="elec-select-dd" value={voteElectionId??""} onChange={(e)=>{ const id=Number(e.target.value); setVoteElectionId(id); loadVotes(id); }}>
                      <option value="">— select —</option>
                      {elections.map((el)=><option key={el.id} value={el.id}>#{el.id} {el.name}</option>)}
                    </select>
                  </div>
                )}

                {!voteElectionId ? (
                  <div className="empty">Select an election from the dropdown above to see voter details.</div>
                ) : !voteData || voteData.votes.length === 0 ? (
                  <div className="empty">{!voteData ? "Loading…" : "No votes yet."}</div>
                ) : (
                  <div style={{
                    maxHeight:500,
                    overflowY:"auto",
                    overflowX:"hidden",
                    boxSizing:"border-box",
                    width:"100%",
                    paddingRight:14,
                    scrollbarGutter:"stable",
                  }}>
                    {voteData.votes.map((v, i) => (
                      <div key={i} style={{
                        display:"flex",alignItems:"center",gap:10,
                        width:"100%",boxSizing:"border-box",
                        padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)",
                        fontSize:.85+"rem"
                      }}>
                        <div style={{
                          width:32,height:32,borderRadius:8,background:"rgba(99,102,241,.12)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:14,flexShrink:0,color:"#818cf8",fontWeight:700
                        }}>{i+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <span style={{color:"#f1f5f9",fontWeight:600,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.voter_name}</span>
                          {v.voted_at && <div style={{fontSize:.65+"rem",color:"rgba(148,163,184,.4)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🕐 {new Date(v.voted_at).toLocaleString()}</div>}
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,minWidth:0,maxWidth:"48%"}}>
                          {v.constituency && <div style={{fontSize:.65+"rem",color:"rgba(251,191,36,.4)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.constituency}</div>}
                          <div style={{color:"#a5b4fc",fontSize:.82+"rem",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.candidate_name}</div>
                          <div style={{fontSize:.7+"rem",color:"rgba(148,163,184,.45)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.party}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}