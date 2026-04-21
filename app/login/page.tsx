"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthProvider from "@/components/AuthProvider";

function LoginInner() {
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/chart/SPY";
  const error        = searchParams.get("error");
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then(r => r.json())
      .then(d => setCsrfToken(d.csrfToken || ""))
      .catch(() => {});
  }, []);

  const btn = (label: string, icon: React.ReactNode, provider: string, borderColor: string, bg: string) => (
    <form method="POST" action={`/api/auth/signin/${provider}`} style={{ width:"100%", marginBottom:10 }}>
      <input type="hidden" name="csrfToken" value={csrfToken}/>
      <input type="hidden" name="callbackUrl" value={callbackUrl}/>
      <button type="submit"
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
          gap:10, padding:"12px", borderRadius:9, fontSize:14, fontWeight:500,
          cursor:"pointer", border:`1px solid ${borderColor}`, background:bg,
          color:"#f1f5f9", fontFamily:"'Outfit',sans-serif" }}>
        {icon}
        {label}
      </button>
    </form>
  );

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#07070f",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Outfit',sans-serif" }}>
      <a href="/" style={{ fontWeight:700, fontSize:22, color:"#f1f5f9",
        textDecoration:"none", letterSpacing:-0.3, marginBottom:36 }}>
        T&G <span style={{color:"#a78bfa"}}>Charts</span>
      </a>
      <div style={{ width:"100%", maxWidth:400, padding:"36px 32px",
        background:"#0d0d1a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16 }}>
        <div style={{ marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#f1f5f9", marginBottom:6 }}>Sign in to continue</div>
          <div style={{ fontSize:14, color:"#475569" }}>Access your charts and flow data</div>
        </div>
        {error && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
            color:"#f87171", padding:"10px 14px", borderRadius:8, marginBottom:16, fontSize:13, textAlign:"center" }}>
            {error === "OAuthAccountNotLinked" ? "Email already linked to another provider." : "Sign in failed. Try again."}
          </div>
        )}
        {btn("Continue with Google", (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        ), "google", "rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)")}
        {btn("Continue with Discord", (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865f2">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.033.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
        ), "discord", "rgba(88,101,242,0.4)", "rgba(88,101,242,0.1)")}

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0" }}>
          <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.07)" }}/>
          <span style={{ fontSize:10, color:"#334155" }}>or</span>
          <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.07)" }}/>
        </div>

        {/* Whop — existing members */}
        <form method="GET" action="/api/auth/whop" style={{ width:"100%", marginBottom:10 }}>
          <input type="hidden" name="callbackUrl" value={callbackUrl}/>
          <button type="submit"
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:10, padding:"12px", borderRadius:9, fontSize:14, fontWeight:500,
              cursor:"pointer", border:"1px solid rgba(255,255,255,0.1)",
              background:"rgba(255,255,255,0.03)", color:"#94a3b8", fontFamily:"'Outfit',sans-serif" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#ffffff" fillOpacity="0.1"/>
              <text x="12" y="17" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">W</text>
            </svg>
            Continue with Whop
          </button>
        </form>
        <div style={{ textAlign:"center", fontSize:12, color:"#334155", lineHeight:1.7 }}>
          By signing in you agree to our{" "}
          <a href="#" style={{color:"#a78bfa",textDecoration:"none"}}>Terms</a>{" & "}
          <a href="#" style={{color:"#a78bfa",textDecoration:"none"}}>Privacy</a>
        </div>
      </div>
      <div style={{ marginTop:20, fontSize:13, color:"#334155" }}>
        Don&apos;t have access?{" "}
        <a href="/" style={{color:"#a78bfa",textDecoration:"none"}}>See plans →</a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{width:"100vw",height:"100vh",background:"#07070f"}}/>}>
        <LoginInner/>
      </Suspense>
    </AuthProvider>
  );
}
