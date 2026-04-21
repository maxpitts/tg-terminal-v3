"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface Strike { strike:number; netGex:number; callGex:number; putGex:number; callOI:number; putOI:number; delta:number; }
interface GexData { ticker:string; spot:number; expiry:string; totalGex:number; flipStrike:number; flipZoneLo:number; flipZoneHi:number; flipConviction:number; flipRaw:number; flipVolumeWeighted:number; flipDTEWeighted:number; dealerBias:string; regime:string; strikes:Strike[]; error?:string; staleWarning?:string|null; liveMarket?:boolean; }

function fmtM(v:number) {
  const a=Math.abs(v);
  if(a>=1000) return `${v<0?"-":""}$${(a/1000).toFixed(1)}B`;
  if(a>=1)    return `${v<0?"-":""}$${Math.round(a)}M`;
  return `${v<0?"-":""}$${(a*1000).toFixed(0)}K`;
}

export default function GexPanel({ ticker }: { ticker: string }) {
  const [data, setData]         = useState<GexData|null>(null);
  const [input, setInput]       = useState(ticker);
  const [curTicker, setCur]     = useState(ticker);
  const [loading, setLoading]   = useState(false);
  const [livePrice, setLivePrice] = useState<{price:number;chg:number;pct:number}|null>(null);
  const [hotStrikes, setHotStrikes] = useState<Set<number>>(new Set<number>());
  const prevSpot = useRef<number>(0);
  const dataRef  = useRef<GexData|null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const load = useCallback(async (t:string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gex?ticker=${t}&_t=${Date.now()}`);
      const d   = await res.json();
      setData(d);
      prevSpot.current = d.spot||0;
    } catch { setData(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(curTicker);
    const t = setInterval(() => load(curTicker), 3*60*1000);
    return () => clearInterval(t);
  }, [curTicker, load]);

  // 15s price poll
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/polygon/snapshot?tickers=${curTicker}&_t=${Date.now()}`);
        const d   = await res.json();
        const t   = d.tickers?.[0];
        if(!t) return;
        setLivePrice({ price:t.price, chg:t.change||0, pct:t.changePct||0 });
        const d2 = dataRef.current;
        if(d2?.strikes && prevSpot.current && t.price) {
          const lo=Math.min(prevSpot.current,t.price), hi=Math.max(prevSpot.current,t.price);
          const crossed=new Set<number>(d2.strikes.filter(s=>s.strike>=lo&&s.strike<=hi&&Math.abs(s.netGex)>1).map(s=>s.strike as number));
          if(crossed.size>0){ setHotStrikes(crossed); setTimeout(()=>setHotStrikes(new Set<number>()),8000); }
          prevSpot.current=t.price;
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [curTicker]);

  const go = () => {
    const t=input.trim().toUpperCase();
    if(t&&t!==curTicker){ setCur(t); setData(null); setLivePrice(null); }
  };

  const spot   = livePrice?.price||data?.spot||0;
  const maxAbs = data?.strikes?.length ? Math.max(...data.strikes.map(s=>Math.abs(s.netGex)),1) : 1;
  const regimeCol = data?.regime==="NEGATIVE GEX"?"#FF3333":data?.regime==="POSITIVE GEX"?"#00CC44":"#FF9500";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:"'JetBrains Mono',monospace",background:"#000000"}}>

      {/* Header */}
      <div style={{padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#FF9500"}}>Γ GEX</span>
          <input value={input} onChange={e=>setInput(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&go()} maxLength={6}
            style={{background:"#181818",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:4,color:"#fff",fontSize:12,fontWeight:700,
              fontFamily:"'JetBrains Mono',monospace",padding:"2px 6px",width:60,outline:"none"}}/>
          <button onClick={go} style={{background:"#FF9500",color:"#fff",border:"none",
            borderRadius:4,fontSize:9,padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>GO</button>
          <button onClick={()=>load(curTicker)} disabled={loading}
            style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"#666666",
              borderRadius:4,fontSize:10,padding:"2px 6px",cursor:"pointer",fontFamily:"inherit"}}>
            {loading?"…":"↺"}
          </button>
        </div>

        {data&&!data.error&&(
          <>
            {data.staleWarning && (
              <div style={{fontSize:8,color:"#FF9500",background:"rgba(240,196,64,0.08)",
                border:"1px solid rgba(240,196,64,0.2)",borderRadius:3,padding:"2px 6px",marginBottom:4}}>
                ⚠ {data.staleWarning}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <span style={{fontSize:15,fontWeight:700,color:"#F0F0F0"}}>${spot.toFixed(2)}</span>
              {livePrice&&<span style={{fontSize:9,color:"#00CC44",padding:"1px 4px",background:"rgba(34,197,94,0.1)",borderRadius:3}}>LIVE</span>}
              {livePrice&&<span style={{fontSize:10,color:livePrice.chg>=0?"#00CC44":"#FF3333"}}>{livePrice.chg>=0?"+":""}{livePrice.chg.toFixed(2)} ({livePrice.pct.toFixed(2)}%)</span>}
              <span style={{marginLeft:"auto",fontSize:8,padding:"1px 5px",borderRadius:3,
                border:`1px solid ${regimeCol}44`,background:`${regimeCol}18`,color:regimeCol}}>{data.regime}</span>
            </div>
            <div style={{display:"flex",gap:5}}>
              <div style={{flex:1,background:"#111111",borderRadius:4,padding:"3px 6px"}}>
                <div style={{fontSize:7,color:"#333333"}}>TOTAL GEX</div>
                <div style={{fontSize:11,fontWeight:700,color:data.totalGex<0?"#FF3333":"#00CC44"}}>{fmtM(data.totalGex)}M</div>
              </div>
              <div style={{flex:1,background:"#111111",borderRadius:4,padding:"3px 6px"}}>
                <div style={{fontSize:7,color:"#333333"}}>FLIP ZONE</div>
                <div style={{fontSize:9,fontWeight:700,color:"#FF9500"}}>${data.flipZoneLo}–{data.flipZoneHi}</div>
              </div>
              <div style={{flex:1,background:"#111111",borderRadius:4,padding:"3px 6px"}}>
                <div style={{fontSize:7,color:"#333333"}}>CONVICTION</div>
                <div style={{fontSize:11,fontWeight:700,color:data.flipConviction>=70?"#00CC44":data.flipConviction>=40?"#FF9500":"#FF3333"}}>{data.flipConviction}%</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Col headers */}
      <div style={{display:"grid",gridTemplateColumns:"44px 1fr 60px",gap:2,
        padding:"4px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)",
        fontSize:8,color:"#333333",letterSpacing:1,flexShrink:0}}>
        <span>STRIKE</span><span>Δ / BAR</span><span style={{textAlign:"right"}}>NET</span>
      </div>

      {/* Strikes */}
      <div style={{flex:1,overflowY:"auto"}}>
        {loading&&!data&&<div style={{padding:16,color:"#333333",fontSize:10,textAlign:"center"}}>Loading {curTicker}...</div>}
        {data?.error&&<div style={{padding:16,color:"#FF3333",fontSize:10,textAlign:"center"}}>{data.error}</div>}
        {data?.strikes?.map(row=>{
          const isCur=Math.abs(row.strike-spot)<0.5;
          const isHot=hotStrikes.has(row.strike);
          const isNear=Math.abs(row.strike-spot)/spot<0.008;
          const pct=Math.min(1,Math.abs(row.netGex)/maxAbs);
          const pos=row.netGex>=0;
          const gc=pos?"#00CC44":"#FF3333";
          const bg=isHot?"rgba(255,202,40,0.15)":isCur?"rgba(240,196,64,0.07)":pos?`rgba(34,197,94,${0.04+pct*0.28})`:`rgba(239,68,68,${0.04+pct*0.28})`;
          return (
            <div key={row.strike} style={{display:"grid",gridTemplateColumns:"44px 1fr 60px",
              gap:2,padding:"2px 8px",alignItems:"center",
              borderBottom:"1px solid rgba(255,255,255,0.03)",
              borderLeft:isHot?"2px solid #ffca28":isCur?"2px solid #f0c040":isNear?`2px solid ${gc}66`:"2px solid transparent",
              background:bg}}>
              <span style={{fontSize:9,fontWeight:isCur||isHot?700:400,color:isHot?"#ffca28":isCur?"#FF9500":isNear?gc:"#555555"}}>
                {row.strike}{isHot?" 🔥":""}
              </span>
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                {row.delta!==0&&<span style={{fontSize:7,padding:"1px 3px",borderRadius:2,fontWeight:700,flexShrink:0,
                  background:row.delta>0?"rgba(34,197,94,0.18)":"rgba(239,68,68,0.18)",
                  color:row.delta>0?"#00CC44":"#FF3333"}}>{row.delta>0?"+":""}{row.delta}%</span>}
                <div style={{flex:1,height:5,background:"#131313",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${Math.round(pct*100)}%`,height:"100%",background:gc,borderRadius:2}}/>
                </div>
              </div>
              <span style={{fontSize:9,textAlign:"right",fontWeight:600,color:gc}}>{fmtM(row.netGex)}</span>
            </div>
          );
        })}
      </div>

      {data&&!data.error&&(
        <div style={{padding:"4px 8px",borderTop:"1px solid rgba(255,255,255,0.05)",
          display:"flex",justifyContent:"space-between",fontSize:8,flexShrink:0}}>
          <span style={{color:"#333333"}}>OI-weighted · 3min</span>
          <span style={{color:"#555555"}}>{data.strikes?.length||0} strikes</span>
        </div>
      )}
    </div>
  );
}
