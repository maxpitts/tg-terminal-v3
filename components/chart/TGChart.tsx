"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { calcVWAP, calcEMA } from "@/lib/indicators/vwap";
import { calcGammaFlow } from "@/lib/indicators/gammaflow";
import { calcIFPQv4 } from "@/lib/indicators/ifpq_v4";
import { calcReversal } from "@/lib/indicators/reversal";
import { usePriceStore } from "@/store/prices";
import { useFlowStore } from "@/store/flow";
import type { DrawingTool } from "@/components/chart/ChartDrawing";
import { ChartDrawingOverlay } from "@/components/chart/ChartDrawing";
import IFPQOverlay from "@/components/chart/IFPQOverlay";
import GammaOverlay from "@/components/chart/GammaOverlay";
import { useLiveTicker } from "@/hooks/useLiveTicker";

type TF = "1m"|"5m"|"15m"|"1h"|"4h";
const TF_MULT: Record<TF,number> = {"1m":1,"5m":5,"15m":15,"1h":1,"4h":4};
const TF_SPAN: Record<TF,string> = {"1m":"minute","5m":"minute","15m":"minute","1h":"hour","4h":"hour"};
const TF_DAYS: Record<TF,number> = {"1m":5,"5m":365,"15m":730,"1h":1825,"4h":3650};
const VWAP_TFS: TF[] = ["1m","5m","15m","1h","4h"];

interface Inds {
  vwap:boolean;ema9:boolean;ema21:boolean;ema50:boolean;
  gamma:boolean;ifpq:boolean;reversal:boolean;
  dpOverlay:boolean;flowOverlay:boolean;hotMarkers:boolean;volume:boolean;
  vwapBands:boolean;volProfile:boolean;
}
const DEF: Inds = {vwap:false,ema9:false,ema21:false,ema50:false,gamma:false,ifpq:false,reversal:false,dpOverlay:false,flowOverlay:false,hotMarkers:false,volume:true,vwapBands:false,volProfile:false};
const LABELS: Record<keyof Inds,string> = {vwap:"VWAP",ema9:"EMA 9",ema21:"EMA 21",ema50:"EMA 50",gamma:"GammaFlow",ifpq:"IFP-Q",reversal:"Reversal",dpOverlay:"Dark Pool",flowOverlay:"Flow",hotMarkers:"HOT",volume:"Volume",vwapBands:"VWAP σ",volProfile:"Vol Profile"};
const COLORS: Record<keyof Inds,string> = {vwap:"#06b6d4",ema9:"#f59e0b",ema21:"#FF9500",ema50:"#ec4899",gamma:"#26a69a",ifpq:"#00AAFF",reversal:"#FFD700",dpOverlay:"#FF9500",flowOverlay:"#f59e0b",hotMarkers:"#9b30d9",volume:"#374151",vwapBands:"#2196F3",volProfile:"#555555"};

interface Props { ticker:string; onTickerChange:(t:string)=>void; compact?:boolean; }
interface VPBin { price:number; pct:number; upPct:number; isPOC:boolean; isVA:boolean; }
interface VPData { bins:VPBin[]; pocPrice:number; vahPrice:number; valPrice:number; }

function VolumeProfileOverlay({ width, height, data, priceSeries }:
  { width:number; height:number; data:VPData; priceSeries:any; renderKey?:number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const dataRef   = useRef(data);
  const priceRef  = useRef(priceSeries);
  const VP_WIDTH  = 80;
  useEffect(() => { dataRef.current  = data;        }, [data]);
  useEffect(() => { priceRef.current = priceSeries; }, [priceSeries]);
  useEffect(() => {
    let running = true;
    const draw = () => {
      const canvas = canvasRef.current; const ps = priceRef.current; const d = dataRef.current;
      if (!canvas || !ps || !d?.bins?.length) { if (running) rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, VP_WIDTH, height);
      const sorted = [...d.bins].sort((a,b) => a.price - b.price);
      for (let i = 0; i < sorted.length; i++) {
        const bin = sorted[i]; const y = ps.priceToCoordinate(bin.price);
        if (typeof y !== "number" || y < -50 || y > height + 50) continue;
        const barW = Math.max(3, Math.round(bin.pct * (VP_WIDTH - 6)));
        const yA = i > 0 ? ps.priceToCoordinate(sorted[i-1].price) : y-12;
        const yB = i < sorted.length-1 ? ps.priceToCoordinate(sorted[i+1].price) : y+12;
        const gapA = typeof yA === "number" ? Math.abs(y-yA) : 12;
        const gapB = typeof yB === "number" ? Math.abs(yB-y) : 12;
        const barH = Math.max(2, Math.min(gapA,gapB) * 0.82);
        ctx.fillStyle = bin.isPOC ? "rgba(240,196,64,0.9)" : bin.isVA ? (bin.upPct>=0.5?"rgba(99,102,241,0.65)":"rgba(139,92,246,0.65)") : (bin.upPct>=0.5?"rgba(34,197,94,0.45)":"rgba(239,68,68,0.45)");
        ctx.fillRect(VP_WIDTH-barW, y-barH/2, barW, barH);
      }
      if (running) rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [height]);
  return <canvas ref={canvasRef} width={VP_WIDTH} height={height} style={{position:"absolute",top:0,right:72,width:VP_WIDTH,pointerEvents:"none",zIndex:4}} />;
}

export default function TGChart({ ticker, onTickerChange, compact=false }:Props) {
  const chartRef      = useRef<HTMLDivElement>(null);
  const chartReady    = useRef(false);
  const chartInst     = useRef<any>(null);
  const candleS       = useRef<any>(null);
  const lastCandleRef = useRef<any>(null);
  const volumeS       = useRef<any>(null);
  const extraS        = useRef<any[]>([]);
  const ohlcvRef      = useRef<any[]>([]);
  const roRef         = useRef<ResizeObserver|null>(null);
  const pendingRender = useRef<{candles:any[],tf:TF}|null>(null);
  const animFrameRef  = useRef<number|null>(null);
  const curHighRef    = useRef<number>(0);
  const curLowRef     = useRef<number>(Infinity);
  const prevCloseRef  = useRef<number>(0);

  const [tf, setTF]     = useState<TF>("1h");
  const [inds, setInds] = useState<Inds>(() => {
    try { const s = typeof window!=="undefined" ? localStorage.getItem("tg-indicators") : null; if(s) return {...DEF,...JSON.parse(s)}; } catch {}
    return DEF;
  });
  const [loading, setLoading]   = useState(false);
  const [candles, setCandles]   = useState<any[]>([]);
  const [tickerIn, setIn]       = useState(ticker);
  const [drawTool, setDraw]     = useState<DrawingTool>("none");
  const [drawColor, setColor]   = useState<string>("#00e5ff");
  const [cSize, setCSize]       = useState({w:0,h:0});
  const [error, setError]       = useState("");
  const [count, setCount]       = useState(0);
  const [ifpqD, setIfpqD]       = useState<any>(null);
  const [gammaD, setGammaD]     = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [indDropOpen, setIndDropOpen] = useState(false);
  const [streamLive, setStreamLive]   = useState(false);

  // Live price — written via DOM refs for zero-lag display
  const livePriceRef  = useRef<HTMLSpanElement>(null);
  const liveChangeRef = useRef<HTMLSpanElement>(null);
  const liveDotRef    = useRef<HTMLSpanElement>(null);
  // Also kept in state so React renders stay accurate
  const [displayPrice, setDisplayPrice] = useState(0);
  const [displayChange, setDisplayChange] = useState({amt:0,pct:0});

  const snapData = usePriceStore(st => st.prices[ticker]);
  useFlowStore();

  useEffect(() => { if (snapData?.prevClose) prevCloseRef.current = snapData.prevClose; }, [snapData]);

  // ── Smooth candle animation ───────────────────────────────────────────────
  const animateTo = useCallback((targetPrice: number) => {
    const candle = lastCandleRef.current;
    if (!candle || !candleS.current) return;
    const startPrice = (candleS.current as any).__liveClose ?? candle.c;
    curHighRef.current = Math.max(curHighRef.current || candle.h, targetPrice);
    curLowRef.current  = Math.min(curLowRef.current === Infinity ? candle.l : curLowRef.current, targetPrice);
    const startTime = performance.now();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const step = (now: number) => {
      const t = Math.min((now - startTime) / 60, 1);
      const cur = startPrice + (targetPrice - startPrice) * t;
      try {
        candleS.current!.update({
          time: candle.t as any, open: candle.o,
          high: curHighRef.current, low: curLowRef.current,
          close: parseFloat(cur.toFixed(4)),
        });
      } catch {}
      if (t < 1) { animFrameRef.current = requestAnimationFrame(step); }
      else { (candleS.current as any).__liveClose = targetPrice; animFrameRef.current = null; }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // ── onPrice from useLiveTicker — fires every 500ms ───────────────────────
  const handlePrice = useCallback((price: number, prevClose: number) => {
    if (prevClose > 0) prevCloseRef.current = prevClose;
    const pc  = prevCloseRef.current;
    const amt = pc > 0 ? price - pc : 0;
    const pct = pc > 0 ? (amt / pc) * 100 : 0;
    const col = pct >= 0 ? "#00CC44" : "#FF3333";

    // DOM write — instant, no React overhead
    if (livePriceRef.current)  livePriceRef.current.textContent  = `$${price.toFixed(2)}`;
    if (liveChangeRef.current) {
      liveChangeRef.current.textContent = `${amt>=0?"+":""}${amt.toFixed(2)} (${pct>=0?"+":""}${pct.toFixed(2)}%)`;
      liveChangeRef.current.style.color = col;
    }
    if (liveDotRef.current) liveDotRef.current.style.background = "#00CC44";

    // Animate candle body
    animateTo(price);

    // Update React state (batched, doesn't block the above)
    setDisplayPrice(price);
    setDisplayChange({ amt, pct });
    setStreamLive(true);
  }, [animateTo]);

  // Wire up 500ms polling — no WebSocket dependency
  const isIntraday = ["1m","5m","15m"].includes(tf);
  useLiveTicker(ticker, handlePrice, isIntraday);

  useEffect(() => {
    const load = async () => { try { const r = await fetch(`/api/earnings?ticker=${ticker}`); setEarnings(await r.json()); } catch { setEarnings(null); } };
    load();
  }, [ticker]);

  const fetchCandles = useCallback(async (tkr:string, timeframe:TF) => {
    setLoading(true); setError(""); setCandles([]); setCount(0);
    try {
      const toD = new Date(); const frD = new Date();
      frD.setDate(frD.getDate() - TF_DAYS[timeframe]);
      while (frD.getDay()===0||frD.getDay()===6) frD.setDate(frD.getDate()-1);
      const from = frD.toISOString().split("T")[0]; const to = toD.toISOString().split("T")[0];
      const res  = await fetch(`/api/polygon/candles?ticker=${tkr}&mult=${TF_MULT[timeframe]}&span=${TF_SPAN[timeframe]}&from=${from}&to=${to}`);
      const data = await res.json();
      if (data.candles?.length) { setCandles(data.candles); setCount(data.candles.length); pendingRender.current = { candles: data.candles, tf: timeframe }; }
      else { setError(`No data for ${tkr} · ${timeframe}`); }
    } catch { setError("Failed to load."); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCandles(ticker, tf); }, [ticker, tf]);

  // 60s candle refresh — appends newly closed bars
  useEffect(() => {
    if (!["1m","5m","15m"].includes(tf)) return;
    const refresh = async () => {
      try {
        const now = new Date(); const from = new Date(now.getTime() - 2*60*60*1000);
        const res = await fetch(`/api/polygon/candles?ticker=${ticker}&mult=${TF_MULT[tf as TF]}&span=${TF_SPAN[tf as TF]}&from=${from.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}`);
        const data = await res.json();
        if (!data.candles?.length) return;
        setCandles(prev => {
          if (!prev.length) return prev;
          const lastT = prev[prev.length-1].t;
          const newBars = data.candles.filter((c:any) => c.t > lastT);
          if (!newBars.length) return prev;
          const newest = newBars[newBars.length-1];
          lastCandleRef.current = newest;
          curHighRef.current = newest.h; curLowRef.current = newest.l;
          if (candleS.current) (candleS.current as any).__liveClose = undefined;
          return [...prev, ...newBars];
        });
      } catch {}
    };
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [ticker, tf]);

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  useEffect(() => {
    if (!["1m","5m","15m","1h","4h"].includes(tf)) return;
    const sec = TF_MULT[tf as TF] * 60;
    const tick = () => { const now=Math.floor(Date.now()/1000); const rem=sec-(now%sec); const m=Math.floor(rem/60); const s=rem%60; setCountdown(m>0?`${m}:${s.toString().padStart(2,"0")}`:`${s}s`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [tf]);

  const handleGo = useCallback(() => {
    const t = tickerIn.trim().toUpperCase();
    if (t && t !== ticker) window.location.href = `/chart/${t}`;
    else if (t === ticker) fetchCandles(ticker, tf);
  }, [tickerIn, ticker, tf, fetchCandles]);

  const toggleInd = useCallback((k: keyof Inds) => {
    setInds(prev => { const next = {...prev,[k]:!prev[k]}; try { localStorage.setItem("tg-indicators",JSON.stringify(next)); } catch {} return next; });
  }, []);

  const [volProfileData, setVolProfileData] = useState<any>(null);
  const [vpRenderKey, setVpRenderKey]       = useState(0);

  useEffect(() => {
    if (!chartRef.current) return;
    roRef.current = new ResizeObserver(entries => {
      const e = entries[0]; if (!e) return;
      const { width, height } = e.contentRect;
      setCSize({ w: Math.floor(width), h: Math.floor(height) });
      if (chartInst.current) chartInst.current.resize(Math.floor(width), Math.floor(height));
    });
    roRef.current.observe(chartRef.current);
    return () => roRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!chartRef.current || typeof window === "undefined") return;
    chartReady.current = false;
    import("lightweight-charts").then(({ createChart, ColorType, CrosshairMode }) => {
      if (!chartRef.current) return;
      if (chartInst.current) { chartInst.current.remove(); chartInst.current = null; }
      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth, height: chartRef.current.clientHeight,
        layout: { background: { type: ColorType.Solid, color: "#000000" }, textColor: "#666666", fontSize: 11, attributionLogo: false },
        grid: { vertLines: { color: "#1c1c1c", style: 1 }, horzLines: { color: "#1c1c1c", style: 1 } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#444444", labelBackgroundColor: "#111111" }, horzLine: { color: "#444444", labelBackgroundColor: "#111111" } },
        rightPriceScale: { borderColor: "#1a1a1a" },
        timeScale: { borderColor: "#1a1a1a", timeVisible: true, secondsVisible: false },
      });
      candleS.current = chart.addCandlestickSeries({ upColor:"#00CC44",downColor:"#FF3333",borderUpColor:"#00CC44",borderDownColor:"#FF3333",wickUpColor:"#00CC44",wickDownColor:"#FF3333",priceScaleId:"right",priceLineVisible:false });
      volumeS.current = chart.addHistogramSeries({ priceScaleId:"vol",color:"#374151",priceFormat:{type:"volume"} });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      chartInst.current = chart; chartReady.current = true;
      if (pendingRender.current) { const { candles: c, tf: t } = pendingRender.current; renderIndicators(chart, c, t); }
    });
    return () => { if (chartInst.current) { chartInst.current.remove(); chartInst.current = null; } };
  }, []); // eslint-disable-line

  const renderIndicators = useCallback((chart: any, c: any[], timeframe: TF) => {
    if (!chart || !candleS.current || !c.length) return;
    import("lightweight-charts").then(({ LineStyle }) => {
      extraS.current.forEach(s => { try { chart.removeSeries(s); } catch {} }); extraS.current = [];
      const ohlcv = c.map(b => ({ time: b.t as any, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.vol || 0 }));
      ohlcvRef.current = ohlcv;
      candleS.current.setData(ohlcv.map((b:any) => ({ time:b.time,open:b.open,high:b.high,low:b.low,close:b.close })));

      // ✅ Seed lastCandleRef — animateTo works from first tick
      lastCandleRef.current = c[c.length-1];
      curHighRef.current    = lastCandleRef.current.h;
      curLowRef.current     = lastCandleRef.current.l;
      (candleS.current as any).__liveClose = undefined;

      if (volumeS.current) { volumeS.current.setData(ohlcv.map((b:any) => ({ time:b.time,value:b.volume,color:b.close>=b.open?"rgba(0,204,68,0.35)":"rgba(255,51,51,0.35)" }))); }

      if (inds.vwap || inds.vwapBands) {
        const vd = calcVWAP(ohlcv);
        if (inds.vwap) { const s = chart.addLineSeries({color:"#06b6d4",lineWidth:2,lineStyle:LineStyle.Dashed,lastValueVisible:true,priceLineVisible:false,title:"VWAP",priceScaleId:"right"}); s.setData(vd); extraS.current.push(s); }
        if (inds.vwapBands) {
          const win=20;
          for (const [mult,col] of [[1,"rgba(33,150,243,0.5)"],[2,"rgba(255,152,0,0.5)"]] as [number,string][]) {
            const buD:any[]=[],blD:any[]=[];
            vd.forEach((v:any,i:number)=>{if(i<win)return;const sl=vd.slice(i-win,i).map((x:any)=>x.value);const mean=sl.reduce((a:number,b:number)=>a+b,0)/win;const sd=Math.sqrt(sl.reduce((a:number,b:number)=>a+(b-mean)**2,0)/win);buD.push({time:v.time,value:parseFloat((v.value+sd*mult).toFixed(4))});blD.push({time:v.time,value:parseFloat((v.value-sd*mult).toFixed(4))});});
            const bu=chart.addLineSeries({color:col,lineWidth:1 as any,lastValueVisible:false,priceLineVisible:false,priceScaleId:"right",title:`+${mult}σ`});
            const bl=chart.addLineSeries({color:col,lineWidth:1 as any,lastValueVisible:false,priceLineVisible:false,priceScaleId:"right",title:`-${mult}σ`});
            bu.setData(buD);bl.setData(blD);extraS.current.push(bu,bl);
          }
        }
      }
      for (const [k,period] of [["ema9",9],["ema21",21],["ema50",50]] as [keyof Inds,number][]) {
        if (!inds[k]) continue;
        const ed = calcEMA(ohlcv, period);
        const s = chart.addLineSeries({color:COLORS[k],lineWidth:1,lastValueVisible:true,priceLineVisible:false,priceScaleId:"right",title:`EMA${period}`});
        s.setData(ed.filter((d:any)=>d.value!=null&&!isNaN(d.value))); extraS.current.push(s);
      }
      if (inds.gamma) { setGammaD(calcGammaFlow(ohlcv)); } else { setGammaD(null); }
      if (inds.ifpq)  { setIfpqD(calcIFPQv4(ohlcv));    } else { setIfpqD(null); }
      if (inds.reversal) {
        const vd2=calcVWAP(ohlcv); const sigs=calcReversal(ohlcv,vd2);
        const markers=sigs.map((sig:any)=>({time:sig.time,position:sig.type?.includes("BULL")?"belowBar":"aboveBar",color:sig.type?.includes("BULL")?"#00CC44":"#FF3333",shape:sig.type?.includes("BULL")?"arrowUp":"arrowDown",text:sig.trigger||""}));
        try { candleS.current.setMarkers([...markers].sort((a:any,b:any)=>(a.time as number)-(b.time as number))); } catch {}
      } else { try { candleS.current.setMarkers([]); } catch {} }
      if (inds.volProfile && c.length > 0) {
        const NUM=25;const prices=c.map((b:any)=>b.c);const minP=Math.min(...prices),maxP=Math.max(...prices);const bsz=(maxP-minP)/NUM;
        const bins:any[]=Array.from({length:NUM},(_,i)=>({price:minP+(i+0.5)*bsz,vol:0,upVol:0}));
        for(const bar of c){const idx=Math.min(NUM-1,Math.floor((bar.c-minP)/bsz));if(idx>=0){bins[idx].vol+=bar.vol||0;bins[idx].upVol+=bar.c>=bar.o?bar.vol||0:0;}}
        const maxV=Math.max(...bins.map((b:any)=>b.vol),1);const sorted=[...bins].sort((a:any,b:any)=>b.vol-a.vol);const pocIdx=bins.indexOf(sorted[0]);
        const totV=bins.reduce((s:number,b:any)=>s+b.vol,0);let cum=0;const vaBins=new Set<number>();
        for(const b of sorted){cum+=b.vol;vaBins.add(bins.indexOf(b));if(cum/totV>=0.7)break;}
        setVolProfileData({bins:bins.map((b:any,i:number)=>({price:b.price,pct:b.vol/maxV,upPct:b.vol>0?b.upVol/b.vol:0.5,isPOC:i===pocIdx,isVA:vaBins.has(i)})),pocPrice:bins[pocIdx].price,vahPrice:Math.max(...[...vaBins].map(i=>bins[i].price)),valPrice:Math.min(...[...vaBins].map(i=>bins[i].price))});
        setVpRenderKey(k=>k+1);
      } else { setVolProfileData(null); }
      chart.timeScale().scrollToRealTime();
    });
  }, [inds]); // eslint-disable-line

  useEffect(() => { if (!chartInst.current || !candles.length) return; renderIndicators(chartInst.current, candles, tf); }, [candles, inds, tf, renderIndicators]);

  // Fallback display values when poll hasn't fired yet
  const lastC    = candles[candles.length-1];
  const dispPrice = displayPrice || snapData?.price || lastC?.c || 0;
  const dispAmt   = displayChange.amt || snapData?.change   || 0;
  const dispPct   = displayChange.pct || snapData?.changePct || 0;
  const col       = dispPct >= 0 ? "#00CC44" : "#FF3333";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#000000",fontFamily:"'JetBrains Mono',monospace"}}>
      {!compact && (
        <div style={{display:"flex",alignItems:"center",gap:8,padding:isMobile?"5px 8px":"7px 12px",borderBottom:"1px solid #1a1a1a",background:"#0a0a0a",flexShrink:0,flexWrap:"wrap" as const}}>
          <input value={tickerIn} onChange={e=>setIn(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&handleGo()} maxLength={6}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:6,padding:isMobile?"3px 8px":"4px 10px",fontSize:isMobile?13:16,fontWeight:700,color:"#fff",outline:"none",width:isMobile?68:82,fontFamily:"inherit"}}/>
          <button onClick={handleGo} style={{background:"#FF9500",color:"#fff",border:"none",padding:"4px 14px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>GO</button>
          {dispPrice > 0 && (
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginLeft:4}}>
              <span ref={livePriceRef} style={{color:"#fff",fontWeight:700,fontSize:isMobile?14:17}}>${dispPrice.toFixed(2)}</span>
              <span ref={liveChangeRef} style={{color:col,fontSize:isMobile?10:12}}>{dispAmt>=0?"+":""}{dispAmt.toFixed(2)} ({dispPct>=0?"+":""}{dispPct.toFixed(2)}%)</span>
            </div>
          )}
          {earnings?.nextEarnings && !isMobile && (
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:5,fontSize:9,color:"#FF9500",whiteSpace:"nowrap" as const}}>
              📅 EPS {earnings.nextEarnings}
              {earnings.expectedMovePct && <span style={{color:"#FFD700",marginLeft:4}}>±{earnings.expectedMovePct.toFixed(1)}%</span>}
            </div>
          )}
          <div style={{display:"flex",gap:3,marginLeft:8}}>
            {(["1m","5m","15m","1h","4h"] as TF[]).map(t=>(
              <button key={t} onClick={()=>setTF(t)} style={{padding:isMobile?"3px 6px":"3px 9px",fontSize:isMobile?10:11,borderRadius:4,border:"1px solid",cursor:"pointer",fontFamily:"inherit",borderColor:tf===t?"#FF9500":"#222",background:tf===t?"rgba(255,149,0,0.12)":"transparent",color:tf===t?"#FF9500":"#666666"}}>{t}</button>
            ))}
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            {count>0 && <span style={{fontSize:10,color:"#333333"}}>{count.toLocaleString()} candles</span>}
            {["1m","5m","15m"].includes(tf) && (
              <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:streamLive?"#00CC44":"#444444"}}>
                <span ref={liveDotRef} style={{width:6,height:6,borderRadius:"50%",background:streamLive?"#00CC44":"#333333",display:"inline-block",boxShadow:streamLive?"0 0 6px #00CC44":undefined}}/>
                {streamLive?"LIVE":"WAITING"}
              </div>
            )}
            {countdown && <span style={{fontSize:11,fontWeight:700,color:"#555555",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"2px 8px",fontVariantNumeric:"tabular-nums",minWidth:38,textAlign:"center"}}>{countdown}</span>}
            <button onClick={()=>fetchCandles(ticker,tf)} disabled={loading} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"#666666",padding:"3px 10px",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{loading?"Loading...":"↺"}</button>
          </div>
        </div>
      )}
      {compact && (
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",background:"#0a0a0a",borderBottom:"1px solid #1a1a1a",flexShrink:0}}>
          <input value={tickerIn} onChange={e=>setIn(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&handleGo()} maxLength={6}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"2px 6px",fontSize:12,fontWeight:700,color:"#fff",outline:"none",width:60,fontFamily:"inherit"}}/>
          <button onClick={handleGo} style={{background:"#FF9500",color:"#fff",border:"none",padding:"2px 8px",borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>GO</button>
          {dispPrice>0 && <span style={{color:"#fff",fontWeight:700,fontSize:12}}>${dispPrice.toFixed(2)}</span>}
          {dispPrice>0 && <span style={{color:col,fontSize:10}}>{dispPct>=0?"+":""}{dispPct.toFixed(2)}%</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:2}}>
            {(["1m","5m","15m","1h","4h"] as TF[]).map(t=>(
              <button key={t} onClick={()=>setTF(t)} style={{padding:"1px 5px",fontSize:9,borderRadius:3,border:"1px solid",cursor:"pointer",fontFamily:"inherit",borderColor:tf===t?"#FF9500":"#1e1e1e",background:tf===t?"rgba(255,149,0,0.12)":"transparent",color:tf===t?"#FF9500":"#555555"}}>{t}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:3,padding:"5px 12px",borderBottom:"1px solid #161616",background:"rgba(7,7,15,0.95)",flexShrink:0,flexWrap:"wrap"}}>
        <div style={{position:"relative"}}>
          <button onClick={()=>setIndDropOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px",fontSize:10,borderRadius:5,border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",fontFamily:"inherit",background:"rgba(255,255,255,0.04)",color:"#888888",whiteSpace:"nowrap" as const}}>
            <span style={{color:"#FF9500",fontWeight:700,fontSize:11}}>{Object.values(inds).filter(Boolean).length}</span>&nbsp;Indicators {indDropOpen?"▲":"▼"}
          </button>
          {indDropOpen && (
            <>
              <div onClick={()=>setIndDropOpen(false)} style={{position:"fixed",inset:0,zIndex:49}}/>
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,background:"#0f0f1e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:8,minWidth:240,boxShadow:"0 8px 32px rgba(0,0,0,0.7)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:1}}>
                {[{label:"OVERLAYS",keys:["vwap","vwapBands","ema9","ema21","ema50"] as (keyof Inds)[]},{label:"STRATEGIES",keys:["gamma","ifpq","reversal"] as (keyof Inds)[]},{label:"FLOW & VOLUME",keys:["volume","volProfile","dpOverlay","flowOverlay","hotMarkers"] as (keyof Inds)[]}].map(group=>(
                  <>
                    <div key={group.label} style={{gridColumn:"1/-1",fontSize:8,color:"#555555",letterSpacing:1.5,padding:"6px 6px 2px",marginTop:4,borderTop:group.label==="OVERLAYS"?"none":"1px solid rgba(255,255,255,0.06)"}}>{group.label}</div>
                    {group.keys.map(k=>{
                      const dis=["vwap","vwapBands"].includes(k)&&!VWAP_TFS.includes(tf);
                      return (
                        <div key={k} onClick={()=>!dis&&toggleInd(k)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",borderRadius:5,cursor:dis?"not-allowed":"pointer",opacity:dis?0.35:1,background:inds[k]?"rgba(124,58,237,0.1)":"transparent"}}>
                          <div style={{width:13,height:13,borderRadius:3,flexShrink:0,border:`1.5px solid ${inds[k]?COLORS[k]:"rgba(255,255,255,0.18)"}`,background:inds[k]?COLORS[k]:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {inds[k]&&<span style={{fontSize:8,color:"#000",fontWeight:900,lineHeight:1}}>✓</span>}
                          </div>
                          <span style={{fontSize:11,color:inds[k]?COLORS[k]:"#666666"}}>{LABELS[k]}</span>
                        </div>
                      );
                    })}
                  </>
                ))}
                <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"space-between",padding:"6px 6px 0",marginTop:4,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  <button onClick={()=>{(Object.keys(inds) as (keyof Inds)[]).forEach(k=>{if(inds[k])toggleInd(k);});}} style={{fontSize:9,color:"#555555",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Clear all</button>
                  <button onClick={()=>setIndDropOpen(false)} style={{fontSize:9,color:"#FF9500",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Done ✓</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div style={{width:1,height:14,background:"#1e1e1e",margin:"0 6px"}}/>
        <span style={{fontSize:9,color:"#333333",letterSpacing:1.5,marginRight:4}}>DRAW</span>
        <input type="color" value={drawColor} onChange={e=>setColor(e.target.value)} title="Drawing color"
          style={{width:22,height:22,padding:0,border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,cursor:"pointer",background:"none",flexShrink:0}}/>
        {([["none","✋"],["trendline","↗"],["hline","—"],["rect","□"],["fib","Φ"],["brush","✏"],["text","T"],["eraser","✕"]] as [DrawingTool,string][]).map(([t,icon])=>(
          <button key={t} onClick={()=>setDraw(d=>d===t?"none":t)}
            style={{padding:"2px 8px",fontSize:11,borderRadius:4,border:"1px solid",cursor:"pointer",fontFamily:"inherit",borderColor:drawTool===t?"#06b6d4":"#1a1a1a",background:drawTool===t?"rgba(6,182,212,0.15)":"transparent",color:drawTool===t?"#06b6d4":"#555555"}}>
            {icon}
          </button>
        ))}
      </div>
      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        {loading && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#555555",fontSize:13,zIndex:3,background:"#000000"}}>Loading {ticker} · {tf}...</div>}
        {error && !loading && (
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#555555",fontSize:13,zIndex:3,gap:8}}>
            <span>{error}</span>
            <button onClick={()=>fetchCandles(ticker,tf)} style={{background:"#7c3aed22",border:"1px solid #7c3aed",color:"#FF9500",padding:"6px 16px",borderRadius:6,fontSize:12,cursor:"pointer"}}>Retry</button>
          </div>
        )}
        <div ref={chartRef} style={{position:"absolute",inset:0}}/>
        <GammaOverlay data={gammaD} visible={inds.gamma&&!!gammaD}/>
        <IFPQOverlay  data={ifpqD}  visible={inds.ifpq&&!!ifpqD}/>
        {inds.volProfile && volProfileData && cSize.w > 0 && (
          <VolumeProfileOverlay width={cSize.w} height={cSize.h} data={volProfileData} priceSeries={candleS.current} renderKey={vpRenderKey}/>
        )}
        {cSize.w > 0 && <ChartDrawingOverlay key={ticker} width={cSize.w} height={cSize.h} tool={drawTool} color={drawColor} chartApi={chartInst.current} priceSeries={candleS.current}/>}
      </div>
    </div>
  );
}
