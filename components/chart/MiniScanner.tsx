"use client";
import { useState, useEffect } from "react";

interface ScanResult {
  ticker: string; price: number; chg: number;
  regime: string; totalGex: number; signal: string | null;
}

export default function MiniScanner({ onSelect }: { onSelect: (t: string) => void }) {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all"|"up"|"down"|"neg">("all");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/scanner");
      const d = await r.json();
      setResults(d.results || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 5*60*1000); return () => clearInterval(t); }, []);

  const filtered = results.filter(r => {
    if (filter === "up")  return r.chg > 0;
    if (filter === "down") return r.chg < 0;
    if (filter === "neg")  return r.totalGex < -50;
    return true;
  }).sort((a,b) => Math.abs(b.chg) - Math.abs(a.chg));

  const regCol = (r: string) => r === "NEGATIVE GEX" ? "#FF3333" : r === "POSITIVE GEX" ? "#00CC44" : "#FF9500";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", fontFamily:"'JetBrains Mono',monospace" }}>
      {/* Header */}
      <div style={{ padding:"6px 10px", borderBottom:"1px solid rgba(255,255,255,0.07)",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
        background:"#0d0d0d" }}>
        <span style={{ fontSize:9, color:"#FF9500", letterSpacing:1 }}>⚡ SCANNER</span>
        <div style={{ display:"flex", gap:3 }}>
          {(["all","up","down","neg"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ fontSize:8, padding:"1px 5px", borderRadius:3, cursor:"pointer",
                fontFamily:"inherit", border:"1px solid",
                borderColor: filter===f ? "#FF9500" : "#1e1e1e",
                background: filter===f ? "rgba(240,196,64,0.12)" : "transparent",
                color: filter===f ? "#FF9500" : "#555555" }}>
              {f==="all"?"All":f==="up"?"🟢":f==="down"?"🔴":"Γ"}
            </button>
          ))}
          <button onClick={load} disabled={loading}
            style={{ fontSize:9, padding:"1px 5px", borderRadius:3, cursor:"pointer",
              fontFamily:"inherit", border:"1px solid rgba(255,255,255,0.08)",
              background:"transparent", color:"#333333" }}>
            {loading ? "…" : "↺"}
          </button>
        </div>
      </div>

      {/* Rows */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {loading && results.length === 0 && (
          <div style={{ padding:12, fontSize:10, color:"#333333", textAlign:"center" }}>Scanning...</div>
        )}
        {filtered.map(r => (
          <div key={r.ticker} onClick={() => onSelect(r.ticker)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"5px 10px", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.03)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#111111")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#F0F0F0" }}>{r.ticker}</span>
              <span style={{ fontSize:8, padding:"1px 4px", borderRadius:3,
                background:`${regCol(r.regime)}15`, color:regCol(r.regime),
                border:`1px solid ${regCol(r.regime)}30` }}>
                {r.regime === "NEGATIVE GEX" ? "NEG Γ" : r.regime === "POSITIVE GEX" ? "POS Γ" : "NEUT"}
              </span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
              <span style={{ fontSize:11, color:"#888888" }}>${r.price.toFixed(2)}</span>
              <span style={{ fontSize:10, fontWeight:600,
                color: r.chg >= 0 ? "#00CC44" : "#FF3333" }}>
                {r.chg >= 0 ? "+" : ""}{r.chg.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:"4px 10px", borderTop:"1px solid rgba(255,255,255,0.05)",
        display:"flex", justifyContent:"space-between", flexShrink:0 }}>
        <span style={{ fontSize:8, color:"#333333" }}>{filtered.length} tickers · 5min</span>
        <a href="/scanner" style={{ fontSize:8, color:"#FF9500", textDecoration:"none" }}>
          Full scanner →
        </a>
      </div>
    </div>
  );
}
