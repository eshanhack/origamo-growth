"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

const STORAGE_KEY = "origamo_auth";
const PASSWORD    = "noahgami";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed,  setAuthed]  = useState<boolean | null>(null); // null = hydrating
  const [input,   setInput]   = useState("");
  const [error,   setError]   = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read localStorage only on the client
  useEffect(() => {
    setAuthed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Auto-focus input once gate is shown
  useEffect(() => {
    if (authed === false) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [authed]);

  function submit() {
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  // Still hydrating — render blank canvas so there's no flash
  if (authed === null) return <div className="min-h-screen bg-[#0a0a0a]" />;
  if (authed)          return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Ambient lime glow behind the card */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[700px] h-[500px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(204,255,0,0.045) 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-[360px]">

        {/* Logo + wordmark */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="origamo" className="h-8 w-auto" />
          <span className="text-xl font-semibold text-[#CCFF00] tracking-tight -ml-1">Growth</span>
        </div>

        {/* Card */}
        <div
          className={clsx(
            "rounded-2xl border p-8 transition-all duration-300",
            error
              ? "border-red-500/40"
              : focused
              ? "border-gray-600 shadow-[0_0_50px_-10px_rgba(204,255,0,0.12)]"
              : "border-gray-800",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-7 text-center">
            Restricted Access
          </p>

          {/* Password input */}
          <div className="relative mb-3">
            <input
              ref={inputRef}
              type={showPw ? "text" : "password"}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Password"
              autoComplete="current-password"
              className={clsx(
                "w-full bg-gray-900 border rounded-xl px-4 py-3.5 text-sm text-white",
                "placeholder-gray-600 focus:outline-none transition-colors pr-11",
                error ? "border-red-500/50" : "border-gray-700 focus:border-gray-500",
              )}
            />

            {/* Show / hide password */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors p-0.5"
            >
              {showPw ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Inline error */}
          <div
            className={clsx(
              "text-[11px] text-red-400 text-center transition-all duration-200 overflow-hidden",
              error ? "opacity-100 max-h-6 mb-3" : "opacity-0 max-h-0 mb-0",
            )}
          >
            Incorrect password
          </div>

          {/* Enter button */}
          <button
            onClick={submit}
            className="w-full mt-2 bg-[#CCFF00] hover:bg-[#d4ff33] active:bg-[#b8e600]
                       text-black font-semibold text-sm py-3.5 rounded-xl transition-colors"
          >
            Enter
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-700 mt-6 tracking-wide">
          origamo growth · internal use only
        </p>
      </div>
    </div>
  );
}
