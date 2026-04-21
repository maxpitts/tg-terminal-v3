"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const WATCH = ["SPY","QQQ","NVDA","TSLA","AAPL","MSFT","META","AMD"];
interface Price { t:string; p:number; c:number; pct:number; }

function usePrices() {
  const [prices, setPrices] = useState<Price[]>([]);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/polygon/snapshot?tickers=${WATCH.join(",")}`);
        const d = await r.json();
        setPrices((d.tickers||[]).map((t:any)=>({t:t.ticker,p:t.price,c:t.change,pct:t.changePct})));
      } catch {}
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);
  return prices;
}

const TIERS = [
  {
    name: "FREE",
    price: "$0",
    sub: "forever",
    col: "#444",
    accent: "#888",
    cta: "START FREE",
    features: [
      "Live charts — all timeframes",
      "VWAP, EMA overlays",
      "Volume Profile",
      "News feed",
      "Watchlist (5 tickers)",
      "Drawing tools",
    ],
    locked: ["IFP-Q v4 signals","GEX Terminal","Market Scanner","Multi-chart layouts","Dark pool overlay"],
  },
  {
    name: "PRO",
    price: "$39",
    sub: "/ month",
    col: "#FF9500",
    accent: "#FF9500",
    cta: "START 7-DAY TRIAL",
    badge: "MOST POPULAR",
    features: [
      "Everything in Free",
      "IFP-Q v4 — full signal suite",
      "GEX Terminal + flip zones",
      "Market Scanner (15 tickers)",
      "Multi-chart layouts",
      "Earnings overlay",
      "Watchlist (unlimited)",
      "Drawing persistence",
    ],
    locked: [],
  },
  {
    name: "ELITE",
    price: "$79",
    sub: "/ month",
    col: "#00AAFF",
    accent: "#00AAFF",
    cta: "START 7-DAY TRIAL",
    features: [
      "Everything in Pro",
      "Dark pool overlay",
      "Options flow markers",
      "GammaFlow indicator",
      "HOT markers (unusual activity)",
      "Priority support",
      "Whop community access",
    ],
    locked: [],
  },
];


const SOCIALS = [
  { label:"X",         href:"https://x.com/tradesandgains",                    icon:"𝕏" },
  { label:"Instagram", href:"https://www.instagram.com/tradesandgains/",        icon:"IG" },
  { label:"YouTube",   href:"https://www.youtube.com/@Tradesandgains",          icon:"YT" },
  { label:"Substack",  href:"https://tradesandgains.substack.com/",             icon:"SS" },
  { label:"Whop",      href:"https://whop.com/joined/tradesandgains/",          icon:"WP" },
];

export default function LandingContent() {
  const router = useRouter();
  const prices = usePrices();
  const [activeF, setActiveF] = useState(0);

  const FEATURES = [
    { tag:"GEX TERMINAL", col:"#FF9500", title:"Dynamic Dealer Flip Zone",
      desc:"Three-method synthetic GEX — volume-weighted, DTE-weighted, and raw — synthesized into a flip zone with conviction score. See exactly where dealers flip from stabilizing to amplifying.",
      stat:"15s refresh · Full chain · 3-method synthesis" },
    { tag:"IFP-Q v4", col:"#00AAFF", title:"16-Module Quant Engine",
      desc:"Absorption, trapped traders, CHoCH/BOS structure, ORB, liquidity pools, FVGs, and vol squeeze — all in one overlay. Institutional logic on a retail chart.",
      stat:"220 bars lookback · 8 filters · Grade A–D signals" },
    { tag:"LIVE DATA", col:"#00CC44", title:"Real-Time WebSocket Feed",
      desc:"Candles update every second. New bars append on close. Pre-market from 4am ET, after-hours to 8pm. The same data feed used by institutional desks.",
      stat:"wss:// · Second aggregates · Extended hours" },
    { tag:"SCANNER", col:"#FF9500", title:"Multi-Ticker Signal Scanner",
      desc:"GEX regime, volume surges, and momentum signals across 15 tickers — updated every 5 minutes. One click to open any chart.",
      stat:"15 tickers · 5min scan · GEX + momentum" },
  ];

  return (
    <div style={{ background:"#000", color:"#F0F0F0", fontFamily:"'JetBrains Mono',monospace",
      minHeight:"100vh", overflowX:"hidden" }}>
      <style>{`
        @keyframes tape { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .nav-link { font-size:9px; color:#444; text-decoration:none; letter-spacing:1.5px; transition:color 0.15s; }
        .nav-link:hover { color:#FF9500; }
        .cta-primary { background:#FF9500; color:#000; border:none; padding:11px 28px; font-size:9px; font-weight:700; letter-spacing:2px; cursor:pointer; font-family:inherit; transition:opacity 0.15s; }
        .cta-primary:hover { opacity:0.85; }
        .cta-ghost { background:transparent; color:#555; border:1px solid #222; padding:11px 28px; font-size:9px; letter-spacing:2px; cursor:pointer; font-family:inherit; transition:all 0.15s; }
        .cta-ghost:hover { border-color:#444; color:#888; }
        .price-row:hover { background:#0a0a0a !important; }
        .feat-tab:hover { background:#080808; }
        .tier-card { transition:all 0.2s; }
        .tier-card:hover { transform:translateY(-2px); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ height:48, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 40px", borderBottom:"1px solid #1a1a1a", background:"#000",
        position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          <span style={{ fontSize:12, fontWeight:700, letterSpacing:3 }}>
            T&amp;G <span style={{color:"#FF9500"}}>CHARTS</span>
          </span>
          <div style={{ display:"flex", gap:24 }}>
            {[["CHART","/chart/SPY"],["SCANNER","/scanner"],["GEX","/gex"],["PRICING","#pricing"]].map(([l,h])=>(
              <a key={l} href={h} className="nav-link">{l}</a>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <a href="/login" className="nav-link">LOGIN</a>
          <button onClick={()=>router.push("/login")} className="cta-primary" style={{padding:"7px 16px"}}>
            LAUNCH APP
          </button>
        </div>
      </nav>

      {/* ── Ticker tape ── */}
      {prices.length > 0 && (
        <div style={{ borderBottom:"1px solid #1a1a1a", overflow:"hidden", padding:"7px 0" }}>
          <div style={{ display:"flex", gap:40, animation:"tape 28s linear infinite", width:"max-content" }}>
            {[...prices,...prices].map((p,i)=>(
              <span key={i} style={{ fontSize:9, display:"inline-flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
                <span style={{color:"#444",letterSpacing:1}}>{p.t}</span>
                <span style={{fontWeight:700}}>${p.p.toFixed(2)}</span>
                <span style={{color:p.pct>=0?"#00CC44":"#FF3333",fontWeight:700}}>{p.pct>=0?"+":""}{p.pct.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"80px 40px 72px",
        display:"grid", gridTemplateColumns:"1fr 400px", gap:72, alignItems:"center",
        animation:"fadeUp 0.5s ease both" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <div style={{ width:20, height:2, background:"#FF9500" }}/>
            <span style={{ fontSize:9, color:"#FF9500", letterSpacing:2.5 }}>INSTITUTIONAL-GRADE · FREE TO START</span>
          </div>
          <h1 style={{ fontSize:"clamp(34px,4vw,56px)", fontWeight:700, lineHeight:1.08,
            letterSpacing:-1.5, margin:"0 0 20px", color:"#F0F0F0" }}>
            The trading terminal<br/>serious traders use.
          </h1>
          <p style={{ fontSize:11, color:"#555", lineHeight:1.9, margin:"0 0 16px", maxWidth:460 }}>
            Real-time GEX, IFP-Q v4 institutional signals, live WebSocket candles,
            and a market scanner. Built for traders who trade with edge — not vibes.
          </p>
          <div style={{ fontSize:10, color:"#FF9500", marginBottom:36, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{animation:"blink 2s infinite"}}>●</span>
            Free plan available — no credit card required
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>router.push("/login")} className="cta-primary">GET STARTED FREE</button>
            <button onClick={()=>router.push("/chart/SPY")} className="cta-ghost">LIVE DEMO</button>
          </div>
        </div>

        {/* Live prices */}
        <div style={{ border:"1px solid #1a1a1a", animation:"fadeUp 0.5s 0.1s ease both", opacity:0,
          animationFillMode:"forwards" }}>
          <div style={{ background:"#0a0a0a", borderBottom:"1px solid #1a1a1a", padding:"8px 14px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:8, color:"#FF9500", letterSpacing:2, fontWeight:700 }}>LIVE PRICES</span>
            <span style={{ fontSize:8, color:"#00CC44", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{animation:"blink 2s infinite"}}>●</span> REAL-TIME
            </span>
          </div>
          {prices.length === 0 ? (
            <div style={{ padding:32, fontSize:9, color:"#333", textAlign:"center" }}>Loading...</div>
          ) : prices.map((p,i)=>(
            <div key={p.t} className="price-row" onClick={()=>router.push(`/chart/${p.t}`)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"9px 14px", borderBottom:i<prices.length-1?"1px solid #111":"none",
                cursor:"pointer", transition:"background 0.12s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:10, fontWeight:700, minWidth:40, letterSpacing:0.5 }}>{p.t}</span>
                <span style={{ fontSize:10, color:"#666" }}>${p.p.toFixed(2)}</span>
              </div>
              <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px",
                color:p.pct>=0?"#00CC44":"#FF3333",
                border:`1px solid ${p.pct>=0?"rgba(0,204,68,0.2)":"rgba(255,51,51,0.2)"}`,
                background:p.pct>=0?"rgba(0,204,68,0.05)":"rgba(255,51,51,0.05)" }}>
                {p.pct>=0?"+":""}{p.pct.toFixed(2)}%
              </span>
            </div>
          ))}
          <div style={{ background:"#0a0a0a", borderTop:"1px solid #1a1a1a", padding:"7px 14px",
            fontSize:7, color:"#2a2a2a", letterSpacing:1 }}>
            POWERED BY MASSIVE.COM · UPDATES EVERY 30S
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ borderTop:"1px solid #1a1a1a", borderBottom:"1px solid #1a1a1a" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 40px",
          display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {[["16","Indicator Modules"],["15s","GEX Refresh"],["2500+","Options Contracts"],["4am","Pre-Market Data"]].map(([v,l],i)=>(
            <div key={i} style={{ padding:"24px 0", textAlign:"center",
              borderRight:i<3?"1px solid #1a1a1a":"none" }}>
              <div style={{ fontSize:30, fontWeight:700, color:"#FF9500", letterSpacing:-1 }}>{v}</div>
              <div style={{ fontSize:8, color:"#333", letterSpacing:2, marginTop:5 }}>{(l as string).toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"72px 40px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:40 }}>
          <div style={{ width:3, height:18, background:"#FF9500" }}/>
          <span style={{ fontSize:9, color:"#555", letterSpacing:3 }}>WHAT'S INSIDE</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", border:"1px solid #1a1a1a" }}>
          <div style={{ borderRight:"1px solid #1a1a1a" }}>
            {FEATURES.map((f,i)=>(
              <div key={i} className="feat-tab" onClick={()=>setActiveF(i)} style={{
                padding:"16px 18px", cursor:"pointer",
                borderBottom:i<FEATURES.length-1?"1px solid #1a1a1a":"none",
                borderLeft:activeF===i?`3px solid ${f.col}`:"3px solid transparent",
                background:activeF===i?"#0a0a0a":"transparent", transition:"all 0.15s" }}>
                <div style={{ fontSize:7, color:activeF===i?f.col:"#333", letterSpacing:2, marginBottom:4 }}>{f.tag}</div>
                <div style={{ fontSize:11, fontWeight:700, color:activeF===i?"#F0F0F0":"#444", lineHeight:1.3 }}>{f.title}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:"36px 40px" }}>
            <div style={{ fontSize:8, color:FEATURES[activeF].col, letterSpacing:2, marginBottom:12 }}>{FEATURES[activeF].tag}</div>
            <div style={{ fontSize:20, fontWeight:700, color:"#F0F0F0", marginBottom:16, lineHeight:1.2 }}>{FEATURES[activeF].title}</div>
            <p style={{ fontSize:11, color:"#555", lineHeight:1.9, marginBottom:24, maxWidth:480 }}>{FEATURES[activeF].desc}</p>
            <div style={{ padding:"8px 14px", background:"#0a0a0a", border:"1px solid #1a1a1a",
              fontSize:9, color:"#444", letterSpacing:1, marginBottom:24 }}>
              {FEATURES[activeF].stat}
            </div>
            <button onClick={()=>router.push("/chart/SPY")} style={{
              background:"transparent", color:FEATURES[activeF].col,
              border:`1px solid ${FEATURES[activeF].col}`,
              padding:"8px 18px", fontSize:9, letterSpacing:2, cursor:"pointer", fontFamily:"inherit",
              transition:"all 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background=FEATURES[activeF].col;e.currentTarget.style.color="#000";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=FEATURES[activeF].col;}}>
              SEE IT LIVE →
            </button>
          </div>
        </div>
      </div>

      {/* ── Pricing ── */}
      <div id="pricing" style={{ borderTop:"1px solid #1a1a1a" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"72px 40px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:3, height:18, background:"#FF9500" }}/>
            <span style={{ fontSize:9, color:"#555", letterSpacing:3 }}>PRICING</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:48 }}>
            <div>
              <h2 style={{ fontSize:"clamp(22px,3vw,36px)", fontWeight:700, color:"#F0F0F0",
                letterSpacing:-1, margin:0 }}>Start free. Upgrade when ready.</h2>
            </div>
            <span style={{ fontSize:9, color:"#333", letterSpacing:1 }}>7-DAY FREE TRIAL ON ALL PAID PLANS</span>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, background:"#1a1a1a" }}>
            {TIERS.map((tier,ti)=>(
              <div key={tier.name} className="tier-card" style={{
                background:"#000", padding:"36px 32px",
                position:"relative", overflow:"hidden",
              }}>
                {/* Popular badge */}
                {tier.badge && (
                  <div style={{ position:"absolute", top:0, right:0,
                    background:"#FF9500", color:"#000", fontSize:7, fontWeight:700,
                    letterSpacing:1.5, padding:"4px 10px" }}>
                    {tier.badge}
                  </div>
                )}

                {/* Tier header */}
                <div style={{ marginBottom:28 }}>
                  <div style={{ fontSize:8, color:tier.accent, letterSpacing:3, marginBottom:12 }}>{tier.name}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:40, fontWeight:700, color:"#F0F0F0", letterSpacing:-2 }}>{tier.price}</span>
                    <span style={{ fontSize:11, color:"#444" }}>{tier.sub}</span>
                  </div>
                  {ti > 0 && <div style={{ fontSize:8, color:"#333", letterSpacing:1 }}>7-DAY FREE TRIAL</div>}
                </div>

                {/* CTA */}
                <button onClick={()=>router.push("/login")} style={{
                  width:"100%", padding:"11px 0",
                  background:ti===1?"#FF9500":ti===2?"transparent":"transparent",
                  color:ti===1?"#000":ti===2?"#00AAFF":"#888",
                  border:ti===1?"none":ti===2?"1px solid #00AAFF":"1px solid #333",
                  fontSize:9, fontWeight:700, letterSpacing:2,
                  cursor:"pointer", fontFamily:"inherit", marginBottom:28,
                  transition:"all 0.15s",
                }}
                onMouseEnter={e=>{
                  if(ti===1){e.currentTarget.style.opacity="0.85";}
                  else if(ti===2){e.currentTarget.style.background="#00AAFF";e.currentTarget.style.color="#000";}
                  else{e.currentTarget.style.borderColor="#555";e.currentTarget.style.color="#F0F0F0";}
                }}
                onMouseLeave={e=>{
                  if(ti===1){e.currentTarget.style.opacity="1";}
                  else if(ti===2){e.currentTarget.style.background="transparent";e.currentTarget.style.color="#00AAFF";}
                  else{e.currentTarget.style.borderColor="#333";e.currentTarget.style.color="#888";}
                }}>
                  {tier.cta}
                </button>

                {/* Features */}
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {tier.features.map(f=>(
                    <div key={f} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ color:tier.accent, fontSize:10, flexShrink:0, marginTop:1 }}>✓</span>
                      <span style={{ fontSize:10, color:"#888", lineHeight:1.4 }}>{f}</span>
                    </div>
                  ))}
                  {tier.locked.map(f=>(
                    <div key={f} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ color:"#222", fontSize:10, flexShrink:0, marginTop:1 }}>✗</span>
                      <span style={{ fontSize:10, color:"#333", lineHeight:1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:20, textAlign:"center", fontSize:9, color:"#333", letterSpacing:1 }}>
            All plans include access to the chart, drawing tools, watchlist, and news feed. Cancel anytime.
          </div>
        </div>
      </div>

      {/* ── CTA banner ── */}
      <div style={{ borderTop:"1px solid #1a1a1a", background:"#0a0a0a" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"64px 40px",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:40, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:9, color:"#FF9500", letterSpacing:2.5, marginBottom:14,
              display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:16, height:2, background:"#FF9500" }}/> FREE TO START
            </div>
            <div style={{ fontSize:"clamp(20px,3vw,34px)", fontWeight:700, lineHeight:1.15, color:"#F0F0F0" }}>
              No noise. No retail fluff.<br/><span style={{color:"#FF9500"}}>Just edge.</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:220 }}>
            <button onClick={()=>router.push("/login")} className="cta-primary"
              style={{ padding:"13px 0", width:"100%", fontSize:9 }}>
              GET STARTED FREE
            </button>
            <button onClick={()=>router.push("/chart/SPY")} className="cta-ghost"
              style={{ padding:"13px 0", width:"100%", fontSize:9 }}>
              LIVE DEMO — NO SIGN UP
            </button>
            <span style={{ fontSize:8, color:"#333", letterSpacing:1, textAlign:"center" }}>No credit card required</span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop:"1px solid #111", padding:"28px 40px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:16, marginBottom:20 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:3, color:"#2a2a2a" }}>
            T&amp;G <span style={{color:"#FF9500"}}>CHARTS</span>
          </span>
          {/* Social links */}
          <div style={{ display:"flex", gap:8 }}>
            {SOCIALS.map(s=>(
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                title={s.label}
                style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:32, height:32, border:"1px solid #1a1a1a",
                  color:"#444", textDecoration:"none", fontSize:9, fontWeight:700,
                  letterSpacing:0.5, transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#FF9500";e.currentTarget.style.color="#FF9500";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#444";}}>
                {s.icon}
              </a>
            ))}
          </div>
          {/* Nav links */}
          <div style={{ display:"flex", gap:24 }}>
            {[["CHART","/chart/SPY"],["SCANNER","/scanner"],["GEX","/gex"],["LIVE","/live"],["LOGIN","/login"]].map(([l,h])=>(
              <a key={l} href={h} className="nav-link" style={{ fontSize:8, letterSpacing:2 }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop:"1px solid #0d0d0d", paddingTop:16,
          display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontSize:8, color:"#1a1a1a", letterSpacing:1 }}>© 2026 TRADES &amp; GAINS</span>
          <span style={{ fontSize:8, color:"#1a1a1a", letterSpacing:1 }}>
            Powered by Massive.com · Not financial advice
          </span>
        </div>
      </div>
    </div>
  );
}
