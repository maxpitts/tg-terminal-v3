"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface Strike { strike:number; netGex:number; callGex:number; putGex:number;
  callOI:number; putOI:number; delta:number; netVanna:number; netCharm:number; }
interface GexByExpiry { expiry:string; dte:number; totalGex:number; flipStrike:number; regime:string; }
interface HeatmapRow { expiry:string; dte:number; cells:{strike:number;netGex:number}[]; }
interface PinZone { price:number; gex:number; strength:number; }
interface GexData {
  ticker:string; spot:number; expiry:string;
  totalGex:number; totalVanna:number; totalCharm:number;
  flipStrike:number; flipZoneLo:number; flipZoneHi:number;
  flipConviction:number; flipRaw:number; flipVolumeWeighted:number; flipDTEWeighted:number;
  dealerDeltaTotal:number; dealerBias:string;
  hedgePressure:number; hedgeDirection:string;
  pinZone:PinZone|null;
  gexImpliedMove:number; gexRangeLo:number; gexRangeHi:number; impliedVolUsed?:number;
  gexByExpiry:GexByExpiry[];
  heatmapStrikes:number[]; heatmapData:HeatmapRow[];
  regime:string; strikes:Strike[]; error?:string;
  staleWarning?:string|null; liveMarket?:boolean;
}

function fmtM(v:number) {
  const a=Math.abs(v);
  if(a>=1000) return `${v<0?"-":""}$${(a/1000).toFixed(1)}B`;
  if(a>=1)    return `${v<0?"-":""}$${a.toFixed(0)}M`;
  return `${v<0?"-":""}$${(a*1000).toFixed(0)}K`;
}

// ── GEX Heatmap ──────────────────────────────────────────────────────────
function GexHeatmap({ strikes, rows, spot }:{ strikes:number[]; rows:HeatmapRow[]; spot:number }) {
  if (!rows?.length||!strikes?.length) return (
    <div style={{padding:24,fontSize:10,color:"#444",textAlign:"center"}}>Loading heatmap...</div>
  );

  const allVals = rows.flatMap(r=>r.cells.map(c=>c.netGex));
  const maxAbs  = Math.max(...allVals.map(Math.abs), 0.001);

  const cellColor = (v:number) => {
    const intensity = Math.min(1, Math.abs(v)/maxAbs);
    if (v>0) return `rgba(0,204,68,${0.07+intensity*0.75})`;
    if (v<0) return `rgba(255,51,51,${0.07+intensity*0.75})`;
    return "#080808";
  };

  // Vertical layout: strikes on Y axis (rows), expiries on X axis (columns)
  // Much more readable — fewer expiries (5) than strikes (30+)
  const sortedStrikes = [...strikes].sort((a,b)=>b-a); // high → low

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {/* Legend + context */}
      <div style={{display:"flex",gap:16,alignItems:"center",padding:"6px 0",
        fontSize:9,color:"#444",flexWrap:"wrap" as const}}>
        <span><span style={{color:"#00CC44",marginRight:4}}>■</span>Positive GEX — call wall</span>
        <span><span style={{color:"#FF3333",marginRight:4}}>■</span>Negative GEX — put wall</span>
        <span style={{color:"#FF9500"}}>→ Orange row = current price</span>
        <span style={{color:"#555",marginLeft:"auto"}}>Darker = stronger dealer activity</span>
      </div>

      {/* Table: strikes as rows, expiries as columns */}
      <div style={{border:"1px solid #1a1a1a",overflowY:"auto",maxHeight:500}}>
        <table style={{borderCollapse:"collapse",width:"100%"}}>
          <thead style={{position:"sticky",top:0,zIndex:2}}>
            <tr style={{background:"#0a0a0a"}}>
              {/* Strike column header */}
              <th style={{padding:"8px 12px",fontSize:9,color:"#555",
                textAlign:"left",borderBottom:"1px solid #222",
                whiteSpace:"nowrap" as const,width:80,letterSpacing:1}}>
                STRIKE
              </th>
              {/* Expiry columns */}
              {rows.map(row=>(
                <th key={row.expiry} style={{padding:"8px 10px",fontSize:9,
                  textAlign:"center",borderBottom:"1px solid #222",
                  borderLeft:"1px solid #111",whiteSpace:"nowrap" as const,minWidth:80}}>
                  <div style={{color:"#888",fontWeight:700}}>{row.expiry.slice(5)}</div>
                  <div style={{fontSize:8,color:"#444",marginTop:2}}>{row.dte.toFixed(0)}d</div>
                </th>
              ))}
              {/* Total column */}
              <th style={{padding:"8px 10px",fontSize:9,color:"#555",
                textAlign:"center",borderBottom:"1px solid #222",
                borderLeft:"1px solid #333",whiteSpace:"nowrap" as const,minWidth:70}}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStrikes.map(s=>{
              const isSpot  = Math.abs(s-spot)<0.5;
              const isNear  = Math.abs(s-spot)/spot<0.005;
              // Total GEX at this strike across all expiries
              const total   = rows.reduce((sum,row)=>{
                const cell = row.cells.find(c=>c.strike===s);
                return sum+(cell?.netGex||0);
              },0);

              return (
                <tr key={s} style={{
                  borderBottom:"1px solid #0d0d0d",
                  background:isSpot?"rgba(255,149,0,0.07)":isNear?"rgba(255,149,0,0.03)":"transparent",
                  borderLeft:isSpot?"3px solid #FF9500":isNear?"3px solid rgba(255,149,0,0.3)":"3px solid transparent",
                }}>
                  {/* Strike price */}
                  <td style={{padding:"5px 12px",fontSize:10,fontWeight:isSpot?700:500,
                    color:isSpot?"#FF9500":isNear?"#F0F0F0":"#666",
                    whiteSpace:"nowrap" as const,borderRight:"1px solid #1a1a1a"}}>
                    ${s}
                    {isSpot&&<span style={{fontSize:8,color:"#FF9500",marginLeft:6}}>◄ SPOT</span>}
                  </td>
                  {/* GEX per expiry */}
                  {rows.map(row=>{
                    const cell = row.cells.find(c=>c.strike===s);
                    const v    = cell?.netGex||0;
                    return (
                      <td key={row.expiry} title={`${row.expiry} $${s}: ${fmtM(v)}`}
                        style={{padding:"5px 8px",textAlign:"center",
                          background:cellColor(v),borderLeft:"1px solid #0d0d0d",
                          fontSize:9,fontWeight:Math.abs(v)>1?700:400,
                          color:v>0?"#00CC44":v<0?"#FF3333":"#333",
                          transition:"opacity 0.1s"}}>
                        {Math.abs(v)>0.3?fmtM(v):""}
                      </td>
                    );
                  })}
                  {/* Row total */}
                  <td style={{padding:"5px 8px",textAlign:"center",
                    borderLeft:"1px solid #222",fontSize:9,fontWeight:700,
                    color:total>0?"#00CC44":total<0?"#FF3333":"#444",
                    background:total!==0?cellColor(total):"transparent"}}>
                    {Math.abs(total)>0.1?fmtM(total):""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",
        gap:1,background:"#1a1a1a",border:"1px solid #1a1a1a"}}>
        {rows.map(row=>{
          const total = row.cells.reduce((s,c)=>s+c.netGex,0);
          return (
            <div key={row.expiry} style={{padding:"8px 10px",background:"#000",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#444",marginBottom:4}}>{row.expiry.slice(5)} ({row.dte.toFixed(0)}d)</div>
              <div style={{fontSize:12,fontWeight:700,color:total>0?"#00CC44":"#FF3333"}}>
                {fmtM(total)}
              </div>
              <div style={{fontSize:8,color:"#333",marginTop:2}}>
                {total>0?"pos":"neg"} GEX
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Expiry breakdown ─────────────────────────────────────────────────────
function ExpiryBreakdown({ data, spot }:{ data:GexByExpiry[]; spot:number }) {
  if (!data?.length) return null;
  const maxAbs = Math.max(...data.map(d=>Math.abs(d.totalGex)),1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {data.map(d=>{
        const pct  = Math.abs(d.totalGex)/maxAbs;
        const col  = d.regime==="NEG"?"#FF3333":d.regime==="POS"?"#00CC44":"#555";
        const dist = ((d.flipStrike-spot)/spot*100);
        return (
          <div key={d.expiry} style={{display:"grid",gridTemplateColumns:"80px 1fr 70px 60px",
            alignItems:"center",gap:8}}>
            <span style={{fontSize:8,color:"#555"}}>{d.expiry.slice(5)} <span style={{color:"#333"}}>({d.dte.toFixed(0)}d)</span></span>
            <div style={{height:4,background:"#111",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${Math.round(pct*100)}%`,height:"100%",background:col,borderRadius:2}}/>
            </div>
            <span style={{fontSize:8,fontWeight:700,color:col,textAlign:"right"}}>{fmtM(d.totalGex)}</span>
            <span style={{fontSize:8,color:Math.abs(dist)<2?"#FF9500":"#444",textAlign:"right"}}>
              flip ${d.flipStrike}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main terminal ─────────────────────────────────────────────────────────
// ── MM Insights generator ────────────────────────────────────────────────
function generateInsights(data: GexData, spot: number): string[] {
  if (!data||!spot) return [];
  const insights: string[] = [];
  const distToFlip = ((data.flipStrike-spot)/spot*100);
  const absDist    = Math.abs(distToFlip);

  // Regime
  if (data.regime==="NEGATIVE GEX")
    insights.push(`⚠ NEGATIVE GEX environment — dealers are SHORT gamma and AMPLIFY price moves. Expect higher volatility and faster moves in both directions.`);
  else if (data.regime==="POSITIVE GEX")
    insights.push(`✓ POSITIVE GEX environment — dealers are LONG gamma and act as a stabilizer. Price tends to mean-revert toward large GEX strikes.`);

  // Flip distance
  if (absDist<0.5)
    insights.push(`⚡ Price is within 0.5% of the GEX flip ($${data.flipStrike.toFixed(2)}). Dealer behavior can FLIP regime at any moment — elevated volatility risk.`);
  else if (absDist<2)
    insights.push(`△ Flip level at $${data.flipStrike.toFixed(2)} is ${distToFlip>0?"above":"below"} current price by ${absDist.toFixed(2)}%. ${distToFlip>0?"A move higher":"A move lower"} could trigger a regime change.`);

  // Pinning
  if (data.pinZone&&data.pinZone.strength>60&&Math.abs(data.pinZone.price-spot)<3)
    insights.push(`📍 Strong gamma PIN at $${data.pinZone.price} (strength ${data.pinZone.strength}%). Market makers must hedge heavily here, creating a gravitational pull on price.`);

  // Hedge pressure
  if (data.hedgePressure>50000)
    insights.push(`💥 HIGH hedge pressure: ${(data.hedgePressure/1000).toFixed(0)}K shares per $1 move. Every tick forces large dealer orders — momentum moves can be violent.`);

  // Vanna
  if (Math.abs(data.totalVanna||0)>500)
    insights.push(`${(data.totalVanna||0)>0?"↑":"↓"} VANNA: ${(data.totalVanna||0)>0?"Rising IV helps dealers buy delta (supportive).":"Rising IV forces dealers to sell delta (bearish pressure)."} Total: ${(data.totalVanna||0).toFixed(0)}M`);

  // Expiry divergence
  if (data.gexByExpiry?.length>=2) {
    const near = data.gexByExpiry[0];
    const far  = data.gexByExpiry[1];
    if (near.regime!==far.regime&&near.regime!=="NEUT"&&far.regime!=="NEUT")
      insights.push(`⚡ EXPIRY DIVERGENCE: ${near.expiry} is ${near.regime} GEX (flip $${near.flipStrike}) but ${far.expiry} is ${far.regime} GEX (flip $${far.flipStrike}). Crossed expiries = complex dealer positioning.`);
  }

  // Expected move
  if (data.gexImpliedMove)
    insights.push(`📊 GEX-implied daily range: $${data.gexRangeLo} – $${data.gexRangeHi} (±${data.gexImpliedMove.toFixed(2)}%). Price outside this range faces stronger dealer resistance.`);

  return insights;
}

export default function GexTerminal() {
  const [panels, setPanels]       = useState([{ticker:"SPY",data:null as GexData|null,loading:false,livePrice:null as any}]);
  const [panelCount, setPanelCount] = useState(1);
  const [activeTab, setActiveTab]   = useState<Record<number,string>>({0:"overview"});
  const [hotStrikes, setHotStrikes] = useState<Record<number,Set<number>>>({});
  const prevSpots = useRef<Record<number,number>>({});
  const dataRefs  = useRef<Record<number,GexData|null>>({});

  const loadGex = useCallback(async (idx:number, ticker:string) => {
    setPanels(prev=>prev.map((p,i)=>i===idx?{...p,loading:true}:p));
    try {
      const r = await fetch(`/api/gex?ticker=${ticker}&_t=${Date.now()}`);
      const d = await r.json();
      dataRefs.current[idx] = d;
      setPanels(prev=>prev.map((p,i)=>i===idx?{...p,data:d,loading:false}:p));
      prevSpots.current[idx] = d.spot||0;
    } catch {
      setPanels(prev=>prev.map((p,i)=>i===idx?{...p,loading:false}:p));
    }
  }, []);

  useEffect(()=>{
    panels.forEach((p,i)=>{ loadGex(i,p.ticker); });
    const t = setInterval(()=>panels.forEach((p,i)=>loadGex(i,p.ticker)), 3*60*1000);
    return ()=>clearInterval(t);
  }, [panelCount]);

  // 15s price poll
  useEffect(()=>{
    const poll = async ()=>{
      for (let i=0; i<panels.length; i++) {
        const p = panels[i];
        if (!p.ticker) continue;
        try {
          const r = await fetch(`/api/polygon/snapshot?tickers=${p.ticker}&_t=${Date.now()}`);
          const d = await r.json();
          const t = d.tickers?.[0];
          if (!t) continue;
          setPanels(prev=>prev.map((pp,ii)=>ii===i?{...pp,livePrice:{price:t.price,chg:t.change,pct:t.changePct}}:pp));
          const d2 = dataRefs.current[i];
          if (d2?.strikes&&prevSpots.current[i]&&t.price) {
            const lo=Math.min(prevSpots.current[i],t.price),hi=Math.max(prevSpots.current[i],t.price);
            const crossed=new Set(d2.strikes.filter(s=>s.strike>=lo&&s.strike<=hi&&Math.abs(s.netGex)>1).map(s=>s.strike));
            if(crossed.size>0){
              setHotStrikes(prev=>({...prev,[i]:crossed}));
              setTimeout(()=>setHotStrikes(prev=>({...prev,[i]:new Set()})),8000);
            }
            prevSpots.current[i]=t.price;
          }
        } catch {}
      }
    };
    poll();
    const t=setInterval(poll,15000);
    return ()=>clearInterval(t);
  },[panels.length]);

  const tabs = (idx:number) => [
    {id:"overview",   label:"Overview"},
    {id:"expiry",     label:"By Expiry"},
    {id:"vanna",      label:"Vanna/Charm"},
    {id:"heatmap",    label:"Heatmap"},
    {id:"strikes",    label:"Strikes"},
  ];

  const regimeCol = (r?:string) =>
    r==="NEGATIVE GEX"?"#FF3333":r==="POSITIVE GEX"?"#00CC44":"#FF9500";

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#F0F0F0",
      fontFamily:"'JetBrains Mono',monospace"}}>

      {/* Header */}
      <div style={{height:48,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 20px",background:"#000",borderBottom:"1px solid #1a1a1a",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <a href="/chart/SPY" style={{fontSize:9,color:"#444",textDecoration:"none",letterSpacing:1}}>← CHARTS</a>
          <span style={{color:"#1a1a1a"}}>|</span>
          <span style={{fontSize:11,fontWeight:700,color:"#FF9500",letterSpacing:2}}>Γ GEX TERMINAL</span>
          <span style={{fontSize:8,color:"#333",letterSpacing:1}}>DYNAMIC DEALER POSITIONING MODEL</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:8,color:"#444",letterSpacing:1}}>PANELS</span>
          {[1,2,3].map(n=>(
            <button key={n} onClick={()=>{setPanelCount(n);setPanels(Array.from({length:n},(_,i)=>panels[i]||{ticker:["SPY","QQQ","IWM"][i],data:null,loading:false,livePrice:null}));}}
              style={{padding:"3px 10px",fontSize:10,borderRadius:2,cursor:"pointer",fontFamily:"inherit",
                border:"1px solid",borderColor:panelCount===n?"#FF9500":"#222",
                background:panelCount===n?"rgba(255,149,0,0.1)":"transparent",
                color:panelCount===n?"#FF9500":"#555"}}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Panels */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${panelCount},1fr)`,
        gap:1,background:"#1a1a1a",height:"calc(100vh - 48px)"}}>
        {panels.slice(0,panelCount).map((panel,idx)=>{
          const data = panel.data;
          const spot = panel.livePrice?.price||data?.spot||0;
          const tab  = activeTab[idx]||"overview";
          const rc   = regimeCol(data?.regime);
          const hot  = hotStrikes[idx]||new Set();

          return (
            <div key={idx} style={{background:"#000",display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

              {/* Panel header */}
              <div style={{padding:"8px 12px",borderBottom:"1px solid #1a1a1a",flexShrink:0}}>
                {/* Ticker input */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <input defaultValue={panel.ticker}
                    onKeyDown={e=>{if(e.key==="Enter"){const t=(e.target as HTMLInputElement).value.toUpperCase();setPanels(prev=>prev.map((p,i)=>i===idx?{...p,ticker:t,data:null}:p));loadGex(idx,t);}}}
                    style={{background:"#0a0a0a",border:"1px solid #222",padding:"4px 8px",
                      fontSize:13,fontWeight:700,color:"#F0F0F0",width:70,fontFamily:"inherit",letterSpacing:1}}/>
                  <button onClick={()=>loadGex(idx,panel.ticker)} disabled={panel.loading}
                    style={{background:"none",border:"1px solid #222",color:"#444",padding:"3px 8px",
                      fontSize:10,cursor:"pointer",fontFamily:"inherit",letterSpacing:1}}>
                    {panel.loading?"...":"↺"}
                  </button>
                  {spot>0&&(
                    <span style={{fontSize:15,fontWeight:700,color:"#F0F0F0",letterSpacing:-0.5}}>
                      ${spot.toFixed(2)}
                    </span>
                  )}
                  {panel.livePrice&&(
                    <span style={{fontSize:9,color:panel.livePrice.pct>=0?"#00CC44":"#FF3333",fontWeight:700}}>
                      {panel.livePrice.pct>=0?"+":""}{panel.livePrice.pct?.toFixed(2)}%
                    </span>
                  )}
                  {data?.regime&&(
                    <span style={{marginLeft:"auto",fontSize:8,padding:"2px 8px",letterSpacing:1,
                      border:`1px solid ${rc}44`,background:`${rc}12`,color:rc,fontWeight:700}}>
                      {data.regime}
                    </span>
                  )}
                </div>

                {/* Stale warning */}
                {data?.staleWarning&&(
                  <div style={{fontSize:8,color:"#FF9500",background:"rgba(255,149,0,0.06)",
                    border:"1px solid rgba(255,149,0,0.2)",padding:"3px 8px",marginBottom:6,letterSpacing:0.5}}>
                    ⚠ {data.staleWarning}
                  </div>
                )}

                {/* Quick stats */}
                {data&&!data.error&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#111",marginBottom:8}}>
                    {[
                      ["TOTAL GEX", fmtM(data.totalGex), data.totalGex<0?"#FF3333":"#00CC44"],
                      ["FLIP ZONE", `$${data.flipZoneLo}–${data.flipZoneHi}`, "#FF9500"],
                      ["CONVICTION", `${data.flipConviction}%`, data.flipConviction>=70?"#00CC44":data.flipConviction>=40?"#FF9500":"#FF3333"],
                      ["HEDGE PRESS", `${(data.hedgePressure||0)>1000?((data.hedgePressure||0)/1000).toFixed(0)+"K":(data.hedgePressure||0).toFixed(0)} shs/$1`, data.hedgeDirection==="BUYING"?"#00CC44":"#FF3333"],
                    ].map(([l,v,c])=>(
                      <div key={l as string} style={{padding:"8px 10px",background:"#000",textAlign:"center"}}>
                        <div style={{fontSize:8,color:"#444",letterSpacing:1.5,marginBottom:4,textTransform:"uppercase" as const}}>{l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:c as string,letterSpacing:-0.5}}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab nav */}
                <div style={{display:"flex",gap:0,borderBottom:"1px solid #1a1a1a",marginBottom:-8}}>
                  {tabs(idx).map(t=>(
                    <button key={t.id} onClick={()=>setActiveTab(prev=>({...prev,[idx]:t.id}))}
                      style={{padding:"5px 12px",fontSize:8,cursor:"pointer",fontFamily:"inherit",
                        border:"none",borderBottom:tab===t.id?"2px solid #FF9500":"2px solid transparent",
                        background:"transparent",color:tab===t.id?"#FF9500":"#444",
                        letterSpacing:1,transition:"color 0.15s"}}>
                      {t.label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"12px",minHeight:0}}>
                {data?.error&&(
                  <div style={{padding:16,color:"#FF3333",fontSize:10,textAlign:"center"}}>{data.error}</div>
                )}
                {!data&&panel.loading&&(
                  <div style={{padding:16,color:"#333",fontSize:10,textAlign:"center"}}>Loading {panel.ticker}...</div>
                )}

                {data&&!data.error&&(

                  <>
                    {/* ── OVERVIEW ── */}
                    {tab==="overview"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>

                        {/* Dealer Positioning */}
                        <div style={{border:"1px solid #1a1a1a",padding:"14px 16px"}}>
                          <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:14}}>DEALER POSITIONING</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                            <div>
                              <div style={{fontSize:9,color:"#444",marginBottom:8,letterSpacing:1}}>WHAT ARE DEALERS DOING?</div>
                              <div style={{fontSize:20,fontWeight:700,letterSpacing:-0.5,marginBottom:8,
                                color:data.dealerBias?.includes("BUYING")?"#00CC44":data.dealerBias?.includes("SELLING")?"#FF3333":"#FF9500"}}>
                                {data.dealerBias?.includes("BUYING")?"BUYING DIPS":data.dealerBias?.includes("SELLING")?"SELLING RIPS":"BALANCED"}
                              </div>
                              <div style={{fontSize:11,color:"#555",lineHeight:1.6}}>
                                {data.dealerBias?.includes("BUYING")
                                  ?"Dealers must buy shares as price falls — creates a natural floor under the market."
                                  :data.dealerBias?.includes("SELLING")
                                  ?"Dealers must sell shares as price rises — creates a natural ceiling above the market."
                                  :"Dealer flow is neutral — no strong directional pressure from hedging."}
                              </div>
                            </div>
                            <div>
                              <div style={{fontSize:9,color:"#444",marginBottom:8,letterSpacing:1}}>HEDGING INTENSITY</div>
                              <div style={{fontSize:20,fontWeight:700,marginBottom:6,
                                color:data.hedgeDirection==="BUYING"?"#00CC44":"#FF3333"}}>
                                {(()=>{
                                  const p = data.hedgePressure||0;
                                  if (p>=1000000) return (p/1000000).toFixed(1)+"M";
                                  if (p>=1000)    return (p/1000).toFixed(0)+"K";
                                  return p.toFixed(0);
                                })()} shares / $1
                              </div>
                              <div style={{fontSize:11,color:"#555",lineHeight:1.6}}>
                                For every $1 move in {panel.ticker}, dealers must trade this many shares to stay hedged.
                                {(data.hedgePressure||0)>50000
                                  ?" ⚡ Very high — momentum moves can accelerate."
                                  :(data.hedgePressure||0)>20000
                                  ?" △ Elevated — expect choppy price action."
                                  :" Normal hedging levels."}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* GEX Pinning Zone */}
                        {data.pinZone&&(
                          <div style={{border:"1px solid rgba(255,149,0,0.2)",padding:"10px 12px",
                            background:"rgba(255,149,0,0.03)"}}>
                            <div style={{fontSize:7,color:"#FF9500",letterSpacing:2,marginBottom:8}}>
                              Γ GEX PINNING ZONE — MARKET GRAVITY CENTER
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:3}}>PIN PRICE</div>
                                <div style={{fontSize:16,fontWeight:700,color:"#FF9500"}}>${data.pinZone.price}</div>
                              </div>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:3}}>DIST FROM SPOT</div>
                                <div style={{fontSize:12,fontWeight:700,
                                  color:Math.abs(data.pinZone.price-spot)<1?"#FF9500":"#F0F0F0"}}>
                                  {((data.pinZone.price-spot)/spot*100).toFixed(2)}%
                                </div>
                              </div>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:3}}>STRENGTH</div>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <div style={{flex:1,height:4,background:"#111"}}>
                                    <div style={{width:`${data.pinZone.strength}%`,height:"100%",background:"#FF9500"}}/>
                                  </div>
                                  <span style={{fontSize:9,color:"#FF9500",fontWeight:700}}>{data.pinZone.strength}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* GEX-Implied Expected Move */}
                        <div style={{border:"1px solid #1a1a1a",padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={{fontSize:7,color:"#444",letterSpacing:2}}>ATM IV-IMPLIED DAILY RANGE</div>
                            {data.impliedVolUsed&&<div style={{fontSize:8,color:"#333"}}>IV: {data.impliedVolUsed}% annualized</div>}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                            <div>
                              <div style={{fontSize:7,color:"#333",marginBottom:4}}>DAILY MOVE ±</div>
                              <div style={{fontSize:18,fontWeight:700,color:"#00AAFF",letterSpacing:-1}}>{data.gexImpliedMove?.toFixed(2)}%</div>
                              <div style={{fontSize:8,color:"#444",marginTop:2}}>±${((spot||0)*data.gexImpliedMove/100).toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{fontSize:7,color:"#333",marginBottom:4}}>RANGE LOW</div>
                              <div style={{fontSize:16,fontWeight:700,color:"#FF3333",letterSpacing:-0.5}}>${data.gexRangeLo}</div>
                              <div style={{fontSize:8,color:"#444",marginTop:2}}>support zone</div>
                            </div>
                            <div>
                              <div style={{fontSize:7,color:"#333",marginBottom:4}}>RANGE HIGH</div>
                              <div style={{fontSize:16,fontWeight:700,color:"#00CC44",letterSpacing:-0.5}}>${data.gexRangeHi}</div>
                              <div style={{fontSize:8,color:"#444",marginTop:2}}>resistance zone</div>
                            </div>
                          </div>
                          <div style={{marginTop:10,height:6,background:"#111",position:"relative"}}>
                            {/* Range bar */}
                            {spot>0&&data.gexRangeLo&&data.gexRangeHi&&(()=>{
                              const rangeW  = data.gexRangeHi-data.gexRangeLo;
                              const spotPct = Math.max(0,Math.min(100,((spot-data.gexRangeLo)/rangeW)*100));
                              return (
                                <>
                                  <div style={{position:"absolute",left:0,right:0,top:0,height:"100%",
                                    background:"linear-gradient(to right,rgba(255,51,51,0.3),rgba(0,204,68,0.3))"}}/>
                                  <div style={{position:"absolute",left:`${spotPct}%`,top:-3,
                                    width:2,height:12,background:"#FF9500",transform:"translateX(-50%)"}}/>
                                </>
                              );
                            })()}
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"#333",marginTop:3}}>
                            <span>${data.gexRangeLo}</span>
                            <span style={{color:"#FF9500"}}>SPOT ${spot.toFixed(2)}</span>
                            <span>${data.gexRangeHi}</span>
                          </div>
                        </div>

                        {/* Flip methods */}
                        <div style={{border:"1px solid #1a1a1a",padding:"10px 12px"}}>
                          <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:8}}>FLIP LEVEL METHODS</div>
                          {[
                            ["RAW GEX",    data.flipRaw,             "#888"],
                            ["VOL-WEIGHTED",data.flipVolumeWeighted, "#888"],
                            ["DTE-WEIGHTED",data.flipDTEWeighted,    "#888"],
                            ["SYNTHETIC",  data.flipStrike,          "#FF9500"],
                          ].map(([l,v,c])=>(
                            <div key={l as string} style={{display:"flex",justifyContent:"space-between",
                              alignItems:"center",marginBottom:4}}>
                              <span style={{fontSize:8,color:"#444",letterSpacing:0.5}}>{l}</span>
                              <span style={{fontSize:10,fontWeight:700,color:c as string}}>${(v as number)?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Quick action summary */}
                        {spot>0&&data.flipStrike&&(
                          <div style={{border:`1px solid ${Math.abs(data.flipStrike-spot)/spot<0.02?"rgba(255,149,0,0.4)":"#1a1a1a"}`,
                            padding:"10px 12px",
                            background:Math.abs(data.flipStrike-spot)/spot<0.02?"rgba(255,149,0,0.05)":"transparent"}}>
                            <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:10}}>CURRENT MARKET CONTEXT</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:4}}>PRICE vs FLIP</div>
                                <div style={{fontSize:11,fontWeight:700,
                                  color:spot>data.flipStrike?"#00CC44":"#FF3333"}}>
                                  {spot>data.flipStrike?"ABOVE":"BELOW"} FLIP
                                </div>
                                <div style={{fontSize:9,color:"#444",marginTop:2}}>
                                  {Math.abs(((data.flipStrike-spot)/spot*100)).toFixed(2)}% away
                                </div>
                              </div>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:4}}>REGIME BEHAVIOR</div>
                                <div style={{fontSize:11,fontWeight:700,color:regimeCol(data.regime)}}>
                                  {data.regime==="NEGATIVE GEX"?"AMPLIFYING":"STABILIZING"}
                                </div>
                                <div style={{fontSize:9,color:"#444",marginTop:2}}>
                                  {data.regime==="NEGATIVE GEX"?"Moves accelerate":"Moves dampen"}
                                </div>
                              </div>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:4}}>PIN ATTRACTION</div>
                                <div style={{fontSize:11,fontWeight:700,color:"#FF9500"}}>
                                  ${data.pinZone?.price||"—"}
                                </div>
                                <div style={{fontSize:9,color:"#444",marginTop:2}}>
                                  {data.pinZone?`${data.pinZone.strength}% strength`:"No strong pin"}
                                </div>
                              </div>
                              <div>
                                <div style={{fontSize:7,color:"#333",marginBottom:4}}>TODAY'S GEX RANGE</div>
                                <div style={{fontSize:10,fontWeight:700,color:"#00AAFF"}}>
                                  ${data.gexRangeLo}–${data.gexRangeHi}
                                </div>
                                <div style={{fontSize:9,color:"#444",marginTop:2}}>
                                  ±{data.gexImpliedMove?.toFixed(1)}% implied
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Charm & Vanna summary */}
                        <div style={{border:"1px solid #1a1a1a",padding:"10px 12px"}}>
                          <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:10}}>GREEK EXPOSURE SUMMARY</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                            {[
                              {label:"VANNA",value:(data.totalVanna||0).toFixed(1)+"M",
                               sub:data.totalVanna>0?"IV↑ = dealer buying":"IV↑ = dealer selling",
                               col:(data.totalVanna||0)>0?"#00CC44":"#FF3333"},
                              {label:"CHARM",value:(data.totalCharm||0).toFixed(1)+"M",
                               sub:"Delta decay into close",col:"#00AAFF"},
                              {label:"HEDGE FLOW",value:(data.hedgePressure||0).toFixed(0)+"K/\$",
                               sub:data.hedgeDirection||"—",
                               col:data.hedgeDirection==="BUYING"?"#00CC44":"#FF3333"},
                              {label:"DEALER DELTA",value:(data.dealerDeltaTotal||0).toFixed(1)+"M",
                               sub:data.dealerBias||"—",
                               col:data.dealerBias?.includes("BUYING")?"#00CC44":data.dealerBias?.includes("SELLING")?"#FF3333":"#FF9500"},
                            ].map(g=>(
                              <div key={g.label} style={{padding:"8px 10px",background:"#0a0a0a",border:"1px solid #111"}}>
                                <div style={{fontSize:7,color:"#333",letterSpacing:1.5,marginBottom:4}}>{g.label}</div>
                                <div style={{fontSize:14,fontWeight:700,color:g.col}}>{g.value}</div>
                                <div style={{fontSize:8,color:"#444",marginTop:3}}>{g.sub}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* MM Insights */}
                        {(()=>{
                          const insights = generateInsights(data, spot);
                          if (!insights.length) return null;
                          return (
                            <div style={{border:"1px solid #1a1a1a"}}>
                              <div style={{padding:"6px 12px",borderBottom:"1px solid #1a1a1a",
                                display:"flex",alignItems:"center",gap:8,background:"#0a0a0a"}}>
                                <span style={{fontSize:7,color:"#FF9500",letterSpacing:2}}>MM FORCED HEDGING · LIVE ANALYSIS</span>
                              </div>
                              {insights.map((ins,i)=>(
                                <div key={i} style={{padding:"8px 12px",borderBottom:i<insights.length-1?"1px solid #0d0d0d":"none",
                                  display:"flex",gap:10,alignItems:"flex-start"}}>
                                  <span style={{fontSize:10,color:"#FF9500",flexShrink:0}}>•</span>
                                  <span style={{fontSize:10,color:"#666",lineHeight:1.6}}>{ins}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── BY EXPIRY ── */}
                    {tab==="expiry"&&(
                      <div>
                        <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:12}}>
                          GEX PROFILE BY EXPIRY — HOW EACH SESSION CONTRIBUTES
                        </div>
                        <ExpiryBreakdown data={data.gexByExpiry||[]} spot={spot}/>
                        {data.gexByExpiry?.length>0&&(
                          <div style={{marginTop:16,border:"1px solid #1a1a1a"}}>
                            <div style={{padding:"6px 10px",borderBottom:"1px solid #1a1a1a",
                              fontSize:7,color:"#444",letterSpacing:2}}>EXPIRY DETAIL</div>
                            {data.gexByExpiry.map(e=>{
                              const col=e.regime==="NEG"?"#FF3333":e.regime==="POS"?"#00CC44":"#555";
                              return (
                                <div key={e.expiry} style={{display:"grid",
                                  gridTemplateColumns:"90px 50px 80px 1fr 70px",
                                  gap:8,padding:"7px 10px",borderBottom:"1px solid #0d0d0d",
                                  alignItems:"center",fontSize:9}}>
                                  <span style={{color:"#666"}}>{e.expiry}</span>
                                  <span style={{color:"#444"}}>{e.dte.toFixed(1)}d</span>
                                  <span style={{color:col,fontWeight:700}}>{fmtM(e.totalGex)}</span>
                                  <span style={{fontSize:8,padding:"1px 6px",letterSpacing:1,
                                    color:col,border:`1px solid ${col}33`,background:`${col}0d`}}>{e.regime}</span>
                                  <span style={{color:"#FF9500",textAlign:"right"}}>flip ${e.flipStrike}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── VANNA / CHARM ── */}
                    {tab==="vanna"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>

                        {/* Plain English glossary */}
                        <div style={{border:"1px solid rgba(255,149,0,0.2)",background:"rgba(255,149,0,0.03)",padding:"10px 12px"}}>
                          <div style={{fontSize:7,color:"#FF9500",letterSpacing:2,marginBottom:10}}>WHAT DO THESE MEAN?</div>
                          {[
                            {term:"GAMMA",col:"#00CC44",  plain:"How fast dealer hedging must change per $1 move. High gamma = dealers trade a lot of shares as price moves."},
                            {term:"VANNA",col:"#00AAFF",  plain:"How dealer hedging changes when implied volatility changes. Think of it as the IV-sensitivity dial for dealer positions."},
                            {term:"CHARM",col:"#FF9500",  plain:"How dealer hedging changes as time passes (overnight, into close). High charm = expect buying or selling near end of day as options decay."},
                            {term:"GEX FLIP",col:"#FF9500",plain:"The price where dealer behavior switches from stabilizing (buying dips, selling rips) to amplifying (selling dips, buying rips). Crossing it = vol spike risk."},
                            {term:"PINNING",col:"#888",   plain:"Price gravity. When gamma is very high at a strike, dealers hedge so aggressively that price gets 'pinned' near that level."},
                          ].map(g=>(
                            <div key={g.term} style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:10,
                              marginBottom:8,paddingBottom:8,borderBottom:"1px solid #111"}}>
                              <span style={{fontSize:8,fontWeight:700,color:g.col,letterSpacing:1}}>{g.term}</span>
                              <span style={{fontSize:9,color:"#555",lineHeight:1.6}}>{g.plain}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{padding:"10px 12px",border:"1px solid #1a1a1a"}}>
                          <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:12}}>
                            VANNA EXPOSURE — DEALER DELTA SENSITIVITY TO IV CHANGES
                          </div>
                          <div style={{fontSize:8,color:"#555",lineHeight:1.7,marginBottom:12}}>
                            Positive total vanna = dealers <span style={{color:"#00CC44"}}>buy delta</span> when IV rises (supportive).
                            Negative = dealers <span style={{color:"#FF3333"}}>sell delta</span> when IV spikes (amplifies moves).
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            <div style={{padding:"10px",background:"#0a0a0a",border:"1px solid #111"}}>
                              <div style={{fontSize:7,color:"#333",marginBottom:4}}>TOTAL VANNA</div>
                              <div style={{fontSize:18,fontWeight:700,
                                color:data.totalVanna>0?"#00CC44":"#FF3333"}}>
                                {data.totalVanna>0?"+":""}{data.totalVanna?.toFixed(1)}M
                              </div>
                              <div style={{fontSize:8,color:"#444",marginTop:4}}>
                                {data.totalVanna>0?"IV spike = buying pressure":"IV spike = selling pressure"}
                              </div>
                            </div>
                            <div style={{padding:"10px",background:"#0a0a0a",border:"1px solid #111"}}>
                              <div style={{fontSize:7,color:"#333",marginBottom:4}}>TOTAL CHARM</div>
                              <div style={{fontSize:18,fontWeight:700,color:"#00AAFF"}}>
                                {data.totalCharm?.toFixed(1)}M
                              </div>
                              <div style={{fontSize:8,color:"#444",marginTop:4}}>
                                Delta decay pressure toward close
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Per-strike vanna/charm */}
                        <div style={{border:"1px solid #1a1a1a"}}>
                          <div style={{padding:"6px 10px",borderBottom:"1px solid #1a1a1a",
                            display:"grid",gridTemplateColumns:"60px 1fr 80px 80px",
                            fontSize:7,color:"#333",letterSpacing:1}}>
                            <span>STRIKE</span><span>NET GEX</span><span style={{textAlign:"right"}}>VANNA</span><span style={{textAlign:"right"}}>CHARM</span>
                          </div>
                          {data.strikes.slice(0,20).map(s=>{
                            const isCur=Math.abs(s.strike-spot)<0.5;
                            return (
                              <div key={s.strike} style={{display:"grid",
                                gridTemplateColumns:"60px 1fr 80px 80px",
                                padding:"5px 10px",alignItems:"center",
                                borderBottom:"1px solid #0a0a0a",
                                borderLeft:isCur?"2px solid #FF9500":"2px solid transparent",
                                background:isCur?"rgba(255,149,0,0.04)":"transparent",
                                fontSize:9}}>
                                <span style={{color:isCur?"#FF9500":"#555",fontWeight:isCur?700:400}}>${s.strike}</span>
                                <div style={{height:4,background:"#111",overflow:"hidden"}}>
                                  <div style={{
                                    width:`${Math.min(100,Math.abs(s.netGex)/Math.max(...data.strikes.map(x=>Math.abs(x.netGex)),1)*100)}%`,
                                    height:"100%",background:s.netGex>0?"#00CC44":"#FF3333"}}/>
                                </div>
                                <span style={{textAlign:"right",color:s.netVanna>0?"#00CC44":"#FF3333",fontWeight:600}}>
                                  {s.netVanna>0?"+":""}{s.netVanna?.toFixed(2)}
                                </span>
                                <span style={{textAlign:"right",color:"#00AAFF"}}>
                                  {s.netCharm?.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── HEATMAP ── */}
                    {tab==="heatmap"&&(
                      <div>
                        <div style={{fontSize:8,color:"#555",letterSpacing:2,marginBottom:12}}>
                          GEX HEATMAP — STRIKE × EXPIRY · COLOR INTENSITY = MAGNITUDE
                        </div>
                        <GexHeatmap
                          strikes={data.heatmapStrikes||[]}
                          rows={data.heatmapData||[]}
                          spot={spot}
                        />
                      </div>
                    )}

                    {/* ── STRIKES ── */}
                    {tab==="strikes"&&(
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"56px 1fr 72px",
                          padding:"4px 8px",borderBottom:"1px solid #1a1a1a",
                          fontSize:7,color:"#333",letterSpacing:1}}>
                          <span>STRIKE</span><span>NET GEX</span><span style={{textAlign:"right"}}>VALUE</span>
                        </div>
                        {data.strikes.map(row=>{
                          const isCur=Math.abs(row.strike-spot)<0.5;
                          const isHot=hot.has(row.strike);
                          const isNear=Math.abs(row.strike-spot)/spot<0.008;
                          const pos=row.netGex>=0;
                          const maxG=Math.max(...data.strikes.map(s=>Math.abs(s.netGex)),1);
                          const pct=Math.min(1,Math.abs(row.netGex)/maxG);
                          const gc=pos?"#00CC44":"#FF3333";
                          return (
                            <div key={row.strike} style={{display:"grid",gridTemplateColumns:"56px 1fr 72px",
                              padding:"3px 8px",alignItems:"center",
                              borderBottom:"1px solid rgba(255,255,255,0.02)",
                              borderLeft:isHot?"2px solid #FF9500":isCur?"2px solid #FF9500":isNear?`2px solid ${gc}66`:"2px solid transparent",
                              background:isHot?"rgba(255,149,0,0.08)":isCur?"rgba(255,149,0,0.04)":pos?`rgba(0,204,68,${0.03+pct*0.12})`:`rgba(255,51,51,${0.03+pct*0.12})`}}>
                              <span style={{fontSize:9,fontWeight:isCur?700:400,
                                color:isHot?"#FF9500":isCur?"#FF9500":isNear?gc:"#444"}}>
                                {row.strike}{isHot?" 🔥":""}
                              </span>
                              <div style={{height:4,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
                                <div style={{width:`${Math.round(pct*100)}%`,height:"100%",background:gc}}/>
                              </div>
                              <span style={{fontSize:9,textAlign:"right",fontWeight:600,color:gc}}>{fmtM(row.netGex)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
