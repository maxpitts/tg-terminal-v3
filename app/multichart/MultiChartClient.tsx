"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePrices } from "@/hooks/usePrices";
import dynamic from "next/dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TGChart = dynamic(() => import("@/components/chart/TGChart").then(m => m.default as any), { ssr: false }) as React.ComponentType<{ticker:string;onTickerChange:(t:string)=>void;compact?:boolean}>;

type Layout = "1x1" | "2x1" | "2x2" | "3x1";

const LAYOUTS: Record<Layout, { cols: number; rows: number; label: string }> = {
  "1x1": { cols: 1, rows: 1, label: "1" },
  "2x1": { cols: 2, rows: 1, label: "2" },
  "2x2": { cols: 2, rows: 2, label: "4" },
  "3x1": { cols: 3, rows: 1, label: "3" },
};

const DEFAULT_TICKERS: Record<Layout, string[]> = {
  "1x1": ["SPY"],
  "2x1": ["SPY", "QQQ"],
  "2x2": ["SPY", "QQQ", "IWM", "NVDA"],
  "3x1": ["SPY", "QQQ", "IWM"],
};

export default function MultiChartClient() {
  const [layout, setLayout]   = useState<Layout>("2x1");
  const [tickers, setTickers] = useState(DEFAULT_TICKERS["2x1"]);
  const [active, setActive]   = useState(0);
  const { data: session }     = useSession();

  usePrices(tickers);

  useEffect(() => {
    setTickers(DEFAULT_TICKERS[layout]);
    setActive(0);
  }, [layout]);

  const { cols, rows } = LAYOUTS[layout];
  const count = cols * rows;

  const updateTicker = (idx: number, t: string) => {
    setTickers(prev => { const n = [...prev]; n[idx] = t.toUpperCase(); return n; });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#07070f",
      fontFamily:"'JetBrains Mono',monospace" }}>

      {/* Nav */}
      <nav style={{ height:48, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 16px", background:"rgba(7,7,15,0.98)",
        borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <a href="/chart/SPY" style={{ color:"#64748b", textDecoration:"none", fontSize:11 }}>← Chart</a>
          <span style={{ color:"#1e293b" }}>|</span>
          <span style={{ fontSize:12, fontWeight:700, color:"#a78bfa" }}>⊞ MULTI-CHART</span>
        </div>

        {/* Layout picker */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <span style={{ fontSize:9, color:"#334155", marginRight:4 }}>LAYOUT</span>
          {(Object.entries(LAYOUTS) as [Layout, typeof LAYOUTS[Layout]][]).map(([key, val]) => (
            <button key={key} onClick={() => setLayout(key)}
              style={{ padding:"3px 10px", fontSize:10, borderRadius:4, cursor:"pointer",
                fontFamily:"inherit", border:"1px solid",
                borderColor: layout===key ? "#a78bfa" : "rgba(255,255,255,0.1)",
                background: layout===key ? "rgba(167,139,250,0.2)" : "transparent",
                color: layout===key ? "#a78bfa" : "#64748b" }}>
              {val.label}×
            </button>
          ))}
          <span style={{ marginLeft:8, fontSize:9, color:"#334155" }}>
            Click any chart to focus
          </span>
        </div>

        {session?.user && (
          <button onClick={() => signOut({ callbackUrl:"/" })}
            style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", color:"#64748b",
              padding:"4px 10px", borderRadius:6, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
            Sign out
          </button>
        )}
      </nav>

      {/* Chart grid */}
      <div style={{
        flex: 1, display:"grid", overflow:"hidden",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 1, background: "rgba(255,255,255,0.05)",
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} onClick={() => setActive(i)}
            style={{
              position:"relative", overflow:"hidden", background:"#07070f",
              outline: active===i ? "2px solid #a78bfa" : "none",
              outlineOffset: -2,
            }}>
            {/* Active indicator */}
            {active===i && (
              <div style={{ position:"absolute", top:4, left:4, zIndex:50,
                fontSize:8, color:"#a78bfa", background:"rgba(167,139,250,0.15)",
                border:"1px solid rgba(167,139,250,0.3)", padding:"1px 5px", borderRadius:3 }}>
                ACTIVE
              </div>
            )}
            <TGChart
              ticker={tickers[i] || "SPY"}
              onTickerChange={(t) => updateTicker(i, t)}
              compact={count > 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
