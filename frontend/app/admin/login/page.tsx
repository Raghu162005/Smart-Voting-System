"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      const token = localStorage.getItem("admin_token");
      if (token) {
        try {
          const res = await fetch("http://localhost:5000/admin/verify", {
            headers: { Authorization: token },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.authenticated) {
              if (active) router.push("/admin");
              return;
            }
            localStorage.removeItem("admin_token");
          } else if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("admin_token");
          }
        } catch { /* backend unreachable — keep token, show the login form */ }
      }
      if (active) setMounted(true);
    })();
    return () => { active = false; };
  }, [router]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5000/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("admin_token", data.token);
        router.push("/admin");
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("Backend not reachable");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #0a0f1e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          pointer-events: none;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #3b82f6, transparent);
          top: -120px; left: -100px;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #6366f1, transparent);
          bottom: -80px; right: -80px;
          animation: drift 15s ease-in-out infinite alternate-reverse;
        }
        .blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #0ea5e9, transparent);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: drift 9s ease-in-out infinite alternate;
        }

        @keyframes drift {
          from { transform: translate(0, 0); }
          to { transform: translate(30px, 20px); }
        }

        .grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .card {
          position: relative;
          width: 100%;
          max-width: 420px;
          margin: 1.5rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 2.5rem 2.5rem 2rem;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(59,130,246,0.1),
            0 32px 64px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.07);
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        .badge {
          display: flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          margin: 0 auto 1.5rem;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 100px;
          padding: 5px 14px 5px 8px;
        }
        .badge-dot {
          width: 8px; height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          box-shadow: 0 0 8px #3b82f6;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        .badge-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.7rem;
          font-weight: 500;
          color: #93c5fd;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .heading {
          font-family: 'Syne', sans-serif;
          font-size: 2.4rem;
          font-weight: 800;
          color: #fff;
          text-align: center;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .heading span {
          background: linear-gradient(135deg, #60a5fa, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .subtext {
          text-align: center;
          color: rgba(255,255,255,0.38);
          font-size: 0.875rem;
          font-weight: 300;
          margin-top: 0.5rem;
          margin-bottom: 2rem;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin-bottom: 2rem;
        }

        .field { margin-bottom: 1.25rem; }
        .field-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          padding-left: 2px;
        }
        .field-wrap {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          overflow: hidden;
        }
        .field-wrap.focused {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .field-icon {
          position: absolute;
          left: 14px;
          display: flex;
          align-items: center;
          color: rgba(255,255,255,0.2);
          transition: color 0.2s;
          pointer-events: none;
        }
        .field-wrap.focused .field-icon { color: #818cf8; }
        .field-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: rgba(255,255,255,0.9);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 400;
          padding: 0.85rem 1rem 0.85rem 2.75rem;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }

        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 1rem;
          font-size: 0.82rem;
          color: #fca5a5;
          text-align: center;
        }

        .btn {
          width: 100%;
          margin-top: 0.5rem;
          padding: 0.95rem;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          color: #fff;
          font-family: 'Syne', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(99,102,241,0.35);
          transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
        }
        .btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn:hover:not(:disabled)::before { opacity: 1; }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(99,102,241,0.45);
        }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .spinner {
          display: inline-block;
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .footer-pills {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 1.75rem;
        }
        .pill {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.22);
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pill-dot {
          width: 3px; height: 3px;
          background: rgba(255,255,255,0.15);
          border-radius: 50%;
        }
      `}</style>

      <div className="login-root">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />

        <div className={`card ${mounted ? "mounted" : ""}`}>
          <div className="badge">
            <span className="badge-dot" />
            <span className="badge-text">Secure Portal</span>
          </div>

          <h1 className="heading">
            Admin <span>Login</span>
          </h1>
          <p className="subtext">Access your dashboard with admin credentials</p>

          <div className="divider" />

          {error && <div className="error-msg">{error}</div>}

          <div className="field">
            <label className="field-label">Username</label>
            <div className={`field-wrap ${focused === "username" ? "focused" : ""}`}>
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                className="field-input"
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocused("username")}
                onBlur={() => setFocused(null)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <div className={`field-wrap ${focused === "password" ? "focused" : ""}`}>
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                className="field-input"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button className="btn" onClick={handleLogin} disabled={isLoading || !username || !password}>
            {isLoading ? (
              <><span className="spinner" />Authenticating...</>
            ) : (
              "Sign In"
            )}
          </button>

          <div className="footer-pills">
            {["Smart Voting System", "Secure", "Transparent", "Trusted"].map((label, i, arr) => (
              <span key={label} className="pill">
                {label}
                {i < arr.length - 1 && <span className="pill-dot" />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
