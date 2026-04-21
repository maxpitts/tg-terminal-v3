"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ScanResult {
  ticker:string; price:number; chg:number; volume:number; volRatio:number;
  regime:string; totalGex:number; flipStrike:number; distToFlip:number; signal:string|null;
}

export default function ScannerClient() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [sort, setSort] = useState<keyof ScanResult>("chg");
  const [sortDir, setSortDir] = useState<1|-1>(-1);
  const [filter, setFilter] = useState<"all"|"bullish"|"bearish"|"neg-gex"|"pos-gex">("all");
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/scanner");
      const d = await r.json();
      setResults(d.results);
      setUpdatedAt(new Date(d.updatedAt).toLocaleTimeString());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 5*60*1000); return () => clearInterval(t); }, []);

  const col = (header: string, key: keyof ScanResult) => (
    <th onClick={() => { if(sort===key) setSortDir(d=>d===-1?1:-1); else{setSort(key);setSortDir(-1);} }}
      style={{padding:"6px 12px",fontSize:9,color:sort===key?"#FF9500":"#333333",letterSpacing:1,
        cursor:"pointer",textAlign:"left",borderBottom:"1px solid rgba(255,255,255,0.07)",whiteSpace:"nowrap"}}>
      {header}{sort===key?(sortDir===-1?" ▼":" ▲"):""}
    </th>
  );

  const filtered = results.filter(r => {
    if(filter==="bullish") return r.signal==="BULLISH";
    if(filter==="bearish") return r.signal==="BEARISH";
    if(filter==="neg-gex") return r.totalGex < -50;
    if(filter==="pos-gex") return r.totalGex > 50;
    return true;
  }).sort((a,b) => {
    const av = a[sort] as number, bv = b[sort] as number;
    return (av - bv) * sortDir;
  });

  const regimeCol = (r:string) => ["NEGATIVE GEX"].includes(r)?"#FF3333":r==="POSITIVE GEX"?"#00CC44":"#FF9500";

  return (
    <div style={{minHeight:"100vh",background:"#000000",color:"#E0E0E0",fontFamily:"'JetBrains Mono',monospace"}}>
      {/* Header */}
      <div style={{background:"#0a0a0a",borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:isMobile?"8px 12px":"10px 20px",display:"flex",alignItems:"center",gap:isMobile?8:12}}>
        <a href="/chart/SPY" style={{color:"#666666",textDecoration:"none",fontSize:11}}>← Charts</a>
        <span style={{color:"#1e293b"}}>|</span>
        <span style={{fontSize:13,fontWeight:700,color:"#FF9500"}}>⚡ SCANNER</span>
        <span style={{fontSize:9,color:"#333333"}}>Top movers · GEX regime · Vol surge</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:9,color:"#333333"}}>{updatedAt?`Updated ${updatedAt}`:""}</span>
          <button onClick={load} disabled={loading}
            style={{background:"rgba(255,149,0,0.08)",border:"1px solid rgba(167,139,250,0.3)",
              color:"#FF9500",borderRadius:5,fontSize:10,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}>
            {loading?"Scanning...":"↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{padding:"10px 20px",display:"flex",gap:6}}>
        {(["all","bullish","bearish","neg-gex","pos-gex"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{fontSize:10,padding:"3px 10px",borderRadius:4,cursor:"pointer",fontFamily:"inherit",border:"1px solid",
              borderColor:filter===f?"#FF9500":"#222222",
              background:filter===f?"rgba(255,149,0,0.12)":"transparent",
              color:filter===f?"#FF9500":"#666666"}}>
            {f==="all"?"All":f==="bullish"?"🟢 Bullish":f==="bearish"?"🔴 Bearish":f==="neg-gex"?"Γ Neg GEX":"Γ Pos GEX"}
          </button>
        ))}
        <span style={{marginLeft:"auto",fontSize:10,color:"#333333"}}>{filtered.length} tickers</span>
      </div>

      {/* Table */}
      <div style={{padding:isMobile?"0 8px":"0 20px",overflowX:isMobile?"hidden":"auto"}}>
        {loading && results.length===0 ? (
          <div style={{padding:40,textAlign:"center",color:"#333333",fontSize:12}}>Scanning market...</div>
        ) : isMobile ? (
          /* Mobile card grid */
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,paddingBottom:16}}>
            {filtered.map(r=>(
              <div key={r.ticker} onClick={()=>router.push(`/chart/${r.ticker}`)}
                style={{background:"#111111",border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:8,padding:"10px 12px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#F0F0F0"}}>{r.ticker}</span>
                  <span style={{fontSize:12,fontWeight:600,color:r.chg>=0?"#00CC44":"#FF5555"}}>
                    {r.chg>=0?"+":""}{r.chg.toFixed(2)}%
                  </span>
                </div>
                <div style={{fontSize:12,color:"#888888",marginBottom:6}}>${r.price.toFixed(2)}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:9,padding:"2px 5px",borderRadius:3,
                    background:`${regimeCol(r.regime)}18`,color:regimeCol(r.regime),
                    border:`1px solid ${regimeCol(r.regime)}33`}}>
                    {r.regime==="NEGATIVE GEX"?"NEG Γ":r.regime==="POSITIVE GEX"?"POS Γ":"NEUT"}
                  </span>
                  {r.signal&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:3,fontWeight:700,
                    background:r.signal==="BULLISH"?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",
                    color:r.signal==="BULLISH"?"#00CC44":"#FF5555"}}>
                    {r.signal==="BULLISH"?"▲":"▼"}
                  </span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table */
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"#0d0d0d"}}>
                {col("TICKER","ticker")}{col("PRICE","price")}{col("CHG %","chg")}
                {col("VOL RATIO","volRatio")}{col("GEX REGIME","regime")}
                {col("TOTAL GEX","totalGex")}{col("FLIP","flipStrike")}{col("DIST TO FLIP","distToFlip")}
                <th style={{padding:"6px 12px",fontSize:9,color:"#333333",letterSpacing:1,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>SIGNAL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.ticker} onClick={()=>router.push(`/chart/${r.ticker}`)}
                  style={{borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",transition:"background 0.1s"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="#111111")}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                  <td style={{padding:"8px 12px",fontWeight:700,color:"#F0F0F0"}}>{r.ticker}</td>
                  <td style={{padding:"8px 12px",color:"#888888"}}>${r.price.toFixed(2)}</td>
                  <td style={{padding:"8px 12px",color:r.chg>=0?"#00CC44":"#FF5555",fontWeight:600}}>
                    {r.chg>=0?"+":""}{r.chg.toFixed(2)}%
                  </td>
                  <td style={{padding:"8px 12px",color:r.volRatio>1.5?"#FF9500":r.volRatio>1?"#888888":"#555555"}}>
                    {r.volRatio.toFixed(2)}x
                  </td>
                  <td style={{padding:"8px 12px"}}>
                    <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                      background:`${regimeCol(r.regime)}18`,color:regimeCol(r.regime),border:`1px solid ${regimeCol(r.regime)}33`}}>
                      {r.regime||"—"}
                    </span>
                  </td>
                  <td style={{padding:"8px 12px",color:r.totalGex<0?"#FF5555":"#00CC44",fontWeight:600}}>
                    {r.totalGex<0?"-":""}${Math.abs(r.totalGex).toFixed(0)}M
                  </td>
                  <td style={{padding:"8px 12px",color:"#FF9500"}}>${r.flipStrike}</td>
                  <td style={{padding:"8px 12px",color:Math.abs(r.distToFlip)<1?"#FF5555":Math.abs(r.distToFlip)<3?"#FF9500":"#555555"}}>
                    {r.distToFlip>=0?"+":""}{r.distToFlip.toFixed(2)}%
                  </td>
                  <td style={{padding:"8px 12px"}}>
                    {r.signal&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:3,fontWeight:700,
                      background:r.signal==="BULLISH"?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",
                      color:r.signal==="BULLISH"?"#00CC44":"#FF5555",border:`1px solid ${r.signal==="BULLISH"?"#4ade8033":"#f8717133"}`}}>
                      {r.signal}
                    </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
