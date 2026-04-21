export default function ChartSkeleton() {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#000000", overflow:"hidden" }}>
      {/* Top bar skeleton */}
      <div style={{ padding:"7px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)",
        background:"#0a0a16", display:"flex", gap:8, alignItems:"center" }}>
        <div style={skel(82, 32)} />
        <div style={skel(50, 32)} />
        <div style={skel(120, 20)} />
        <div style={{ display:"flex", gap:4, marginLeft:8 }}>
          {[1,2,3,4,5].map(i=><div key={i} style={skel(38, 26)}/>)}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <div style={skel(80, 20)} />
          <div style={skel(32, 26)} />
        </div>
      </div>
      {/* Indicator bar */}
      <div style={{ padding:"5px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)",
        display:"flex", gap:6 }}>
        {[80,60,65,90,60,70,60,40].map((w,i)=><div key={i} style={skel(w, 22)}/>)}
      </div>
      {/* Chart area */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        {/* Fake candles */}
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"flex-end",
          padding:"20px 40px 60px", gap:3 }}>
          {Array.from({length:60}).map((_,i)=>{
            const h = 40 + Math.sin(i*0.3)*30 + Math.random()*20;
            return <div key={i} style={{ flex:1, height:`${h}%`, background:"#131313", borderRadius:2, animation:"pulse 2s infinite", animationDelay:`${i*0.05}s` }}/>
          })}
        </div>
        {/* Price axis */}
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:60,
          borderLeft:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column",
          justifyContent:"space-around", padding:"20px 8px" }}>
          {[1,2,3,4,5,6].map(i=><div key={i} style={skel(44, 12)}/>)}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  );
}

function skel(w: number|string, h: number) {
  return {
    width: typeof w==="number"?w:w, height: h,
    background: "#181818", borderRadius: 4,
    animation: "pulse 2s infinite",
    flexShrink: 0 as const,
  };
}
