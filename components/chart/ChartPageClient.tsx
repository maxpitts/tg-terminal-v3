"use client";
import React from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import Watchlist from "./Watchlist";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { usePrices } from "@/hooks/usePrices";
import { useSession, signOut } from "next-auth/react";
import { useStream } from "@/hooks/useStream";

const TGChart        = dynamic(() => import("./TGChart").then(m => m.default as any), { ssr: false, loading: () => <ChartSkeleton /> }) as React.ComponentType<{ticker:string;onTickerChange:(t:string)=>void;compact?:boolean}>;
const ChartSkeleton  = dynamic(() => import("./ChartSkeleton"),   { ssr: false });
const ChartNewsFeed  = dynamic(() => import("./ChartNewsFeed"),  { ssr: false });
const GexPanel       = dynamic(() => import("./GexPanel"),         { ssr: false });

const TwitchFloating = dynamic(() => import("@/components/TwitchFloating"), { ssr: false });
const MiniScannerComponent = dynamic<{onSelect:(t:string)=>void}>(() => import("./MiniScanner"), { ssr: false });

type Panel = "news" | "gex" | "watchlist" | "none";

export default function ChartPageClient({ initialTicker }: { initialTicker: string }) {
  const router = useRouter();
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [rightPanel, setRightPanel] = useState<Panel>("none");
  const [showLeft, setShowLeft] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStream, setShowStream] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  usePrices([ticker]);
  useStream(ticker);
  const { data: session } = useSession();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleTickerChange = (t: string) => {
    setTicker(t);
    router.replace(`/chart/${t}`, { scroll: false });
    if (isMobile) { setShowLeft(false); setRightPanel("none"); }
  };

  const togglePanel = (p: Panel) => {
    setRightPanel(prev => prev === p ? "none" : p);
    if (isMobile) setShowLeft(false);
  };

  const btn = (label: string, panel: Panel, col: string) => (
    <button onClick={() => togglePanel(panel)}
      style={{
        background: rightPanel === panel ? `${col}25` : "transparent",
        border: `1px solid ${rightPanel === panel ? col : "rgba(255,255,255,0.1)"}`,
        color: rightPanel === panel ? col : "#64748b",
        padding: isMobile ? "6px 10px" : "5px 12px",
        borderRadius: 6, fontSize: isMobile ? 13 : 12,
        cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
        whiteSpace: "nowrap" as const,
      }}>
      {label}
    </button>
  );

  // Mobile bottom sheet overlay for left sidebar
  const mobileLeftOverlay = mounted && isMobile && showLeft;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#000000", overflow:"hidden" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        height: isMobile ? 48 : 52,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding: isMobile ? "0 12px" : "0 20px",
        background:"rgba(0,0,0,0.98)", borderBottom:"1px solid #1a1a1a",
        flexShrink:0, zIndex:200,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 12 }}>
          {/* Hamburger on mobile — opens left sidebar */}
          {isMobile && (
            <button onClick={() => setShowLeft(s => !s)}
              style={{ background:"none", border:"none", color:"#FF9500", fontSize:20, cursor:"pointer", padding:0, lineHeight:1 }}>
              ☰
            </button>
          )}
          <a href="/" style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700,
            fontSize: isMobile ? 14 : 16, color:"#f1f5f9", textDecoration:"none", letterSpacing:-0.3 }}>
            T&G <span style={{color:"#FF9500"}}>Charts</span>
          </a>
        </div>

        {/* Desktop nav */}
        {!isMobile && (
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {btn("📰 News", "news", "#a78bfa")}
            {btn("Γ GEX",  "gex",  "#26a69a")}

            {/* Tools dropdown */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>setNavMenuOpen(o=>!o)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
                  fontSize:12, borderRadius:6, cursor:"pointer",
                  fontFamily:"'JetBrains Mono',monospace",
                  border:`1px solid ${navMenuOpen?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.1)"}`,
                  background: navMenuOpen?"rgba(255,149,0,0.08)":"transparent",
                  color: navMenuOpen?"#a78bfa":"#94a3b8" }}>
                Tools {navMenuOpen?"▲":"▼"}
              </button>
              {navMenuOpen && (
                <>
                  <div onClick={()=>setNavMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                  <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:200,
                    background:"#0d0d0d", border:"1px solid #222",
                    borderRadius:8, padding:6, minWidth:185,
                    boxShadow:"0 8px 32px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", gap:1 }}>
                    {([
                      { href:"/gex",        icon:"Γ",  label:"GEX Terminal",  col:"#26a69a" },
                      { href:"/scanner",    icon:"⚡", label:"Scanner",       col:"#f0c040" },
                      { href:"/multichart", icon:"⊞", label:"Multi-Chart",   col:"#00AAFF" },
                      { href:"/live",       icon:"●",  label:"Live Stream",   col:"#f87171" },
                    ] as {href:string;icon:string;label:string;col:string}[]).map(item => (
                      <a key={item.href} href={item.href} onClick={()=>setNavMenuOpen(false)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                          borderRadius:5, textDecoration:"none", color:"#888888", fontSize:12,
                          fontFamily:"'JetBrains Mono',monospace" }}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.05)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <span style={{color:item.col,width:16,textAlign:"center"}}>{item.icon}</span>
                        {item.label}
                      </a>
                    ))}
                    <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",margin:"3px 0"}}/>
                    <button onClick={()=>{setShowStream(s=>!s);setNavMenuOpen(false);}}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                        borderRadius:5, border:"none", cursor:"pointer", width:"100%", textAlign:"left",
                        background: showStream?"rgba(239,68,68,0.1)":"transparent",
                        color: showStream?"#f87171":"#94a3b8", fontSize:12,
                        fontFamily:"'JetBrains Mono',monospace" }}>
                      <span style={{color:"#f87171",width:16,textAlign:"center"}}>⧉</span>
                      {showStream ? "Close Float" : "Float Stream"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {session?.user && (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"#555555",fontFamily:"'JetBrains Mono',monospace"}}>
                  {session.user.email?.split("@")[0] || session.user.name}
                </span>
                <button onClick={() => signOut({ callbackUrl:"/" })}
                  style={{background:"none",border:"1px solid #222",color:"#666666",
                    padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile: panel toggle buttons + menu */}
        {isMobile && (
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            {btn("📰", "news", "#a78bfa")}
            {btn("Γ", "gex", "#26a69a")}
            <button onClick={() => setMenuOpen(m => !m)}
              style={{ background:"none", border:"1px solid #222", color:"#666666",
                padding:"5px 10px", borderRadius:6, fontSize:13, cursor:"pointer" }}>
              •••
            </button>
          </div>
        )}
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{ position:"fixed", top:48, right:12, zIndex:500,
          background:"#0d0d0d", border:"1px solid #222",
          borderRadius:8, padding:8, display:"flex", flexDirection:"column", gap:4, minWidth:160 }}>
          <a href="/gex" style={{ color:"#26a69a", textDecoration:"none", padding:"8px 12px", fontSize:13, fontFamily:"monospace" }}>↗ Full GEX Terminal</a>
          <a href="/scanner" style={{ color:"#f0c040", textDecoration:"none", padding:"8px 12px", fontSize:13, fontFamily:"monospace" }}>⚡ Scanner</a>
          {session?.user && (
            <button onClick={() => signOut({ callbackUrl:"/" })}
              style={{ background:"none", border:"none", color:"#666666", padding:"8px 12px",
                fontSize:13, cursor:"pointer", textAlign:"left", fontFamily:"monospace" }}>
              Sign out ({session.user.email?.split("@")[0]})
            </button>
          )}
          <button onClick={() => setMenuOpen(false)}
            style={{ background:"none", border:"none", color:"#444444", padding:"4px 12px", fontSize:11, cursor:"pointer", textAlign:"left" }}>
            Close
          </button>
        </div>
      )}
      {isMobile && menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{ position:"fixed", inset:0, zIndex:499 }} />
      )}

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{
        flex:1, minHeight:0, display:"grid", overflow:"hidden",
        gridTemplateColumns: (mounted && !isMobile)
          ? rightPanel !== "none"
            ? "180px 1fr 300px"
            : "180px 1fr"
          : "1fr",
      }}>

        {/* Left sidebar — desktop only */}
        {mounted && !isMobile && (
          <div style={{ borderRight:"1px solid #1a1a1a", background:"#000",
            display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Top half: Watchlist */}
            <div style={{ height:"50%", overflowY:"auto", borderBottom:"1px solid #1a1a1a" }}>
              <Watchlist currentTicker={ticker} />
            </div>
            {/* Bottom half: Scanner */}
            <div style={{ height:"50%", overflowY:"auto" }}>
              <MiniScannerComponent onSelect={handleTickerChange} />
            </div>
          </div>
        )}

        {/* Chart */}
        <ErrorBoundary label="Chart" fallback={
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
            flexDirection:"column",gap:12,background:"#000000"}}>
            <span style={{fontSize:14,color:"#ef4444"}}>⚠ Chart failed to load</span>
            <button onClick={()=>window.location.reload()}
              style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",
                color:"#ef4444",borderRadius:6,padding:"6px 16px",cursor:"pointer",fontSize:12}}>
              Reload
            </button>
          </div>
        }>
          <TGChart ticker={ticker} onTickerChange={handleTickerChange} />
        </ErrorBoundary>

        {/* Right panel */}
        {!isMobile && rightPanel === "news" && (
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.07)", overflow:"hidden",
            display:"flex", flexDirection:"column" }}>
            <ChartNewsFeed ticker={ticker} />
          </div>
        )}
        {!isMobile && rightPanel === "gex" && (
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.07)", overflow:"hidden",
            display:"flex", flexDirection:"column", background:"#000000" }}>
            <GexPanel ticker={ticker} />
          </div>
        )}

      </div>

      {/* ── Mobile left sidebar overlay ─────────────────────────────────────── */}
      {mobileLeftOverlay && (
        <>
          <div onClick={() => setShowLeft(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300 }} />
          <div style={{
            position:"fixed", left:0, top:0, bottom:0, width:"80vw", maxWidth:300,
            background:"#0a0a0a", zIndex:400, display:"flex", flexDirection:"column",
            borderRight:"1px solid rgba(255,255,255,0.1)", overflowY:"auto",
          }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #1a1a1a",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:"#FF9500", fontFamily:"monospace", fontWeight:700 }}>MENU</span>
              <button onClick={() => setShowLeft(false)}
                style={{ background:"none", border:"none", color:"#555555", fontSize:18, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ flex:"1 1 0", minHeight:0, overflowY:"auto", borderBottom:"1px solid #1a1a1a" }}>
              <Watchlist currentTicker={ticker} />
            </div>
            <div style={{ flex:"1 1 0", minHeight:0, overflowY:"auto" }}>
              <MiniScannerComponent onSelect={handleTickerChange} />
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom panel (news / gex) ────────────────────────────────── */}
      {isMobile && rightPanel !== "none" && (
        <>
          <div onClick={() => setRightPanel("none")}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300 }} />
          <div style={{
            position:"fixed", bottom:0, left:0, right:0, zIndex:400,
            height:"60vh", background:"#0a0a0a",
            borderTop:"1px solid rgba(255,255,255,0.1)",
            borderRadius:"16px 16px 0 0", overflow:"hidden",
            display:"flex", flexDirection:"column",
          }}>
            {/* Drag handle + close */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"10px 16px", borderBottom:"1px solid #1a1a1a", flexShrink:0 }}>
              <div style={{ width:36, height:4, background:"rgba(255,255,255,0.15)", borderRadius:2, margin:"0 auto" }} />
              <button onClick={() => setRightPanel("none")}
                style={{ background:"none", border:"none", color:"#555555", fontSize:18, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              {rightPanel === "news" && <ChartNewsFeed ticker={ticker} />}
              {rightPanel === "gex"  && <GexPanel ticker={ticker} />}
            </div>
          </div>
        </>
      )}
      {showStream && <TwitchFloating onClose={()=>setShowStream(false)} />}
    </div>
  );
}
