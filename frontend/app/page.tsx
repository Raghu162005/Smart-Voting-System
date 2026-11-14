"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .home-root {
          min-height: 100vh;
          background: #0a0f1e;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* BLOBS */
        .blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.15; pointer-events: none; }
        .blob-1 { width: 700px; height: 700px; background: radial-gradient(circle, #3b82f6, transparent); top: -200px; left: -200px; animation: drift 16s ease-in-out infinite alternate; }
        .blob-2 { width: 500px; height: 500px; background: radial-gradient(circle, #6366f1, transparent); bottom: -100px; right: -100px; animation: drift 20s ease-in-out infinite alternate-reverse; }
        .blob-3 { width: 350px; height: 350px; background: radial-gradient(circle, #0ea5e9, transparent); top: 40%; left: 55%; animation: drift2 12s ease-in-out infinite alternate; }

        @keyframes drift { from{transform:translate(0,0)} to{transform:translate(40px,30px)} }
        @keyframes drift2 { from{transform:translate(0,0)} to{transform:translate(-30px,25px)} }

        .grid-overlay {
          position: fixed; inset: 0;
          background-image: linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 44px 44px;
          pointer-events: none;
        }

        /* HERO */
        .hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          position: relative;
          z-index: 1;
        }

        /* BADGE */
        .hero-badge {
          display: flex; align-items: center; gap: 8px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 100px;
          padding: 6px 16px 6px 10px;
          margin-bottom: 2rem;
          opacity: 0; transform: translateY(12px);
          transition: opacity 0.5s 0.1s ease, transform 0.5s 0.1s ease;
        }
        .hero-badge.mounted { opacity: 1; transform: translateY(0); }
        .badge-dot {
          width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;
          box-shadow: 0 0 8px #3b82f6;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.82)} }
        .badge-text { font-size: 0.72rem; color: #93c5fd; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }

        /* HEADING */
        .hero-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem; font-weight: 400;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.2em; text-transform: uppercase;
          margin-bottom: 0.75rem;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.5s 0.2s ease, transform 0.5s 0.2s ease;
        }
        .hero-eyebrow.mounted { opacity: 1; transform: translateY(0); }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 800;
          color: #fff;
          text-align: center;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin-bottom: 1.25rem;
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.5s 0.3s ease, transform 0.5s 0.3s ease;
        }
        .hero-title.mounted { opacity: 1; transform: translateY(0); }
        .hero-title .accent {
          background: linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .hero-sub {
          font-size: 1rem; font-weight: 300;
          color: rgba(255,255,255,0.4);
          text-align: center;
          max-width: 480px;
          line-height: 1.7;
          margin-bottom: 3rem;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.5s 0.4s ease, transform 0.5s 0.4s ease;
        }
        .hero-sub.mounted { opacity: 1; transform: translateY(0); }
        .hero-sub strong { color: rgba(255,255,255,0.65); font-weight: 500; }

        /* ACTION CARDS */
        .action-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.5s 0.5s ease, transform 0.5s 0.5s ease;
        }
        .action-row.mounted { opacity: 1; transform: translateY(0); }

        .action-card {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 1.6rem 2rem;
          min-width: 140px;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s;
          backdrop-filter: blur(12px);
        }
        .action-card:hover {
          transform: translateY(-4px);
          border-color: var(--card-color);
          background: rgba(var(--card-rgb), 0.08);
          box-shadow: 0 12px 32px rgba(var(--card-rgb), 0.2);
        }
        .action-card.register { --card-color: #60a5fa; --card-rgb: 96,165,250; }
        .action-card.vote    { --card-color: #4ade80; --card-rgb: 74,222,128; }
        .action-card.results { --card-color: #a78bfa; --card-rgb: 167,139,250; }

        .action-icon {
          width: 52px; height: 52px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          transition: transform 0.2s;
        }
        .action-card:hover .action-icon { transform: scale(1.1); }
        .action-card.register .action-icon { background: rgba(96,165,250,0.15); color: #60a5fa; }
        .action-card.vote     .action-icon { background: rgba(74,222,128,0.12); color: #4ade80; }
        .action-card.results  .action-icon { background: rgba(167,139,250,0.12); color: #a78bfa; }

        .action-label {
          font-family: 'Syne', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          color: #fff; letter-spacing: 0.01em;
        }
        .action-desc { font-size: 0.72rem; color: rgba(255,255,255,0.3); text-align: center; }

        /* STATS ROW */
        .stats-row {
          display: flex; gap: 2.5rem; flex-wrap: wrap; justify-content: center;
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          opacity: 0; transform: translateY(12px);
          transition: opacity 0.5s 0.65s ease, transform 0.5s 0.65s ease;
        }
        .stats-row.mounted { opacity: 1; transform: translateY(0); }
        .stat { text-align: center; }
        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 1.6rem; font-weight: 800; color: #fff;
          background: linear-gradient(135deg, #60a5fa, #818cf8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .stat-label { font-size: 0.72rem; color: rgba(255,255,255,0.28); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

        /* FOOTER */
        .footer {
          position: relative; z-index: 1;
          text-align: center;
          padding: 1.5rem;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap;
        }
        .footer-pill { font-size: 0.68rem; color: rgba(255,255,255,0.18); letter-spacing: 0.05em; }
        .footer-sep { width: 3px; height: 3px; background: rgba(255,255,255,0.12); border-radius: 50%; }
      `}</style>

      <div className="home-root">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />

        <main className="hero">
          {/* Badge */}
          <div className={`hero-badge ${mounted ? "mounted" : ""}`}>
            <span className="badge-dot" />
            <span className="badge-text">Powered by Face Recognition &amp; Blockchain</span>
          </div>

          {/* Eyebrow */}
          <p className={`hero-eyebrow ${mounted ? "mounted" : ""}`}>Welcome to</p>

          {/* Title */}
          <h1 className={`hero-title ${mounted ? "mounted" : ""}`}>
            Smart <span className="accent">Voting</span><br />System
          </h1>

          {/* Subtitle */}
          <p className={`hero-sub ${mounted ? "mounted" : ""}`}>
            A <strong>secure, transparent</strong> and trusted digital democracy platform.<br />
            Your vote is private. Your identity is verified. Every count is immutable.
          </p>

          {/* Action cards */}
          <div className={`action-row ${mounted ? "mounted" : ""}`}>
            <Link href="/register" className="action-card register">
              <div className="action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
              </div>
              <span className="action-label">Register</span>
              <span className="action-desc">Create your voter identity</span>
            </Link>

            <Link href="/vote" className="action-card vote">
              <div className="action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <span className="action-label">Vote</span>
              <span className="action-desc">Cast your verified ballot</span>
            </Link>

            <Link href="/results" className="action-card results">
              <div className="action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <span className="action-label">Results</span>
              <span className="action-desc">Live election outcomes</span>
            </Link>
          </div>

          {/* Stats */}
          <div className={`stats-row ${mounted ? "mounted" : ""}`}>
            <div className="stat">
              <div className="stat-num">256-bit</div>
              <div className="stat-label">Encryption</div>
            </div>
            <div className="stat">
              <div className="stat-num">100%</div>
              <div className="stat-label">Tamper-proof</div>
            </div>
            <div className="stat">
              <div className="stat-num">Real-time</div>
              <div className="stat-label">Results</div>
            </div>
            <div className="stat">
              <div className="stat-num">Zero</div>
              <div className="stat-label">Double Votes</div>
            </div>
          </div>
        </main>

        <footer className="footer">
          {["Smart Voting System", "Secure", "Transparent", "Trusted", "2025"].map((t, i, a) => (
            <span key={t} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <span className="footer-pill">{t}</span>
              {i < a.length - 1 && <span className="footer-sep" />}
            </span>
          ))}
        </footer>
      </div>
    </>
  );
}