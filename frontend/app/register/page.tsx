"use client";

import { useEffect, useRef, useState } from "react";

/* ══ Toast ═════════════════════════════════════════════════ */
type TT="success"|"error"|"info"|"warning";
interface Toast{id:number;type:TT;title:string;msg:string;}
let _tid=0,_add:((t:Omit<Toast,"id">)=>void)|null=null;
function toast(type:TT,title:string,msg=""){_add?.({type,title,msg});}
function ToastBox(){
  const [list,setList]=useState<Toast[]>([]);
  useEffect(()=>{
    _add=(t)=>{const id=++_tid;setList(p=>[...p,{...t,id}]);setTimeout(()=>setList(p=>p.filter(x=>x.id!==id)),4200);};
    return ()=>{_add=null;};
  },[]);
  const clr:Record<TT,string>={success:"#34d399",error:"#f87171",warning:"#fbbf24",info:"#60a5fa"};
  const ic:Record<TT,string>={success:"✓",error:"✕",warning:"⚠",info:"ℹ"};
  return(
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
      {list.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:12,background:"rgba(9,12,22,.97)",border:`1px solid ${clr[t.type]}44`,borderRadius:14,padding:"13px 18px",minWidth:280,maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,.55)",animation:"tIn .3s cubic-bezier(.34,1.56,.64,1)",pointerEvents:"auto"}}>
          <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:`${clr[t.type]}1a`,color:clr[t.type]}}>{ic[t.type]}</div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9",marginBottom:2}}>{t.title}</div>
            {t.msg&&<div style={{fontSize:12,color:"rgba(241,245,249,.45)",lineHeight:1.5}}>{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══ Step dot ═══════════════════════════════════════════════ */
function SDot({n,active,done}:{n:number;active:boolean;done:boolean}){
  return(
    <div style={{width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:done?"linear-gradient(135deg,#34d399,#059669)":active?"linear-gradient(135deg,#3b82f6,#6366f1)":"rgba(255,255,255,.05)",border:!done&&!active?"1.5px solid rgba(255,255,255,.1)":"none",color:done||active?"#fff":"rgba(255,255,255,.3)",boxShadow:active?"0 4px 16px rgba(99,102,241,.4)":"none",transition:"all .3s"}}>
      {done?"✓":n}
    </div>
  );
}

/* ══ Main ═══════════════════════════════════════════════════ */
export default function Register(){
  const videoRef=useRef<HTMLVideoElement>(null);
  const [name,setName]     = useState("");
  const [email,setEmail]   = useState("");
  const [phone,setPhone]   = useState("");
  const [state,setState]   = useState("");
  const [district,setDistrict] = useState("");
  const [constituency,setConstituency] = useState("");
  const [loading,setLoading]  = useState(false);
  const [cameraOn,setCameraOn]= useState(false);
  const [done,setDone]        = useState(false);
  const [flash,setFlash]      = useState(false);
  const [livenessMsg,setLivenessMsg] = useState("");

  useEffect(()=>{
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const startCamera=()=>{
    navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{
      if(videoRef.current)videoRef.current.srcObject=stream;
      setCameraOn(true);
    }).catch(()=>toast("error","Camera denied","Please allow camera access and reload."));
  };

  const stopCamera=()=>{
    const s=videoRef.current?.srcObject as MediaStream;
    s?.getTracks().forEach(t=>t.stop());
    setCameraOn(false);
  };

  const register=async()=>{
    if(!name.trim()||!email.trim()||!phone.trim()||!state.trim()||!district.trim()||!constituency.trim()){toast("warning","Missing fields","Fill in all fields including your location.");return;}
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if(!emailRegex.test(email.trim())){toast("error","Invalid email","Please enter a valid email like name@example.com.");return;}
    const phoneDigits = phone.replace(/\D/g, "");
    const last10 = phoneDigits.slice(-10);
    if(!(phoneDigits.length >= 10 && phoneDigits.length <= 15) || !/^[6-9]\d{9}$/.test(last10)){toast("error","Invalid phone","Please enter a valid 10-digit Indian mobile number (starting with 6-9).");return;}
    if(!videoRef.current){toast("error","Camera not ready");return;}

    setLoading(true);
    setLivenessMsg("Capturing frames for liveness check...");

    try{
      const TARGET = 6;
      const frames: string[] = [];
      for (let i = 0; i < TARGET; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
          toast("error", "Camera not ready", "Camera lost during capture. Please try again.");
          setLoading(false);
          setLivenessMsg("");
          return;
        }
        const c = document.createElement("canvas");
        c.width = videoRef.current.videoWidth;
        c.height = videoRef.current.videoHeight;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(videoRef.current, 0, 0);
        const data = c.toDataURL("image/jpeg", 0.9);
        if (data && data !== "data:,") frames.push(data);
      }

      if (frames.length < 4) {
        toast("error", "Capture failed", "Could not capture enough frames. Please try again.");
        setLoading(false);
        setLivenessMsg("");
        return;
      }

      setLivenessMsg("Analyzing liveness...");
      const livenessRes = await fetch("http://localhost:5000/liveness-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, challenge_type: "passive", passive_only: true }),
      });
      const livenessResult = await livenessRes.json();

      if (!livenessResult.passed) {
        setLivenessMsg("");
        setLoading(false);
        toast("error", "Liveness check failed", "Please ensure you are in front of the camera. No photos or screens allowed.");
        return;
      }

      setLivenessMsg("Liveness verified! Registering...");
      setFlash(true); setTimeout(()=>setFlash(false),350);

      const lastFrame = frames[frames.length - 1];
      const res=await fetch("http://localhost:5000/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,phone,state,district,constituency,image:lastFrame,liveness_token:livenessResult.liveness_token||""})});
      const d=await res.json();
      if(res.ok){
        toast("success","Registered!",`Welcome, ${name}. Your face is saved.`);
        setDone(true); stopCamera();
      } else {
        toast("error","Failed",d.message||"Registration failed.");
      }
    }catch{toast("error","Network error","Cannot reach backend.");}
    finally{setLoading(false);setLivenessMsg("");}
  };

  const resetForm=()=>{
    setName(""); setEmail(""); setPhone(""); setState(""); setDistrict(""); setConstituency("");
    setDone(false); setLivenessMsg(""); setFlash(false);
    startCamera();
  };

  const fieldsOk=!!(name&&email&&phone&&state&&district&&constituency);

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#080c18}
        @keyframes tIn      {from{opacity:0;transform:scale(.88) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeUp   {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes drift    {from{transform:translate(0,0)}to{transform:translate(40px,30px)}}
        @keyframes spin     {to{transform:rotate(360deg)}}
        @keyframes flash    {0%{opacity:0}30%{opacity:.9}100%{opacity:0}}
        @keyframes bounce   {0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes scan     {0%,100%{top:10%}50%{top:85%}}
        @keyframes pdot     {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}

        .root{min-height:100vh;background:#080c18;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;position:relative;overflow:hidden}
        .blob{position:fixed;border-radius:50%;filter:blur(100px);opacity:.09;pointer-events:none}
        .b1{width:600px;height:600px;background:radial-gradient(circle,#3b82f6,transparent);top:-200px;left:-150px;animation:drift 15s ease-in-out infinite alternate}
        .b2{width:500px;height:500px;background:radial-gradient(circle,#6366f1,transparent);bottom:-100px;right:-100px;animation:drift 19s ease-in-out infinite alternate-reverse}
        .grid-bg{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(59,130,246,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.03) 1px,transparent 1px);background-size:44px 44px}

        .card{width:100%;max-width:980px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:24px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);display:grid;grid-template-columns:1fr 1fr;position:relative;z-index:1;opacity:0;animation:fadeUp .5s ease .1s forwards}
        @media(max-width:700px){.card{grid-template-columns:1fr}}

        /* left */
        .left{padding:2.5rem 2rem;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column}
        .badge{display:inline-flex;align-items:center;gap:7px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:100px;padding:5px 14px 5px 9px;font-size:.68rem;color:#93c5fd;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.5rem}
        .bdot{width:7px;height:7px;background:#3b82f6;border-radius:50%;box-shadow:0 0 8px #3b82f6;animation:pdot 2s ease-in-out infinite}
        .title{font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:#f1f5f9;letter-spacing:-.025em;margin-bottom:.5rem;line-height:1.1}
        .title span{background:linear-gradient(135deg,#60a5fa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .sub{font-size:.85rem;color:rgba(148,163,184,.5);line-height:1.65;margin-bottom:2rem}

        /* steps */
        .steps{display:flex;align-items:center;gap:0;margin-bottom:2rem}
        .step-line{flex:1;height:1.5px;background:rgba(255,255,255,.06)}
        .step-line.done{background:linear-gradient(90deg,#34d399,#059669)}

        /* fields */
        .field{margin-bottom:1rem}
        .fl{display:block;font-size:.7rem;font-weight:600;color:rgba(148,163,184,.6);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
        .iw{display:flex;align-items:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,box-shadow .2s,background .2s}
        .iw:focus-within{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.06);box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .ii{padding:0 12px;font-size:16px;color:rgba(148,163,184,.3);flex-shrink:0;transition:color .2s}
        .iw:focus-within .ii{color:#818cf8}
        .iw input{flex:1;background:transparent;border:none;outline:none;color:#f1f5f9;font-size:14px;padding:.75rem .75rem .75rem 0;font-family:inherit}
        .iw input::placeholder{color:rgba(148,163,184,.25)}

        /* button */
        .btn{width:100%;padding:.9rem;border:none;border-radius:12px;font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:.5rem;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,box-shadow .15s,opacity .15s;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 4px 20px rgba(99,102,241,.3)}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(99,102,241,.45)}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite}

        /* right / camera */
        .right{padding:2.5rem 2rem;background:rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:center}
        .cam-wrap{position:relative;width:100%;max-width:340px;border-radius:20px;overflow:hidden;border:2px solid rgba(255,255,255,.08);box-shadow:0 12px 40px rgba(0,0,0,.5)}
        .cam-wrap video{width:100%;display:block;background:#000;aspect-ratio:4/3;object-fit:cover}
        .cc{position:absolute;width:24px;height:24px;border-color:#6366f1;border-style:solid;border-width:0}
        .tl{top:12px;left:12px;border-top-width:2.5px;border-left-width:2.5px;border-radius:4px 0 0 0}
        .tr{top:12px;right:12px;border-top-width:2.5px;border-right-width:2.5px;border-radius:0 4px 0 0}
        .bl{bottom:12px;left:12px;border-bottom-width:2.5px;border-left-width:2.5px;border-radius:0 0 0 4px}
        .br{bottom:12px;right:12px;border-bottom-width:2.5px;border-right-width:2.5px;border-radius:0 0 4px 0}
        .scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#6366f1,#3b82f6,transparent);animation:scan 2.5s ease-in-out infinite;opacity:.7}
        .flash-el{position:absolute;inset:0;background:#fff;pointer-events:none;opacity:0;border-radius:20px;animation:flash .35s ease forwards}
        .cam-status{margin-top:1rem;font-size:.75rem;font-weight:500;display:flex;align-items:center;gap:7px;color:rgba(148,163,184,.45)}
        .cdot{width:7px;height:7px;border-radius:50%}
        .cdot.on{background:#34d399;box-shadow:0 0 8px #34d399;animation:pdot 2s ease-in-out infinite}
        .cdot.off{background:#6b7280}

        /* success */
        .success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5rem 2rem;text-align:center;gap:1.25rem}
        .sicon{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;font-size:36px;animation:bounce .5s cubic-bezier(.34,1.56,.64,1);box-shadow:0 8px 32px rgba(52,211,153,.35)}
        .stitle{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#f1f5f9}
        .ssub{font-size:.88rem;color:rgba(148,163,184,.5);max-width:260px;line-height:1.65}
        .goto{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:12px;padding:.8rem 1.75rem;font-family:'Syne',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;text-decoration:none;box-shadow:0 4px 20px rgba(99,102,241,.35);transition:transform .15s,box-shadow .15s}
        .goto:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(99,102,241,.5)}
      `}</style>

      <ToastBox/>

      <div className="root">
        <div className="blob b1"/><div className="blob b2"/>
        <div className="grid-bg"/>

        <div className="card">
          {/* LEFT */}
          <div className="left">
            <div className="badge"><span className="bdot"/>Voter Registration</div>
            <h1 className="title">Register your<br/><span>identity</span></h1>
            <p className="sub">Fill your details and capture a clear face photo. Your photo is stored securely on the election server and used only to verify your identity when you vote.</p>

            <div className="steps">
              <SDot n={1} active={!fieldsOk} done={fieldsOk}/>
              <div className={`step-line ${fieldsOk?"done":""}`}/>
              <SDot n={2} active={fieldsOk&&!done} done={done}/>
              <div className={`step-line ${done?"done":""}`}/>
              <SDot n={3} active={false} done={done}/>
            </div>

            <div className="field">
              <label className="fl">Full Name</label>
              <div className="iw"><span className="ii">👤</span>
                <input placeholder="e.g. Raghavendra" value={name} onChange={e=>setName(e.target.value)}/>
              </div>
            </div>
            <div className="field">
              <label className="fl">Email Address</label>
              <div className="iw"><span className="ii">✉️</span>
                <input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
              </div>
            </div>
            <div className="field">
              <label className="fl">Phone Number</label>
              <div className="iw"><span className="ii">📱</span>
                <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)}/>
              </div>
            </div>

            <div className="field">
              <label className="fl">State</label>
              <div className="iw"><span className="ii">🗺️</span>
                <input placeholder="e.g. Maharashtra" value={state} onChange={e=>setState(e.target.value)}/>
              </div>
            </div>
            <div className="field">
              <label className="fl">District</label>
              <div className="iw"><span className="ii">📍</span>
                <input placeholder="e.g. Pune" value={district} onChange={e=>setDistrict(e.target.value)}/>
              </div>
            </div>
            <div className="field">
              <label className="fl">Constituency</label>
              <div className="iw"><span className="ii">🏛️</span>
                <input placeholder="e.g. Pune North" value={constituency} onChange={e=>setConstituency(e.target.value)}/>
              </div>
            </div>

            <button className="btn" onClick={register} disabled={loading||!cameraOn||done}>
              {loading?<><div className="spinner"/>{livenessMsg||"Processing..."}</>:done?"✓ Registered":"📸 Capture & Register"}
            </button>
          </div>

          {/* RIGHT */}
          <div className="right">
            {done?(
              <div className="success">
                <div className="sicon">✓</div>
                <div className="stitle">You're registered!</div>
                <div className="ssub">Your face has been captured and saved. You can now cast your vote.</div>
                <a href="/vote" className="goto">Go to Vote →</a>
                <button className="goto" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",marginTop:8}} onClick={resetForm}>👤 Register Another</button>
              </div>
            ):(
              <>
                <div className="cam-wrap">
                  <video ref={videoRef} autoPlay muted playsInline/>
                  <div className="cc tl"/><div className="cc tr"/>
                  <div className="cc bl"/><div className="cc br"/>
                  {cameraOn&&<div className="scan-line"/>}
                  {flash&&<div className="flash-el"/>}
                </div>
                <div className="cam-status">
                  <span className={`cdot ${cameraOn?"on":"off"}`}/>
                  {livenessMsg || (cameraOn?"Camera live — look straight ahead":"Waiting for camera…")}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}