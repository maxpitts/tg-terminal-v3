"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export type DrawingTool = "none"|"trendline"|"hline"|"rect"|"fib"|"text"|"eraser"|"brush";

interface ChartPoint { price: number; time?: number; }
interface Drawing { id:string; type:DrawingTool; pts:ChartPoint[]; color:string; label?:string; }
interface PixelPoint { x:number; y:number; }
interface Props { width:number; height:number; tool:DrawingTool; color:string; chartApi?:any; priceSeries?:any; }

const FIB_LEVELS = [0,0.236,0.382,0.5,0.618,0.786,1];
const FIB_COLORS = ["#f0c040","#39ff14","#00e5ff","#ff6644","#00e5ff","#39ff14","#f0c040"];
const HIT = 12;

function arrowHead(ctx:CanvasRenderingContext2D, x1:number, y1:number, x2:number, y2:number, col:string) {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||1;
  const ux=dx/len, uy=dy/len, sz=12;
  const ax=x2-ux*sz, ay=y2-uy*sz;
  const lx=-uy*sz*0.4, ly=ux*sz*0.4;
  ctx.strokeStyle=col; ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(ax+lx,ay+ly); ctx.lineTo(ax-lx,ay-ly);
  ctx.closePath(); ctx.fill();
}

function hitPx(px:PixelPoint[], px2:number, py2:number, type:DrawingTool): "p0"|"p1"|"body"|null {
  const [p0,p1]=px;
  if (!p0) return null;
  if (Math.hypot(p0.x-px2,p0.y-py2)<HIT) return "p0";
  if (p1 && Math.hypot(p1.x-px2,p1.y-py2)<HIT) return "p1";
  if (type==="hline" && Math.abs(p0.y-py2)<HIT) return "body";
  if (p1) {
    const dx=p1.x-p0.x, dy=p1.y-p0.y, len=Math.sqrt(dx*dx+dy*dy)||1;
    const dist=Math.abs(dy*px2-dx*py2+p1.x*p0.y-p1.y*p0.x)/len;
    const t=((px2-p0.x)*dx+(py2-p0.y)*dy)/(len*len);
    if (dist<HIT&&t>=0&&t<=1) return "body";
  }
  return null;
}

export function ChartDrawingOverlay({ width, height, tool, color, chartApi, priceSeries }:Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const drawingsRef = useRef<Drawing[]>([]);
  const activeDRef  = useRef<Drawing|null>(null);
  const drag        = useRef<{id:string;part:"p0"|"p1"|"body"}|null>(null);
  const rafRef      = useRef<number>(0);
  const chartApiRef = useRef<any>(null);
  const priceSerRef = useRef<any>(null);
  const toolRef     = useRef<DrawingTool>(tool);
  const colorRef    = useRef<string>(color);

  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [activeD,  setActiveD]  = useState<Drawing|null>(null);
  const [textInput, setTextInput] = useState<{x:number;y:number;price:number}|null>(null);
  const [textVal,   setTextVal]   = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => { toolRef.current  = tool;  }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  useEffect(() => { activeDRef.current = activeD; }, [activeD]);
  useEffect(() => { chartApiRef.current = chartApi; }, [chartApi]);
  useEffect(() => { priceSerRef.current = priceSeries; }, [priceSeries]);

  // Load drawings
  useEffect(() => {
    const load = async () => {
      try {
        const ticker = window.location.pathname.split("/chart/")[1]?.split("?")[0];
        if (!ticker) return;
        const r = await fetch(`/api/drawings?ticker=${ticker}`);
        const d = await r.json();
        if (d.drawings?.length) setDrawings(d.drawings);
      } catch {}
    };
    load();
  }, []);

  const saveDrawings = useCallback((ds: Drawing[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const ticker = window.location.pathname.split("/chart/")[1]?.split("?")[0];
        if (!ticker) return;
        await fetch("/api/drawings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ticker, drawings:ds}) });
      } catch {}
    }, 1000);
  }, []);

  const priceToY = (price:number) => { try { const c=priceSerRef.current?.priceToCoordinate(price); return typeof c==="number"?c:-9999; } catch { return -9999; } };
  const timeToX  = (time:number)  => { try { const c=chartApiRef.current?.timeScale().timeToCoordinate(time); return typeof c==="number"?c:-9999; } catch { return -9999; } };
  const yToPrice = (y:number)     => { try { const c=priceSerRef.current?.coordinateToPrice(y); return typeof c==="number"?parseFloat(c.toFixed(4)):0; } catch { return 0; } };
  const xToTime  = (x:number)     => { try { const t=chartApiRef.current?.timeScale().coordinateToTime(x); return typeof t==="number"?t:0; } catch { return 0; } };

  const projectDrawing = (d:Drawing): PixelPoint[] =>
    d.pts.map(p => ({ x: p.time ? timeToX(p.time) : 0, y: priceToY(p.price) }));

  // ── Canvas render loop ──────────────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0,0,width,height);

    const all = activeDRef.current
      ? [...drawingsRef.current, activeDRef.current]
      : drawingsRef.current;

    for (const d of all) {
      if (!d.pts.length) continue;
      ctx.strokeStyle=d.color; ctx.fillStyle=d.color;
      ctx.lineWidth=1.5; ctx.setLineDash([]); ctx.globalAlpha=1;

      const px = projectDrawing(d);
      const [p0,p1] = px;
      if (!p0 || p0.y < -100) continue;

      const handle = (p:PixelPoint) => {
        if (p.x < -100 || p.y < -100) return;
        ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2);
        ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle="#07070f"; ctx.fill();
        ctx.fillStyle=d.color; ctx.strokeStyle=d.color;
      };

      // ── Brush — freehand polyline ─────────────────────────────────────────
      if (d.type === "brush") {
        if (d.pts.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = d.color;
        ctx.lineWidth   = 2;
        ctx.lineJoin    = "round";
        ctx.lineCap     = "round";
        let started = false;
        for (const pt of d.pts) {
          const px2 = pt.time ? timeToX(pt.time) : 0;
          const py2 = priceToY(pt.price);
          if (px2 < -100 || py2 < -100) continue;
          if (!started) { ctx.moveTo(px2, py2); started = true; }
          else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
        continue;
      }

      switch(d.type) {
        case "trendline":
          if (!p1||p1.x<-100){ctx.beginPath();ctx.arc(p0.x,p0.y,5,0,Math.PI*2);ctx.fill();break;}
          arrowHead(ctx,p0.x,p0.y,p1.x,p1.y,d.color);
          handle(p0); handle(p1); break;

        case "hline": {
          ctx.setLineDash([6,3]);
          ctx.beginPath();ctx.moveTo(0,p0.y);ctx.lineTo(width,p0.y);ctx.stroke();
          ctx.setLineDash([]);
          handle({x:50,y:p0.y});
          const lbl=`$${d.pts[0].price.toFixed(2)}`;
          ctx.font="bold 11px monospace"; ctx.textAlign="right";
          const lw=ctx.measureText(lbl).width+8;
          ctx.globalAlpha=0.9; ctx.fillStyle=d.color;
          ctx.fillRect(width-lw-4,p0.y-10,lw,16);
          ctx.globalAlpha=1; ctx.fillStyle="#000";
          ctx.fillText(lbl,width-4,p0.y+2);
          ctx.fillStyle=d.color; ctx.strokeStyle=d.color;
          break;
        }

        case "rect":
          if (!p1||p1.x<-100) break;
          const rx=Math.min(p0.x,p1.x),ry=Math.min(p0.y,p1.y);
          const rw=Math.abs(p1.x-p0.x),rh=Math.abs(p1.y-p0.y);
          ctx.globalAlpha=0.12; ctx.fillRect(rx,ry,rw,rh);
          ctx.globalAlpha=1; ctx.strokeRect(rx,ry,rw,rh);
          handle(p0); handle(p1); break;

        case "fib":
          if (!p1||p1.x<-100||!d.pts[1]) break;
          FIB_LEVELS.forEach((lvl,i)=>{
            const ly=p0.y+(p1.y-p0.y)*lvl;
            const price=(d.pts[0].price-(d.pts[0].price-d.pts[1].price)*lvl).toFixed(2);
            ctx.strokeStyle=FIB_COLORS[i]; ctx.setLineDash([4,3]); ctx.globalAlpha=0.7;
            ctx.beginPath();ctx.moveTo(0,ly);ctx.lineTo(width,ly);ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha=1;
            ctx.font="10px monospace"; ctx.fillStyle=FIB_COLORS[i]; ctx.textAlign="left";
            ctx.fillText(`${(lvl*100).toFixed(1)}% $${price}`,4,ly-2);
          }); break;

        case "text":
          if (!d.label) break;
          ctx.font="bold 12px monospace"; ctx.textAlign="left";
          const m=ctx.measureText(d.label);
          ctx.globalAlpha=0.7; ctx.fillStyle="#000";
          ctx.fillRect(p0.x-2,p0.y-14,m.width+8,17);
          ctx.globalAlpha=1; ctx.fillStyle=d.color;
          ctx.fillText(d.label,p0.x+2,p0.y); break;
      }
      ctx.strokeStyle=d.color; ctx.fillStyle=d.color; ctx.setLineDash([]); ctx.globalAlpha=1;
    }
  }, [width, height]);

  // RAF loop — always running when visible
  useEffect(()=>{
    let running = true;
    const loop = () => { if(!running) return; renderLoop(); rafRef.current=requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return ()=>{ running=false; cancelAnimationFrame(rafRef.current); };
  }, [renderLoop]);

  // Drag to move existing drawings
  useEffect(()=>{
    const onMove=(e:MouseEvent)=>{
      if (!drag.current||!canvasRef.current) return;
      const r=canvasRef.current.getBoundingClientRect();
      const cx=e.clientX-r.left, cy=e.clientY-r.top;
      const price=yToPrice(cy), time=xToTime(cx);
      const {id,part}=drag.current;
      setDrawings(prev=>prev.map(d=>{
        if (d.id!==id||d.type==="brush") return d;
        const pts=[...d.pts.map(p=>({...p}))];
        if (part==="body") {
          if (d.type==="hline") pts.forEach(p=>{p.price=price;});
          else { const dy=cy-priceToY(pts[0].price); pts.forEach(p=>{ p.price=yToPrice(priceToY(p.price)+dy); if(p.time&&time) p.time=time; }); }
        } else {
          const i=part==="p0"?0:1;
          if (pts[i]) pts[i]={price, time: d.type!=="hline"?time:undefined};
        }
        return {...d,pts};
      }));
    };
    const onUp=()=>{ if(drag.current) saveDrawings(drawingsRef.current); drag.current=null; };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{ window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
  }, []);

  const getXY = (e:React.MouseEvent) => {
    const r=canvasRef.current!.getBoundingClientRect();
    return {x:e.clientX-r.left, y:e.clientY-r.top};
  };

  // ── Mouse handlers for drawing ───────────────────────────────────────────
  const onDrawDown = useCallback((e:React.MouseEvent)=>{
    const {x,y}=getXY(e);
    const price=yToPrice(y), time=xToTime(x);
    const t=toolRef.current, col=colorRef.current;
    if (t==="eraser") {
      setDrawings(prev=>{ const n=prev.filter(d=>!hitPx(projectDrawing(d),x,y,d.type)); saveDrawings(n); return n; });
      return;
    }
    if (t==="text")  { setTextInput({x,y,price}); return; }
    if (t==="hline") {
      setDrawings(prev=>{ const n=[...prev,{id:Date.now().toString(),type:"hline" as DrawingTool,pts:[{price}],color:col}]; saveDrawings(n); return n; });
      return;
    }
    setActiveD({id:Date.now().toString(), type:t, pts:[{price,time}], color:col});
  },[]);

  const onDrawMove = useCallback((e:React.MouseEvent)=>{
    if (!activeDRef.current) return;
    const {x,y}=getXY(e);
    const price=yToPrice(y), time=xToTime(x);
    if (activeDRef.current.type === "brush") {
      // Accumulate points for brush — don't overwrite
      setActiveD(prev => prev ? {...prev, pts:[...prev.pts, {price, time}]} : null);
    } else {
      // For all other tools: update second point
      setActiveD(prev => prev ? {...prev, pts:[prev.pts[0], {price, time}]} : null);
    }
  },[]);

  const onDrawUp = useCallback(()=>{
    const d = activeDRef.current;
    if (!d) return;
    const valid = d.type==="brush" ? d.pts.length>=3 : d.pts.length>=2;
    if (valid) setDrawings(prev=>{ const n=[...prev,{...d}]; saveDrawings(n); return n; });
    setActiveD(null);
  },[]);

  const onHandDown = useCallback((e:React.MouseEvent<HTMLDivElement>)=>{
    const r=canvasRef.current?.getBoundingClientRect(); if(!r) return;
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const ds=drawingsRef.current;
    for (let i=ds.length-1;i>=0;i--) {
      const part=hitPx(projectDrawing(ds[i]),x,y,ds[i].type);
      if (part){drag.current={id:ds[i].id,part};e.stopPropagation();return;}
    }
  },[]);

  const onHandMove = useCallback((e:React.MouseEvent<HTMLDivElement>)=>{
    const r=canvasRef.current?.getBoundingClientRect(); if(!r) return;
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const ds=drawingsRef.current;
    for (let i=ds.length-1;i>=0;i--) {
      const part=hitPx(projectDrawing(ds[i]),x,y,ds[i].type);
      if (part==="p0"||part==="p1"){e.currentTarget.style.cursor="crosshair";return;}
      if (part==="body"){e.currentTarget.style.cursor="move";return;}
    }
    e.currentTarget.style.cursor="default";
  },[]);

  const submitText=()=>{
    if (!textInput||!textVal.trim()){setTextInput(null);setTextVal("");return;}
    setDrawings(prev=>[...prev,{id:Date.now().toString(),type:"text",pts:[{price:textInput.price,time:xToTime(textInput.x)}],color:colorRef.current,label:textVal.trim()}]);
    setTextInput(null);setTextVal("");
  };

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height}
        style={{position:"absolute",top:0,left:0,zIndex:10,pointerEvents:"none"}}
      />
      {tool!=="none" && (
        <div onMouseDown={onDrawDown} onMouseMove={onDrawMove} onMouseUp={onDrawUp}
          style={{position:"absolute",top:0,left:0,width,height,zIndex:11,
            cursor:tool==="eraser"?"cell":tool==="brush"?"crosshair":"crosshair"}}
        />
      )}
      {tool==="none" && drawings.map(d=>{
        const px=projectDrawing(d);
        const [p0,p1]=px;
        if (!p0||p0.y<-100) return null;
        if (d.type==="hline") return (
          <div key={d.id} onMouseDown={onHandDown} onMouseMove={onHandMove}
            style={{position:"absolute",left:0,top:Math.max(0,p0.y-HIT),width,height:HIT*2,zIndex:11,cursor:"move"}}/>
        );
        if (p1&&p1.x>-100) {
          const left=Math.min(p0.x,p1.x)-HIT, top=Math.min(p0.y,p1.y)-HIT;
          return (
            <div key={d.id} onMouseDown={onHandDown} onMouseMove={onHandMove}
              style={{position:"absolute",left:Math.max(0,left),top:Math.max(0,top),
                width:Math.abs(p1.x-p0.x)+HIT*2,height:Math.max(HIT*2,Math.abs(p1.y-p0.y)+HIT*2),
                zIndex:11,cursor:"move"}}/>
          );
        }
        return null;
      })}
      {textInput && (
        <div style={{position:"absolute",left:textInput.x,top:textInput.y-36,zIndex:20,display:"flex",gap:4}}>
          <input autoFocus value={textVal} onChange={e=>setTextVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")submitText();if(e.key==="Escape"){setTextInput(null);setTextVal("");}}}
            placeholder="Label..."
            style={{background:"#0a0a10",border:"1px solid #00e5ff",color:"#fff",padding:"3px 8px",
              fontSize:11,fontFamily:"monospace",outline:"none",width:130,borderRadius:4}}/>
          <button onClick={submitText}
            style={{background:"#00e5ff22",border:"1px solid #00e5ff",color:"#00e5ff",
              padding:"3px 8px",fontSize:10,cursor:"pointer",borderRadius:4}}>OK</button>
        </div>
      )}
      {drawings.length>0 && (
        <button onClick={()=>{ setDrawings([]); saveDrawings([]); }}
          style={{position:"absolute",top:6,right:6,zIndex:20,background:"#ff224422",
            border:"1px solid #ff2244",color:"#ff2244",padding:"2px 10px",
            fontSize:9,cursor:"pointer",fontFamily:"monospace",borderRadius:4}}>
          CLEAR ALL
        </button>
      )}
    </>
  );
}
