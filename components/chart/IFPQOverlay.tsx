"use client";
import DraggablePanel from "@/components/chart/DraggablePanel";

interface IFPQData {
  probability:number; adjustedProbability:number; regime:string; sigGrade:string;
  momentum:number; trend:number; volume:number; meanRev:number;
  revBull:boolean; revBear:boolean; revScore:number; revGrade:string; revCountMax:number; revDetail:string; revActive:boolean;
  buildingLong:boolean; buildingShort:boolean; atEdgeLong:boolean; atEdgeShort:boolean; nearEdgeStr:string; sigThresh:number;
  probMomentum:number; probMomStr:string; probAccel:number;
  bullCHoCH:boolean; bearCHoCH:boolean; bullBOS:boolean; bearBOS:boolean; structStr:string;
  absorbBull:boolean; absorbBear:boolean; absorbBullStrict:boolean; absorbBearStrict:boolean;
  absorbClusterBull:boolean; absorbClusterBear:boolean; absorbContext:string;
  trapShorts:boolean; trapLongs:boolean; trapWithSweepBull:boolean; trapWithSweepBear:boolean;
  deltaDivBullStack:number; deltaDivBearStack:number;
  volSqueezeActive:boolean; volSqueezeRelease:boolean; squeezeDuration:number; isSqueeze:boolean;
  liqSweepBull:boolean; liqSweepBear:boolean;
  barsAtExtreme:number; volPremStr:string;
  v4Count:number; v4Grade:string;
  htfAligned:boolean; htfScore:number;
  actionText:string; orHigh:number|null; orLow:number|null;
  orbLong:boolean; orbShort:boolean;
}

interface Props { data:IFPQData|null; visible:boolean; }

export default function IFPQOverlay({data, visible}:Props) {
  if(!data) return null;

  const prob = data.adjustedProbability;
  const absProb = Math.abs(prob);
  const probCol = prob>=55?"#00E676":prob<=-55?"#FF5252":prob>20?"rgba(0,230,118,0.7)":prob<-20?"rgba(255,82,82,0.7)":"#787B86";
  const regCol = ["TRENDING","VOLATILE TREND"].includes(data.regime)?"#00E676":data.regime==="RANGING"?"#2196F3":data.regime==="VOLATILE"?"#FF5252":"#787B86";
  const momCol = data.probMomentum>10?"#00E676":data.probMomentum<-10?"#FF5252":"#787B86";

  const filledBars = Math.round(absProb/10);
  const gaugeStr = "█".repeat(filledBars)+"░".repeat(10-filledBars);

  const row = (label:string, val:string, col="#888888", right?:string, rightCol?:string) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"3px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{fontSize:10,color:"#555555"}}>{label}</span>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {right&&<span style={{fontSize:9,color:rightCol||"#333333"}}>{right}</span>}
        <span style={{fontSize:10,color:col,fontWeight:500}}>{val}</span>
      </div>
    </div>
  );

  const bar = (val:number) => {
    const pct=Math.min(100,Math.abs(val));
    const col=val>20?"#00E676":val<-20?"#FF5252":"#555555";
    return <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:80,height:5,background:"#181818",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/>
      </div>
      <span style={{fontSize:10,color:col,width:28,textAlign:"right"}}>{val>0?"+":""}{val}</span>
    </div>;
  };

  // Determine direction text matching TV
  const dir = prob>=55?"LONG":prob<=-55?"SHORT":"WAIT";
  const dirCol = prob>=55?"#00E676":prob<=-55?"#FF5252":"#787B86";

  // Rev status matching TV
  const revStatus = data.revActive
    ? (data.revBull?"BULL ":"BEAR ")+data.revGrade
    : data.revCountMax>0
    ? `${data.revCountMax}/4 ${data.revDetail}`
    : "0/4 — watching";
  const revCol = data.revActive?"#E040FB":data.revCountMax>0?"rgba(224,64,251,0.5)":"rgba(120,120,120,0.3)";

  // Edge status matching TV
  let edgeStatus=""; let edgeCol="#787B86";
  if(data.atEdgeLong){edgeStatus=`AT EDGE ▲ ${Math.round(prob)}% ✓`;edgeCol=data.htfAligned?"#00E676":"rgba(0,230,118,0.5)";}
  else if(data.atEdgeShort){edgeStatus=`AT EDGE ▼ ${Math.round(prob)}% ✓`;edgeCol=data.htfAligned?"#FF5252":"rgba(255,82,82,0.5)";}
  else if(data.buildingLong||data.buildingShort){edgeStatus=data.nearEdgeStr;edgeCol=prob>0?"rgba(0,230,118,0.5)":"rgba(255,82,82,0.5)";}
  else{edgeStatus=`${Math.round(prob)}% · need ±${Math.round(data.sigThresh)}`;}

  // Structure extra
  const structExtra=data.bullCHoCH?"CHoCH ▲":data.bearCHoCH?"CHoCH ▼":data.bullBOS?"BOS ▲":data.bearBOS?"BOS ▼":"";
  const structExtraCol=data.bullCHoCH||data.bullBOS?"#00E676":data.bearCHoCH||data.bearBOS?"#FF5252":"#787B86";

  // Flow string
  const absCluster=data.absorbClusterBull||data.absorbClusterBear;
  const trapSweep=data.trapWithSweepBull||data.trapWithSweepBear;
  const ofStr=absCluster?`ABS×${Math.max(0,0)} ${data.absorbContext}`:
    (data.absorbBullStrict||data.absorbBearStrict)?`ABS🎯 ${data.absorbContext}`:
    (data.absorbBull||data.absorbBear)?`ABS ${data.absorbContext}`:
    trapSweep?(data.trapShorts?"TRAP+SWP ▲":"TRAP+SWP ▼"):
    (data.trapShorts||data.trapLongs)?(data.trapShorts?"TRAP ▲":"TRAP ▼"):
    data.deltaDivBullStack>=2?`Δ DIV ×${data.deltaDivBullStack}`:
    data.deltaDivBearStack>=2?`Δ DIV ×${data.deltaDivBearStack}`:
    "—";
  const ofCol=absCluster?"#00BCD4":trapSweep?"#FFD700":(data.trapShorts||data.trapLongs)?"#FF6F00":
    data.deltaDivBullStack>=2||data.deltaDivBearStack>=2?"#E040FB":"#555555";

  // Squeeze
  const vsStr=data.volSqueezeActive&&data.isSqueeze?"DUAL 🔥🔥":data.volSqueezeActive?`KC/BB 🔥 ${data.squeezeDuration}b`:data.volSqueezeRelease?"RELEASE!":"NO COMP";
  const vsCol=data.volSqueezeActive&&data.isSqueeze?"#FFD700":data.volSqueezeActive?"#FF9800":data.volSqueezeRelease?"#00E676":"#555555";

  // HTF
  const htfStr=data.htfScore>0.5?"STRONG ▲":data.htfScore>0.2?"BULL":data.htfScore<-0.5?"STRONG ▼":data.htfScore<-0.2?"BEAR":"FLAT";
  const htfCol=data.htfScore>0.2?"#00E676":data.htfScore<-0.2?"#FF5252":"#787B86";

  return (
    <DraggablePanel title="IFP-Q v4" color="#4fc3f7" defaultX={20} defaultY={50} visible={visible} storageKey="ifpq">
      <div style={{fontFamily:"'JetBrains Mono',monospace",width:260}}>

        {/* Header — regime + session */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"3px 8px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.2)"}}>
          <span style={{fontSize:9,color:regCol,letterSpacing:0.5}}>{data.regime}</span>
          <span style={{fontSize:9,color:"#333333"}}>EQ</span>
          <span style={{fontSize:9,color:"#555555"}}>{data.actionText.includes("CLOSED")?"CLOSED":""}</span>
        </div>

        {/* Probability + grade — big like TV */}
        <div style={{padding:"8px 8px 6px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
            <span style={{fontSize:9,color:"#555555"}}>PROB</span>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:20,fontWeight:700,color:probCol,lineHeight:1}}>{absProb.toFixed(0)}%</span>
              <span style={{fontSize:12,color:"#333333"}}>{data.sigGrade}</span>
            </div>
          </div>
          {/* LONG gauge bar */}
          <div style={{marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:9,color:"#555555"}}>{prob>=0?"LONG":"SHORT"}</span>
              <span style={{fontSize:9,color:probCol}}>{gaugeStr}</span>
            </div>
          </div>
          {/* Direction signal */}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <span style={{fontSize:13,fontWeight:700,color:dirCol}}>{dir}</span>
          </div>
        </div>

        {/* Core rows matching TV dashboard */}
        {row("Conviction", data.probMomStr, momCol, `${data.probAccel>=0?"+":""}${Math.round(data.probAccel)}/5b`,
          data.probAccel>5?"#00E676":data.probAccel<-5?"#FF5252":"#555555")}
        {row("Regime", data.regime, regCol)}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"3px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{fontSize:10,color:revCol}}>🔄 Rev</span>
          <div style={{display:"flex",gap:6}}>
            {data.revActive&&<span style={{fontSize:9,color:revCol}}>{Math.round(data.revScore)}/100</span>}
            <span style={{fontSize:10,color:revCol}}>{revStatus}</span>
          </div>
        </div>
        <div style={{padding:"3px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:"#555555"}}>Edge</span>
            <span style={{fontSize:10,color:edgeCol}}>{edgeStatus}</span>
          </div>
        </div>

        {/* Components */}
        <div style={{padding:"4px 8px 2px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{fontSize:8,color:"#333333",letterSpacing:1}}>COMPONENTS</span>
        </div>
        {[["Momentum",data.momentum],["Volume",data.volume],["Trend",data.trend],["MeanRev",data.meanRev]].map(([l,v])=>(
          <div key={l as string} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"3px 8px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
            <span style={{fontSize:10,color:"#555555"}}>{l}</span>
            {bar(v as number)}
          </div>
        ))}

        {/* HTF */}
        {row("HTF", htfStr, htfCol, data.htfAligned?"ALIGNED":"AGAINST", data.htfAligned?"#00E676":"#FF5252")}

        {/* Structure */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"3px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{fontSize:10,color:"#555555"}}>Struct</span>
          <div style={{display:"flex",gap:6}}>
            <span style={{fontSize:9,color:structExtraCol}}>{structExtra}</span>
            <span style={{fontSize:10,color:data.structStr?.includes("▲")?"#00E676":data.structStr?.includes("▼")?"#FF5252":"#787B86"}}>{data.structStr}</span>
          </div>
        </div>

        {/* Order flow */}
        {row("Flow", ofStr, ofCol)}

        {/* Squeeze */}
        {row("Squeeze", vsStr, vsCol, data.volPremStr, "#787B86")}

        {/* Liq */}
        {row("Liq/Ext", data.liqSweepBull?"SWEEP ▲":data.liqSweepBear?"SWEEP ▼":"POOLS",
          data.liqSweepBull||data.liqSweepBear?"#FF6F00":"#333333",
          data.barsAtExtreme>0?`${data.barsAtExtreme}b ext`:undefined,
          data.barsAtExtreme>=6?"#FF5252":data.barsAtExtreme>0?"#FF9800":undefined)}

        {/* v4 */}
        {row("v4", `${data.v4Grade} ×${data.v4Count}`, data.v4Count>=3?"#00E676":data.v4Count>=1?"#FF9800":"#555555",
          data.orbLong?"ORB ▲":data.orbShort?"ORB ▼":data.orHigh!==null?"OR SET":"—",
          data.orbLong?"#00E676":data.orbShort?"#FF5252":"#00E5FF")}

        {/* Action label */}
        <div style={{padding:"6px 8px",borderTop:"1px solid rgba(255,255,255,0.06)",
          background:data.revActive?"rgba(224,64,251,0.1)":prob>=55?"rgba(0,230,118,0.08)":prob<=-55?"rgba(255,82,82,0.08)":"#0d0d0d"}}>
          <span style={{fontSize:10,fontWeight:600,color:data.revActive?"#E040FB":prob>=55?"#00E676":prob<=-55?"#FF5252":"#787B86"}}>
            {data.actionText}
          </span>
        </div>
      </div>
    </DraggablePanel>
  );
}
