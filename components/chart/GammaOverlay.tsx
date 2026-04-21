"use client";
import DraggablePanel from "@/components/chart/DraggablePanel";

interface GammaData {
  regime: string; isCalm: boolean; isWild: boolean;
  isSqueeze: boolean; isPinning: boolean;
  confidence: number; predictDir: number;
  tradeType: string; signalType?: string; rangePos: number;
}
interface Props { data: GammaData | null; visible: boolean; }

export default function GammaOverlay({ data, visible }: Props) {
  const modeStr = !data ? "" : data.isSqueeze ? "SQUEEZE" : data.isPinning ? "PINNED" : data.isCalm ? "CALM" : "WILD";
  const modeCol = !data ? "#78909c" : data.isSqueeze ? "#ffca28" : data.isPinning ? "#ffa726" : data.isCalm ? "#26a69a" : "#ef5350";
  const dirCol  = !data ? "#78909c" : data.predictDir > 0 ? "#26a69a" : data.predictDir < 0 ? "#ef5350" : "#78909c";
  const confCol = !data ? "#78909c" : data.confidence > 70 ? "#26a69a" : data.confidence > 50 ? "#ffa726" : "#78909c";
  const confFill = !data ? "●○○○○" : data.confidence > 80 ? "●●●●●" : data.confidence > 60 ? "●●●●○" : data.confidence > 40 ? "●●●○○" : data.confidence > 20 ? "●●○○○" : "●○○○○";
  const rangePct = data ? Math.round(data.rangePos * 100) : 0;

  return (
    <DraggablePanel title="Γ GAMMA FLOW" color="#26a69a" defaultX={220} defaultY={50} visible={visible && !!data} storageKey="gammaflow">
      <div style={{ fontFamily:"'JetBrains Mono',monospace" }}>
        <div style={{ padding:"8px 8px 4px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:16, fontWeight:700, color:dirCol }}>
              {data?.tradeType==="WAIT" ? "⏳" : data?.predictDir??0 > 0 ? "▲" : "▼"} {data?.tradeType||"—"}
            </span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:modeCol, fontWeight:600 }}>{modeStr}</span>
            <span style={{ fontSize:10, color:confCol }}>{confFill} {data?.confidence||0}%</span>
          </div>
        </div>

        {data?.signalType && (
          <div style={{ padding:"3px 8px", background:"rgba(124,58,237,0.1)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize:9, color:"#a78bfa" }}>
              {data.signalType==="TRAP" ? "⚡ Trap" : data.signalType==="ALGO" ? "🤖 Algo" : data.signalType==="SQUEEZE" ? "💥 Squeeze" : ""}
            </span>
          </div>
        )}

        <div style={{ padding:"5px 8px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
            <span style={{ fontSize:9, color:"#556677" }}>Range Position</span>
            <span style={{ fontSize:9, color:"#8899aa" }}>{rangePct}%</span>
          </div>
          <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", left:`${Math.min(rangePct, 95)}%`, width:4, height:"100%", background:modeCol, borderRadius:2 }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <span style={{ fontSize:8, color:"#334155" }}>LOW</span>
            <span style={{ fontSize:8, color:"#334155" }}>HIGH</span>
          </div>
        </div>

        {[["Regime", data?.regime||"—", modeCol], ["Bias", data?.isCalm ? "Mean Rev" : "Momentum", "#8899aa"], ["Conf", `${data?.confidence||0}%`, confCol]].map(([l,v,c])=>(
          <div key={l as string} style={{ display:"flex", justifyContent:"space-between", padding:"3px 8px", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize:10, color:"#556677" }}>{l as string}</span>
            <span style={{ fontSize:10, color:c as string }}>{v as string}</span>
          </div>
        ))}
      </div>
    </DraggablePanel>
  );
}
