"use client";

import { useEffect, useState } from "react";
/* eslint-disable @next/next/no-img-element */

/* ══ Types ══════════════════════════════════════════════════ */
interface Result { id:number; name:string; party:string; symbol:string; constituency:string; votes:number; is_winner:boolean; is_tie:boolean; is_nota:boolean; }
interface ChainResult { valid:boolean; message:string; blocks:number; failed_block?:number; }
interface ConstituencyGroup { constituency:string; candidates:Result[]; totalVotes:number; }
interface ElectionInfo { id:number; name:string; start_time:string; end_time:string; status:"active"|"ended"|"upcoming"; results_expire_at?:string; }
interface ElectionResult {
  election:ElectionInfo;
  groups:ConstituencyGroup[];
  totalVotes:number;
  totalCandidates:number;
}

/* ══ Main ═══════════════════════════════════════════════════ */
export default function Results(){
  const [elections,setElections]     = useState<ElectionResult[]>([]);
  const [loading,setLoading]         = useState(true);
  const [lastRefresh,setLastRefresh] = useState<Date|null>(null);
  const [countdown,setCountdown]     = useState(3);
  const [activeTab,setActiveTab]     = useState<"active"|"ended">("active");
  const [chainStatus, setChainStatus] = useState<Record<number, ChainResult | "loading">>({});
  const [ethInfo, setEthInfo] = useState<{enabled:boolean; contract_address:string|null; explorer:string} | null>(null);

  const fetchAll = async () => {
    try {
      if (!ethInfo) {
        fetch("http://localhost:5000/ethereum-status").then(r => r.json()).then(d => setEthInfo(d)).catch(() => {});
      }
      const eRes = await fetch("http://localhost:5000/elections-public");
      const eData:ElectionInfo[] = await eRes.json();
      if(!Array.isArray(eData) || eData.length===0){ setLoading(false); return; }

      const results = await Promise.all(
        eData.filter(el => el.status === "active" || el.status === "ended").map(async (el) => {
          const rRes = await fetch(`http://localhost:5000/results/${el.id}`);
          const rData:Result[] = await rRes.json();
          if(!Array.isArray(rData)) return null;
          const grouped:Record<string,Result[]> = {};
          rData.forEach((r) => {
            const key = r.constituency;
            if(!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
          });
          const groups:ConstituencyGroup[] = Object.entries(grouped).map(([constituency, candidates]) => ({
            constituency,
            candidates: candidates.sort((a,b) => b.votes - a.votes),
            totalVotes: candidates.reduce((s,c) => s + c.votes, 0)
          }));
          return {
            election: el,
            groups,
            totalVotes: rData.reduce((s:number,r:Result) => s + r.votes, 0),
            totalCandidates: rData.length
          } as ElectionResult;
        })
      );

      setElections(results.filter(Boolean) as ElectionResult[]);
      setLastRefresh(new Date());
      const endedIds = (results.filter(Boolean) as ElectionResult[])
        .filter(er => er.election.status === "ended").map(er => er.election.id);
      endedIds.forEach(async (id) => {
        if (!chainStatus[id]) {
          try {
            const r = await fetch(`http://localhost:5000/verify-chain/${id}`);
            const d = await r.json();
            setChainStatus(p => ({ ...p, [id]: d }));
          } catch { /* silent */ }
        }
      });
    } catch{ /* silent */ }
    finally{ setLoading(false); }
  };

  useEffect(()=>{
    fetchAll();
    const interval=setInterval(fetchAll,3000);
    const tick=setInterval(()=>setCountdown(p=>p<=1?3:p-1),1000);
    return ()=>{ clearInterval(interval); clearInterval(tick); };
  },[]);

  const activeElections = elections.filter(er => er.election.status === "active");
  const endedElections  = elections.filter(er => er.election.status === "ended");

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#080c18}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes drift   {from{transform:translate(0,0)}to{transform:translate(40px,30px)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes pdot    {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes pulse   {0%{box-shadow:0 0 0 0 rgba(52,211,153,.4)}70%{box-shadow:0 0 0 10px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
        @keyframes crownBounce{0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)}}
        @keyframes winnerGlow{0%{box-shadow:0 0 0 0 rgba(251,191,36,.3)}50%{box-shadow:0 0 20px 4px rgba(251,191,36,.15)}100%{box-shadow:0 0 0 0 rgba(251,191,36,.3)}}
        @keyframes tieGlow{0%{box-shadow:0 0 0 0 rgba(249,115,22,.3)}50%{box-shadow:0 0 20px 4px rgba(249,115,22,.15)}100%{box-shadow:0 0 0 0 rgba(249,115,22,.3)}}

        .root{min-height:100vh;background:#080c18;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;padding:2.5rem 1rem 5rem;position:relative;overflow:hidden}
        .blob{position:fixed;border-radius:50%;filter:blur(100px);opacity:.09;pointer-events:none}
        .b1{width:650px;height:650px;background:radial-gradient(circle,#3b82f6,transparent);top:-200px;left:-150px;animation:drift 15s ease-in-out infinite alternate}
        .b2{width:500px;height:500px;background:radial-gradient(circle,#6366f1,transparent);bottom:-100px;right:-100px;animation:drift 19s ease-in-out infinite alternate-reverse}
        .grid-bg{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(59,130,246,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.03) 1px,transparent 1px);background-size:44px 44px}

        .inner{width:100%;max-width:880px;position:relative;z-index:1;opacity:0;animation:fadeUp .45s ease .05s forwards}

        .page-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:100px;padding:5px 14px 5px 9px;font-size:.68rem;color:#6ee7b7;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.25rem}
        .ldot{width:7px;height:7px;background:#34d399;border-radius:50%;box-shadow:0 0 8px #34d399;animation:pdot 2s ease-in-out infinite}
        .page-title{font-family:'Syne',sans-serif;font-size:2.2rem;font-weight:800;color:#f1f5f9;letter-spacing:-.03em;text-align:center;margin-bottom:.4rem}
        .page-title span{background:linear-gradient(135deg,#60a5fa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .page-sub{font-size:.88rem;color:rgba(148,163,184,.5);text-align:center;margin-bottom:2rem}

        .refresh-row{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:2rem}
        .refresh-tag{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:100px;padding:6px 14px;font-size:.72rem;color:rgba(148,163,184,.5)}
        .rtag-dot{width:6px;height:6px;background:#34d399;border-radius:50%;box-shadow:0 0 6px #34d399;animation:pdot 2s ease-in-out infinite}

        .tabs{display:flex;gap:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px;margin-bottom:1.75rem;width:fit-content}
        .tab{padding:9px 22px;border-radius:10px;font-size:.82rem;font-weight:600;cursor:pointer;border:none;background:transparent;color:rgba(148,163,184,.5);transition:all .2s;font-family:'DM Sans',sans-serif}
        .tab.active{background:rgba(99,102,241,.18);color:#a5b4fc;box-shadow:0 2px 8px rgba(99,102,241,.2)}
        .tab:hover:not(.active){color:rgba(148,163,184,.8)}

        .election-section{margin-bottom:3rem}
        .election-section:last-child{margin-bottom:0}

        .election-header{display:flex;align-items:center;gap:12px;margin-bottom:1.25rem}
        .election-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .election-name{font-family:'Syne',sans-serif;font-size:1.25rem;font-weight:700;letter-spacing:-.01em}

        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.25rem}
        .stat-card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:1.1rem 1.25rem;text-align:center}
        .stat-val{font-family:'Syne',sans-serif;font-size:1.75rem;font-weight:800;color:#f1f5f9;letter-spacing:-.02em}
        .stat-lbl{font-size:.7rem;color:rgba(148,163,184,.45);margin-top:3px;text-transform:uppercase;letter-spacing:.08em}

        .winner-banner{background:linear-gradient(135deg,rgba(251,191,36,.15),rgba(251,191,36,.05));border:1.5px solid rgba(251,191,36,.35);border-radius:22px;padding:1.75rem 2rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden;animation:winnerGlow 2s ease-in-out infinite}
        .winner-banner::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(251,191,36,.08),transparent);pointer-events:none}
        .winner-trophy{font-size:2.2rem;flex-shrink:0}
        .winner-sym{width:64px;height:64px;border-radius:14px;object-fit:cover;border:2px solid rgba(251,191,36,.4);flex-shrink:0;background:rgba(251,191,36,.15)}
        .winner-sym-ph{width:64px;height:64px;border-radius:14px;background:rgba(251,191,36,.15);border:2px solid rgba(251,191,36,.4);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
        .winner-info{flex:1}
        .winner-tag{font-size:.65rem;font-weight:600;color:#fbbf24;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
        .winner-name{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:#f1f5f9;margin-bottom:3px}
        .winner-party{font-size:.8rem;color:rgba(148,163,184,.5);margin-bottom:8px}
        .winner-votes{font-size:1.6rem;font-weight:800;color:#fbbf24;font-family:'Syne',sans-serif}
        .winner-votes span{font-size:.8rem;color:rgba(148,163,184,.4);font-weight:400;font-family:'DM Sans',sans-serif}

        .leader-card{background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(59,130,246,.06));border:1px solid rgba(99,102,241,.25);border-radius:22px;padding:1.75rem 2rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden}
        .leader-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(99,102,241,.06),transparent);pointer-events:none}
        .crown{font-size:2rem;animation:crownBounce 2s ease-in-out infinite;flex-shrink:0}
        .leader-sym{width:64px;height:64px;border-radius:14px;object-fit:cover;border:2px solid rgba(99,102,241,.3);flex-shrink:0;background:rgba(99,102,241,.15)}
        .leader-sym-ph{width:64px;height:64px;border-radius:14px;background:rgba(99,102,241,.15);border:2px solid rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
        .leader-info{flex:1}
        .leader-tag{font-size:.65rem;font-weight:600;color:#818cf8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
        .leader-name{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:#f1f5f9;margin-bottom:3px}
        .leader-party{font-size:.8rem;color:rgba(148,163,184,.5);margin-bottom:8px}
        .leader-votes{font-size:1.6rem;font-weight:800;color:#818cf8;font-family:'Syne',sans-serif}
        .leader-votes span{font-size:.8rem;color:rgba(148,163,184,.4);font-weight:400;font-family:'DM Sans',sans-serif}

        .results-card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:22px;padding:2rem;backdrop-filter:blur(20px);box-shadow:0 20px 48px rgba(0,0,0,.4)}
        .results-card.winner-card{border-color:rgba(251,191,36,.3);box-shadow:0 0 0 1px rgba(251,191,36,.1),0 20px 48px rgba(0,0,0,.4)}
        .ritem{margin-bottom:1.5rem}
        .ritem:last-child{margin-bottom:0}
        .ritem-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .ritem-sym{width:44px;height:44px;border-radius:10px;object-fit:cover;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);flex-shrink:0}
        .ritem-sym-ph{width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .ritem-name{font-size:.92rem;font-weight:700;color:#f1f5f9;flex:1}
        .ritem-party{font-size:.72rem;color:rgba(148,163,184,.45)}
        .ritem-count{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;color:#f1f5f9;flex-shrink:0}
        .ritem-count span{font-size:.72rem;color:rgba(148,163,184,.4);font-weight:400;font-family:'DM Sans',sans-serif;margin-left:3px}
        .bar-bg{height:8px;background:rgba(255,255,255,.05);border-radius:100px;overflow:hidden}
        .bar-fill{height:100%;border-radius:100px;transition:width .8s cubic-bezier(.34,1.1,.64,1);background:linear-gradient(90deg,#3b82f6,#6366f1)}
        .bar-fill.leader{background:linear-gradient(90deg,#34d399,#059669)}
        .bar-fill.winner-bar{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
        .pct-label{font-size:.68rem;color:rgba(148,163,184,.35);margin-top:4px;text-align:right}
        .rank-badge{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0}

        .winner-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);border-radius:100px;padding:2px 10px 2px 6px;font-size:.62rem;font-weight:700;color:#fbbf24;letter-spacing:.05em;text-transform:uppercase;margin-top:3px;width:fit-content}

        .tie-banner{background:linear-gradient(135deg,rgba(249,115,22,.15),rgba(249,115,22,.05));border:1.5px solid rgba(249,115,22,.35);border-radius:22px;padding:1.75rem 2rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden;animation:tieGlow 2s ease-in-out infinite}
        .tie-banner::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(249,115,22,.08),transparent);pointer-events:none}
        .tie-trophy{font-size:2.2rem;flex-shrink:0}
        .tie-info{flex:1}
        .tie-tag{font-size:.65rem;font-weight:600;color:#fb923c;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
        .tie-name{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;color:#f1f5f9;margin-bottom:3px}
        .tie-votes{font-size:1.3rem;font-weight:800;color:#fb923c;font-family:'Syne',sans-serif}
        .tie-votes span{font-size:.8rem;color:rgba(148,163,184,.4);font-weight:400;font-family:'DM Sans',sans-serif}

        .tie-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.3);border-radius:100px;padding:2px 10px 2px 6px;font-size:.62rem;font-weight:700;color:#fb923c;letter-spacing:.05em;text-transform:uppercase;margin-top:3px;width:fit-content}

        .draw-card{border-color:rgba(249,115,22,.3)!important;box-shadow:0 0 0 1px rgba(249,115,22,.1),0 20px 48px rgba(0,0,0,.4)!important}

        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;color:rgba(148,163,184,.4)}
        .big-spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,.08);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:1rem}
        .empty-icon{font-size:3rem;margin-bottom:1rem}

        .divider{height:1px;background:rgba(255,255,255,.06);margin:1.5rem 0}

        .back-link{display:inline-flex;align-items:center;gap:6px;color:rgba(148,163,184,.4);font-size:.8rem;text-decoration:none;margin-bottom:1.5rem;transition:color .2s}
        .back-link:hover{color:#a5b4fc}
        .spinner-btn{width:14px;height:14px;border:2px solid rgba(255,255,255,.15);border-top-color:#818cf8;border-radius:50%;animation:spin .65s linear infinite}
      `}</style>

      <div className="root">
        <div className="blob b1"/><div className="blob b2"/>
        <div className="grid-bg"/>

        <div className="inner">
          <a href="/" className="back-link">← Back to Home</a>

          <div style={{textAlign:"center"}}>
            <div className="page-badge" style={{display:"inline-flex"}}><span className="ldot"/>Election Results</div>
            <h1 className="page-title">Election <span>Results</span></h1>
            <p className="page-sub">{activeElections.length > 0 ? "Active results refresh every 3 seconds" : "View completed election results"}</p>
            {ethInfo?.enabled && (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:"-.5rem",marginBottom:"1rem",fontSize:".7rem",color:"rgba(148,163,184,.45)"}}>
                <span>⛓️ Ethereum Sepolia</span>
                <span style={{width:4,height:4,background:"rgba(148,163,184,.3)",borderRadius:"50%"}}/>
                <a href={`${ethInfo.explorer}/address/${ethInfo.contract_address}`} target="_blank" rel="noopener noreferrer"
                  style={{color:"#818cf8",textDecoration:"underline"}}>
                  Contract {ethInfo.contract_address?.slice(0,10)}...{ethInfo.contract_address?.slice(-6)}
                </a>
              </div>
            )}
          </div>

          <div className="refresh-row">
            <div className="refresh-tag">
              <span className="rtag-dot"/>
              {activeElections.length > 0 ? `Live · refreshing in ${countdown}s` : "Final"}
              {lastRefresh && (
                <span style={{marginLeft:6,opacity:.6}}>· {lastRefresh.toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {loading && (
            <div className="center-state"><div className="big-spinner"/>Loading results…</div>
          )}

          {!loading && elections.length === 0 && (
            <div className="results-card">
              <div className="center-state">
                <div className="empty-icon">🗓️</div>
                <div style={{fontWeight:600,color:"rgba(148,163,184,.6)",marginBottom:6}}>No Elections</div>
                <div style={{fontSize:".8rem"}}>There are no election results to display.</div>
              </div>
            </div>
          )}

          {activeElections.length > 0 && endedElections.length > 0 && (
            <div className="tabs">
              <button className={`tab ${activeTab==="active"?"active":""}`} onClick={()=>setActiveTab("active")}>
                🔴 Live ({activeElections.length})
              </button>
              <button className={`tab ${activeTab==="ended"?"active":""}`} onClick={()=>setActiveTab("ended")}>
                🏁 Completed ({endedElections.length})
              </button>
            </div>
          )}

          {/* ── Active Elections ── */}
          {activeTab === "active" && activeElections.map((er) => {
            const allC = er.groups.flatMap(g => g.candidates).sort((a,b) => b.votes - a.votes);
            const realCandidates = allC.filter(c => !c.is_nota);
            const leader = realCandidates[0];
            const topVotes = leader?.votes ?? 0;
            const tiedLeaders = realCandidates.filter(c => c.votes === topVotes && topVotes > 0);
            const isGlobalTie = tiedLeaders.length > 1;
            return (
              <div key={er.election.id} className="election-section">
                <div className="election-header">
                  <div className="election-icon" style={{background:"rgba(52,211,153,.1)",border:"1px solid rgba(52,211,153,.2)"}}>🔴</div>
                  <div className="election-name" style={{color:"#34d399"}}>{er.election.name}</div>
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:".65rem",color:"rgba(148,163,184,.35)"}}>⛓️ Blockchain</span>
                    {chainStatus[er.election.id] === "loading" && <div className="spinner-btn" />}
                    {chainStatus[er.election.id] && chainStatus[er.election.id] !== "loading" && (
                      <span style={{fontSize:".7rem",color:(chainStatus[er.election.id] as ChainResult).valid ? "#34d399" : "#f87171",fontWeight:600}}>
                        {(chainStatus[er.election.id] as ChainResult).valid ? "✓ Verified" : "✕ Tampered"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="stats">
                  <div className="stat-card"><div className="stat-val">{er.totalCandidates - er.groups.flatMap(g => g.candidates).filter(c => c.is_nota).length}</div><div className="stat-lbl">Candidates</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color:"#34d399"}}>{er.totalVotes}</div><div className="stat-lbl">Total Votes</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color: isGlobalTie ? "#fb923c" : "#fbbf24"}}>{topVotes}</div><div className="stat-lbl">{isGlobalTie ? "Tied Votes" : "Leading Votes"}</div></div>
                </div>

                {leader && er.totalVotes > 0 && isGlobalTie && (
                  <div className="tie-banner">
                    <div className="tie-trophy">🤝</div>
                    <div className="tie-info">
                      <div className="tie-tag">Tied for Lead</div>
                      <div className="tie-name">{tiedLeaders.map(c => `${c.name} (${c.party})`).join(" vs ")}</div>
                      <div className="tie-votes">{topVotes}<span>votes each</span></div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"Syne,sans-serif",fontSize:"2rem",fontWeight:800,color:"#fb923c"}}>
                        {er.totalVotes>0 ? Math.round(topVotes/er.totalVotes*100) : 0}%
                      </div>
                      <div style={{fontSize:".72rem",color:"rgba(148,163,184,.4)"}}>of total votes each</div>
                    </div>
                  </div>
                )}

                {leader && er.totalVotes > 0 && !isGlobalTie && (
                  <div className="leader-card">
                    <div className="crown">👑</div>
                    {leader.symbol
                      ? <img src={`http://localhost:5000/party_symbols/${leader.symbol.split("/").pop()}`} alt={leader.name} className="leader-sym"/>
                      : <div className="leader-sym-ph">🏛️</div>
                    }
                    <div className="leader-info">
                      <div className="leader-tag">Current Leader</div>
                      <div className="leader-name">{leader.name}</div>
                      <div className="leader-party">{leader.party}</div>
                      <div className="leader-votes">{leader.votes}<span>votes</span></div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"Syne,sans-serif",fontSize:"2rem",fontWeight:800,color:"#34d399"}}>
                        {er.totalVotes>0 ? Math.round(leader.votes/er.totalVotes*100) : 0}%
                      </div>
                      <div style={{fontSize:".72rem",color:"rgba(148,163,184,.4)"}}>of total votes</div>
                    </div>
                  </div>
                )}

                {er.groups.length === 0 ? (
                  <div className="results-card">
                    <div className="center-state">
                      <div className="empty-icon">📊</div>
                      <div style={{fontWeight:600,color:"rgba(148,163,184,.6)",marginBottom:6}}>No candidates yet</div>
                      <div style={{fontSize:".8rem"}}>Results will appear here as votes come in.</div>
                    </div>
                  </div>
                ) : (
                  er.groups.map((g) => {
                    const maxVotes = g.candidates[0]?.votes ?? 0;
                    const conTiedCount = g.candidates.filter(c => c.votes === maxVotes && maxVotes > 0).length;
                    const isConTie = conTiedCount > 1;
                    return (
                    <div key={g.constituency} className={`results-card ${isConTie ? "draw-card" : ""}`} style={{marginBottom:"1.25rem"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:"1rem",marginBottom:"1rem",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                        <div style={{width:34,height:34,borderRadius:10,background: isConTie ? "rgba(249,115,22,.12)" : "rgba(251,191,36,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏛️</div>
                        <div>
                          <div style={{fontSize:"1rem",fontWeight:700,color: isConTie ? "#fb923c" : "#fbbf24",fontFamily:"Syne,sans-serif"}}>{g.constituency}</div>
                          <div style={{fontSize:".72rem",color:"rgba(148,163,184,.45)"}}>{g.candidates.length} candidates · {g.totalVotes} votes {isConTie && "· TIED"}</div>
                        </div>
                      </div>
                      {g.candidates.map((r,i) => {
                        const pct = g.totalVotes > 0 ? Math.round(r.votes / g.totalVotes * 100) : 0;
                        const isCandidateLeader = !r.is_nota && r.votes === maxVotes && maxVotes > 0;
                        const rankColors = ["#fbbf24","#94a3b8","#b87333"];
                        return (
                          <div key={r.name} className="ritem">
                            <div className="ritem-top">
                              {r.is_nota ? (
                                <div className="rank-badge" style={{background:"rgba(239,68,68,.12)",color:"#f87171",border:"1px solid rgba(239,68,68,.25)"}}>
                                  ✕
                                </div>
                              ) : (
                                <div className="rank-badge" style={{background: i<3?`${rankColors[i]}18`:"rgba(255,255,255,.05)",color:i<3?rankColors[i]:"rgba(148,163,184,.4)",border:`1px solid ${i<3?rankColors[i]+"33":"rgba(255,255,255,.07)"}`}}>
                                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                                </div>
                              )}
                              {r.symbol ? <img src={`http://localhost:5000/party_symbols/${r.symbol.split("/").pop()}`} alt={r.name} className="ritem-sym"/> : <div className="ritem-sym-ph">🏛️</div>}
                              <div style={{flex:1}}>
                                <div className="ritem-name">{r.name}</div>
                                <div className="ritem-party">{r.party}</div>
                                {isConTie && isCandidateLeader && <div className="tie-badge">🤝 Tied</div>}
                              </div>
                              <div className="ritem-count">{r.votes}<span>votes</span></div>
                            </div>
                            <div className="bar-bg">
                              <div className={`bar-fill ${isCandidateLeader && !isConTie?"leader":""}`} style={{width:`${Math.max(pct,r.votes>0?3:0)}%`, background: r.is_nota ? "linear-gradient(90deg,#ef4444,#b91c1c)" : isConTie && isCandidateLeader ? "linear-gradient(90deg,#fb923c,#f97316)" : undefined}}/>
                            </div>
                            <div className="pct-label">{pct}%</div>
                            {i<g.candidates.length-1 && <div className="divider" style={{margin:"1.25rem 0 0"}}/>}
                          </div>
                        );
                      })}
                    </div>
                  )})
                )}
              </div>
            );
          })}

          {activeTab === "active" && activeElections.length === 0 && !loading && (
            <div className="results-card">
              <div className="center-state">
                <div className="empty-icon">🔴</div>
                <div style={{fontWeight:600,color:"rgba(148,163,184,.6)",marginBottom:6}}>No Active Elections</div>
                <div style={{fontSize:".8rem"}}>Check the Completed tab for past election results.</div>
              </div>
            </div>
          )}

          {/* ── Ended Elections ── */}
          {activeTab === "ended" && endedElections.map((er) => {
            const now = new Date();
            const expireAt = er.election.results_expire_at ? new Date(er.election.results_expire_at) : null;
            const daysLeft = expireAt ? Math.max(0, Math.ceil((expireAt.getTime() - now.getTime()) / (1000*60*60*24))) : null;
            return (
              <div key={er.election.id} className="election-section">
                <div className="election-header">
                  <div className="election-icon" style={{background:"rgba(148,163,184,.08)",border:"1px solid rgba(148,163,184,.15)"}}>🏁</div>
                  <div className="election-name" style={{color:"#94a3b8"}}>{er.election.name}</div>
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:".65rem",color:"rgba(148,163,184,.35)"}}>⛓️ Blockchain</span>
                    {chainStatus[er.election.id] === "loading" && <div className="spinner-btn" />}
                    {chainStatus[er.election.id] && chainStatus[er.election.id] !== "loading" && (
                      <span style={{fontSize:".7rem",color:(chainStatus[er.election.id] as ChainResult).valid ? "#34d399" : "#f87171",fontWeight:600}}>
                        {(chainStatus[er.election.id] as ChainResult).valid ? "✓ Verified" : "✕ Tampered"}
                      </span>
                    )}
                  </div>
                </div>

                {daysLeft !== null && (
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)",borderRadius:10,marginBottom:"1rem",fontSize:".72rem",color:"rgba(251,191,36,.7)"}}>
                    📊 Results will be available for {daysLeft} more day(s) (until {expireAt!.toLocaleDateString()})
                  </div>
                )}

                <div className="stats">
                  <div className="stat-card"><div className="stat-val">{er.totalCandidates - er.groups.flatMap(g => g.candidates).filter(c => c.is_nota).length}</div><div className="stat-lbl">Candidates</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color:"#34d399"}}>{er.totalVotes}</div><div className="stat-lbl">Total Votes</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color:"#fbbf24"}}>{er.groups.reduce((s,g) => { const rc = g.candidates.filter(c=>!c.is_nota); return s + (rc[0]?.votes||0); }, 0)}</div><div className="stat-lbl">Winning Votes</div></div>
                </div>

                {er.groups.length === 0 ? (
                  <div className="results-card">
                    <div className="center-state">
                      <div className="empty-icon">📊</div>
                      <div style={{fontWeight:600,color:"rgba(148,163,184,.6)",marginBottom:6}}>No candidates</div>
                    </div>
                  </div>
                ) : (
                  er.groups.map((g) => {
                    const realCandidates = g.candidates.filter(c => !c.is_nota);
                    const topCandidate = realCandidates[0];
                    const maxVotes = topCandidate?.votes ?? 0;
                    const tiedWinners = realCandidates.filter(c => c.votes === maxVotes && maxVotes > 0);
                    const isDraw = tiedWinners.length > 1;
                    const rankColors = ["#fbbf24","#94a3b8","#b87333"];
                    const realCount = realCandidates.length;
                    return (
                      <div key={g.constituency} className={`results-card ${isDraw ? "draw-card" : (topCandidate && topCandidate.votes > 0 ? "winner-card" : "")}`} style={{marginBottom:"1.25rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:"1rem",marginBottom:"1rem",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                          <div style={{width:34,height:34,borderRadius:10,background: isDraw ? "rgba(249,115,22,.12)" : "rgba(251,191,36,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏛️</div>
                          <div>
                            <div style={{fontSize:"1rem",fontWeight:700,color: isDraw ? "#fb923c" : "#fbbf24",fontFamily:"Syne,sans-serif"}}>{g.constituency}</div>
                            <div style={{fontSize:".72rem",color:"rgba(148,163,184,.45)"}}>{realCount} candidates · {g.totalVotes} votes {isDraw && "· DRAW"}</div>
                          </div>
                        </div>
                        {isDraw && maxVotes > 0 && (
                          <div className="tie-banner">
                            <div className="tie-trophy">🤝</div>
                            <div className="tie-info">
                              <div className="tie-tag">Draw — {g.constituency}</div>
                              <div className="tie-name">{tiedWinners.map(c => `${c.name} (${c.party})`).join(" vs ")}</div>
                              <div className="tie-votes">{maxVotes}<span>votes each</span></div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontFamily:"Syne,sans-serif",fontSize:"2rem",fontWeight:800,color:"#fb923c"}}>
                                {g.totalVotes>0 ? Math.round(maxVotes/g.totalVotes*100) : 0}%
                              </div>
                              <div style={{fontSize:".72rem",color:"rgba(148,163,184,.4)"}}>of constituency votes each</div>
                            </div>
                          </div>
                        )}
                        {!isDraw && topCandidate && topCandidate.votes > 0 && (
                          <div className="winner-banner">
                            <div className="winner-trophy">🏆</div>
                            {topCandidate.symbol
                              ? <img src={`http://localhost:5000/party_symbols/${topCandidate.symbol.split("/").pop()}`} alt={topCandidate.name} className="winner-sym"/>
                              : <div className="winner-sym-ph">🏛️</div>
                            }
                            <div className="winner-info">
                              <div className="winner-tag">🏆 Winner — {g.constituency}</div>
                              <div className="winner-name">{topCandidate.name}</div>
                              <div className="winner-party">{topCandidate.party}</div>
                              <div className="winner-votes">{topCandidate.votes}<span>votes</span></div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontFamily:"Syne,sans-serif",fontSize:"2rem",fontWeight:800,color:"#fbbf24"}}>
                                {g.totalVotes>0 ? Math.round(topCandidate.votes/g.totalVotes*100) : 0}%
                              </div>
                              <div style={{fontSize:".72rem",color:"rgba(148,163,184,.4)"}}>of constituency votes</div>
                            </div>
                          </div>
                        )}
                        {g.candidates.map((r,i) => {
                          const pct = g.totalVotes > 0 ? Math.round(r.votes / g.totalVotes * 100) : 0;
                          const isCandidateWinner = !r.is_nota && r.votes === maxVotes && maxVotes > 0;
                          return (
                            <div key={r.name} className="ritem">
                              <div className="ritem-top">
                                {r.is_nota ? (
                                  <div className="rank-badge" style={{background:"rgba(239,68,68,.12)",color:"#f87171",border:"1px solid rgba(239,68,68,.25)"}}>
                                    ✕
                                  </div>
                                ) : (
                                  <div className="rank-badge" style={{background:i<3?`${rankColors[i]}18`:"rgba(255,255,255,.05)",color:i<3?rankColors[i]:"rgba(148,163,184,.4)",border:`1px solid ${i<3?rankColors[i]+"33":"rgba(255,255,255,.07)"}`}}>
                                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                                  </div>
                                )}
                                {r.symbol ? <img src={`http://localhost:5000/party_symbols/${r.symbol.split("/").pop()}`} alt={r.name} className="ritem-sym"/> : <div className="ritem-sym-ph">🏛️</div>}
                                <div style={{flex:1}}>
                                  <div className="ritem-name">{r.name}</div>
                                  <div className="ritem-party">{r.party}</div>
                                  {isCandidateWinner && !isDraw && <div className="winner-badge">🏆 Winner</div>}
                                  {isCandidateWinner && isDraw && <div className="tie-badge">🤝 Tied</div>}
                                </div>
                                <div className="ritem-count">{r.votes}<span>votes</span></div>
                              </div>
                              <div className="bar-bg">
                                <div className={`bar-fill ${isCandidateWinner && !isDraw?"winner-bar":""}`} style={{width:`${Math.max(pct,r.votes>0?3:0)}%`, background: r.is_nota ? "linear-gradient(90deg,#ef4444,#b91c1c)" : isDraw && isCandidateWinner ? "linear-gradient(90deg,#fb923c,#f97316)" : undefined}}/>
                              </div>
                              <div className="pct-label">{pct}%</div>
                              {i<g.candidates.length-1 && <div className="divider" style={{margin:"1.25rem 0 0"}}/>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          {activeTab === "ended" && endedElections.length === 0 && !loading && (
            <div className="results-card">
              <div className="center-state">
                <div className="empty-icon">🏁</div>
                <div style={{fontWeight:600,color:"rgba(148,163,184,.6)",marginBottom:6}}>No Completed Elections</div>
                <div style={{fontSize:".8rem"}}>Completed election results will appear here.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
