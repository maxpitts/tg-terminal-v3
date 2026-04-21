"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AuthProvider from "@/components/AuthProvider";

function UpgradeInner() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  const checkout = async (tier: string) => {
    setLoading(tier);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setLoading(null); }
  };

  const card = (
    tier: string, name: string, price: string, color: string,
    features: string[], recommended?: boolean
  ) => (
    <div style={{
      width:300, padding:"28px 24px",
      background: recommended ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
      border:`1px solid ${recommended ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
      borderRadius:16, display:"flex", flexDirection:"column", gap:16,
      position:"relative",
    }}>
      {recommended && (
        <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
          background:"#7c3aed", color:"#fff", fontSize:11, fontWeight:700,
          padding:"3px 12px", borderRadius:20, letterSpacing:1 }}>
          MOST POPULAR
        </div>
      )}
      <div>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>{name}</div>
        <div style={{ fontSize:32, fontWeight:700, color:"#f1f5f9" }}>
          {price}<span style={{ fontSize:14, color:"#475569" }}>/mo</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
        {features.map(f => (
          <div key={f} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span style={{ color, fontSize:14, flexShrink:0 }}>✓</span>
            <span style={{ fontSize:13, color:"#94a3b8", lineHeight:1.5 }}>{f}</span>
          </div>
        ))}
      </div>
      <button onClick={() => checkout(tier)} disabled={!!loading}
        style={{ width:"100%", padding:"12px", borderRadius:9, fontSize:14, fontWeight:600,
          cursor: loading ? "not-allowed" : "pointer", border:"none",
          background: recommended ? "#7c3aed" : "rgba(255,255,255,0.06)",
          color:"#fff", opacity: loading===tier ? 0.7 : 1, fontFamily:"inherit" }}>
        {loading===tier ? "Loading..." : `Start 7-day free trial →`}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#07070f",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Outfit',sans-serif", padding:"40px 20px" }}>
      <a href="/" style={{ fontWeight:700, fontSize:22, color:"#f1f5f9", textDecoration:"none", marginBottom:12 }}>
        T&G <span style={{color:"#a78bfa"}}>Charts</span>
      </a>
      <div style={{ fontSize:28, fontWeight:700, color:"#f1f5f9", marginBottom:8, textAlign:"center" }}>
        Choose your plan
      </div>
      <div style={{ fontSize:15, color:"#475569", marginBottom:48, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        <span>{session?.user?.email ? `Signing up as ${session.user.email}` : "Sign in to subscribe"}</span>
        {session?.user?.email && (
          <button onClick={() => signOut({ callbackUrl: "/" })}
            style={{ background:"none", border:"none", color:"#334155", fontSize:12,
              cursor:"pointer", textDecoration:"underline" }}>
            Not you? Sign out
          </button>
        )}
      </div>
      <div style={{ display:"flex", gap:20, flexWrap:"wrap", justifyContent:"center" }}>
        {card("pro","Pro","$39","#26a69a",[
          "All intraday timeframes (1m–4h)",
          "GammaFlow regime indicator",
          "IFP-Q probability engine",
          "Reversal Engine signals",
          "Dark pool overlay",
          "Options flow markers",
          "Drawing tools",
          "T&G Discord access",
          "Pine Script indicators",
        ], true)}
        {card("elite","Elite","$79","#a78bfa",[
          "Everything in Pro",
          "Live trading sessions",
          "1-on-1 onboarding call",
          "IFP-Q Pine Script source",
          "Priority support",
          "Early access to new tools",
        ])}
      </div>
      <div style={{ marginTop:32, fontSize:12, color:"#334155", textAlign:"center" }}>
        7-day free trial · No charge until trial ends · Cancel anytime · Secured by Stripe
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return <AuthProvider><UpgradeInner /></AuthProvider>;
}
