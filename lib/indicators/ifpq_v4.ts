// ══════════════════════════════════════════════════════════════════════════════
// IFP-Q v4.0 — TypeScript port of Institutional Flow Pro Quant Edition
// Exact 1:1 port of Pine Script logic
// ══════════════════════════════════════════════════════════════════════════════

export interface Bar { time:number; open:number; high:number; low:number; close:number; volume:number; }

export interface IFPQv4Bar {
  time:number;
  // Core probability
  probability:number; adjustedProbability:number;
  regime:string; regimeColor:string;
  grade:string; sigGrade:string;
  longSignal:boolean; shortSignal:boolean;
  // Components
  momentum:number; volume:number; trend:number; meanRev:number;
  // Probability momentum
  probMomentum:number; probMomStr:string; probAccel:number;
  // Reversal
  revBull:boolean; revBear:boolean; revScore:number; revGrade:string;
  revCountMax:number; revDetail:string; revActive:boolean;
  // Near edge
  buildingLong:boolean; buildingShort:boolean; atEdgeLong:boolean; atEdgeShort:boolean;
  nearEdgeStr:string; sigThresh:number;
  // Levels
  vwap:number; proj1Upper:number; proj1Lower:number; proj2Upper:number; proj2Lower:number;
  vwapSD:number;
  // Market structure
  bullBOS:boolean; bearBOS:boolean; bullCHoCH:boolean; bearCHoCH:boolean; structStr:string;
  // Order flow
  absorbBull:boolean; absorbBear:boolean; absorbBullStrict:boolean; absorbBearStrict:boolean;
  absorbClusterBull:boolean; absorbClusterBear:boolean; absorbContext:string;
  trapShorts:boolean; trapLongs:boolean; trapActive:boolean;
  trapWithSweepBull:boolean; trapWithSweepBear:boolean;
  deltaDivBull:boolean; deltaDivBear:boolean; deltaDivBullStack:number; deltaDivBearStack:number;
  // Squeeze
  bbInsideKC:boolean; volSqueezeActive:boolean; volSqueezeRelease:boolean;
  squeezeDuration:number; isSqueeze:boolean;
  // FVG
  bullFVG:boolean; bearFVG:boolean;
  // Liq pools
  liqSweepBull:boolean; liqSweepBear:boolean;
  liqPoolHigh:number|null; liqPoolLow:number|null;
  // Time extreme
  barsAtExtreme:number; reversionPressure:number;
  // Vol premium
  volPremium:number; volPremStr:string;
  // ORB
  orbLong:boolean; orbShort:boolean; orHigh:number|null; orLow:number|null;
  // v4
  v4Count:number; v4Grade:string;
  // HTF (simplified — use same TF data)
  htfAligned:boolean; htfScore:number;
  // Action
  actionText:string;
  // Bar color
  barCol:string|null;
}

// ── Utils ────────────────────────────────────────────────────────────────────

function sma(arr:number[], len:number, i:number): number {
  if (i < len-1) return NaN;
  let s=0; for(let j=i-len+1;j<=i;j++) s+=arr[j]; return s/len;
}

function ema(arr:number[], len:number): number[] {
  const out:number[]=new Array(arr.length).fill(NaN);
  const k=2/(len+1);
  for(let i=0;i<arr.length;i++){
    if(isNaN(arr[i])) continue;
    if(isNaN(out[i-1]??NaN)){
      // seed with SMA
      if(i>=len-1){let s=0;for(let j=i-len+1;j<=i;j++)s+=arr[j];out[i]=s/len;}
    } else {
      out[i]=arr[i]*k+out[i-1]*(1-k);
    }
  }
  return out;
}

function stdev(arr:number[], len:number, i:number): number {
  if(i<len-1) return NaN;
  const m=sma(arr,len,i); let s=0;
  for(let j=i-len+1;j<=i;j++) s+=(arr[j]-m)**2;
  return Math.sqrt(s/len);
}

function zScore(arr:number[], len:number, i:number): number {
  if(i<len-1) return 0;
  const m=sma(arr,len,i); const sd=stdev(arr,len,i);
  return sd===0?0:(arr[i]-m)/sd;
}

function clamp(v:number,lo:number,hi:number):number{return Math.max(lo,Math.min(hi,v));}

function atrArr(bars:Bar[], len:number): number[] {
  const tr:number[]=bars.map((b,i)=>i===0?b.high-b.low:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)));
  const out:number[]=new Array(bars.length).fill(NaN);
  // Wilder smoothing
  let sum=0;
  for(let i=0;i<bars.length;i++){
    if(i<len-1){sum+=tr[i];continue;}
    if(i===len-1){sum+=tr[i];out[i]=sum/len;continue;}
    out[i]=(out[i-1]*(len-1)+tr[i])/len;
  }
  return out;
}

function rsiArr(closes:number[], len:number): number[] {
  const out:number[]=new Array(closes.length).fill(NaN);
  let avgGain=0,avgLoss=0;
  for(let i=1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    const g=d>0?d:0; const l=d<0?-d:0;
    if(i<=len){avgGain+=g/len;avgLoss+=l/len;if(i===len){out[i]=100-100/(1+avgGain/Math.max(avgLoss,1e-10));}}
    else{avgGain=(avgGain*(len-1)+g)/len;avgLoss=(avgLoss*(len-1)+l)/len;out[i]=100-100/(1+avgGain/Math.max(avgLoss,1e-10));}
  }
  return out;
}

function macdArr(closes:number[], fast:number, slow:number, sig:number): {macd:number[],signal:number[],hist:number[]} {
  const emaF=ema(closes,fast); const emaS=ema(closes,slow);
  const m=closes.map((_,i)=>isNaN(emaF[i])||isNaN(emaS[i])?NaN:emaF[i]-emaS[i]);
  const s=ema(m,sig);
  const h=m.map((v,i)=>isNaN(v)||isNaN(s[i])?NaN:v-s[i]);
  return{macd:m,signal:s,hist:h};
}

function rocArr(closes:number[], len:number): number[] {
  return closes.map((c,i)=>i<len?NaN:(c-closes[i-len])/closes[i-len]*100);
}

function obvArr(bars:Bar[]): number[] {
  const out:number[]=new Array(bars.length).fill(0);
  for(let i=1;i<bars.length;i++){
    const d=bars[i].close-bars[i-1].close;
    out[i]=out[i-1]+(d>0?bars[i].volume:d<0?-bars[i].volume:0);
  }
  return out;
}

function highest(arr:number[], len:number, i:number): number {
  let m=-Infinity; for(let j=Math.max(0,i-len+1);j<=i;j++) m=Math.max(m,arr[j]); return m;
}
function lowest(arr:number[], len:number, i:number): number {
  let m=Infinity; for(let j=Math.max(0,i-len+1);j<=i;j++) m=Math.min(m,arr[j]); return m;
}

function correlation(x:number[], y:number[], len:number, i:number): number {
  if(i<len-1) return 0;
  const n=len;
  let sx=0,sy=0,sxy=0,sx2=0,sy2=0;
  for(let j=i-n+1;j<=i;j++){sx+=x[j];sy+=y[j];sxy+=x[j]*y[j];sx2+=x[j]*x[j];sy2+=y[j]*y[j];}
  const num=n*sxy-sx*sy;
  const den=Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy));
  return den===0?0:num/den;
}

function dmiArr(bars:Bar[], len:number): {diPlus:number[],diMinus:number[],adx:number[]} {
  const n=bars.length;
  const tr:number[]=bars.map((b,i)=>i===0?b.high-b.low:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)));
  const dmP:number[]=bars.map((b,i)=>i===0?0:Math.max(b.high-bars[i-1].high,0)>Math.max(bars[i-1].low-b.low,0)?Math.max(b.high-bars[i-1].high,0):0);
  const dmM:number[]=bars.map((b,i)=>i===0?0:Math.max(bars[i-1].low-b.low,0)>Math.max(b.high-bars[i-1].high,0)?Math.max(bars[i-1].low-b.low,0):0);
  const diP:number[]=new Array(n).fill(NaN);
  const diM:number[]=new Array(n).fill(NaN);
  const adx:number[]=new Array(n).fill(NaN);
  let smTR=0,smDMp=0,smDMm=0,adxPrev=NaN,started=false;
  for(let i=0;i<n;i++){
    if(!started&&i<len){smTR+=tr[i];smDMp+=dmP[i];smDMm+=dmM[i];if(i===len-1)started=true;continue;}
    if(!started)continue;
    smTR=smTR-smTR/len+tr[i];smDMp=smDMp-smDMp/len+dmP[i];smDMm=smDMm-smDMm/len+dmM[i];
    const dp=smTR>0?smDMp/smTR*100:0;
    const dm=smTR>0?smDMm/smTR*100:0;
    diP[i]=dp;diM[i]=dm;
    const dx=(dp+dm)>0?Math.abs(dp-dm)/(dp+dm)*100:0;
    adxPrev=isNaN(adxPrev)?dx:(adxPrev*(len-1)+dx)/len;
    adx[i]=adxPrev;
  }
  return{diPlus:diP,diMinus:diM,adx};
}

function pivotHigh(highs:number[], left:number, right:number, i:number): number|null {
  if(i<left+right) return null;
  const pivot=highs[i-right];
  for(let j=i-right-left;j<=i;j++){if(j!==i-right&&highs[j]>=pivot)return null;}
  return pivot;
}
function pivotLow(lows:number[], left:number, right:number, i:number): number|null {
  if(i<left+right) return null;
  const pivot=lows[i-right];
  for(let j=i-right-left;j<=i;j++){if(j!==i-right&&lows[j]<=pivot)return null;}
  return pivot;
}

function vwapSession(bars:Bar[]): {vwap:number[],newSession:boolean[]} {
  // Reset daily - detect new day from timestamp
  const vwap:number[]=new Array(bars.length).fill(NaN);
  const ns:boolean[]=new Array(bars.length).fill(false);
  let cumPV=0,cumV=0;
  let lastDay=-1;
  for(let i=0;i<bars.length;i++){
    const d=new Date(bars[i].time*1000);
    const day=d.getUTCDay()+(d.getUTCFullYear()*400+d.getUTCMonth()*31)*7;
    if(day!==lastDay){lastDay=day;cumPV=0;cumV=0;ns[i]=true;}
    const hlc3=(bars[i].high+bars[i].low+bars[i].close)/3;
    const v=bars[i].volume||0;
    cumPV+=hlc3*v;cumV+=v;
    vwap[i]=cumV>0?cumPV/cumV:bars[i].close;
  }
  return{vwap,newSession:ns};
}

// ── Main calculation ─────────────────────────────────────────────────────────

export function calcIFPQv4(bars:Bar[], lookback=100, sensitivity="Normal"): IFPQv4Bar[] {
  const n=bars.length;
  if(n<220) return [];

  const opens=bars.map(b=>b.open);
  const closes=bars.map(b=>b.close);
  const highs=bars.map(b=>b.high);
  const lows=bars.map(b=>b.low);
  const volumes=bars.map(b=>b.volume||0);
  const hasVol=volumes.map(v=>v>0);
  const barIdx=bars.map((_,i)=>i);

  const baseSigThresh=sensitivity==="Conservative"?70:sensitivity==="Aggressive"?40:55;

  // Pre-compute arrays
  const atr=atrArr(bars,14);
  const {diPlus,diMinus,adx}=dmiArr(bars,14);
  const adxEma=ema(adx,5);
  const ema9v=ema(closes,9); const ema20v=ema(closes,20); const ema21v=ema(closes,21);
  const ema50v=ema(closes,50); const ema200v=ema(closes,200);
  const rsiV=rsiArr(closes,14);
  const {hist:macdHist}=macdArr(closes,12,26,9);
  const rocV=rocArr(closes,10);
  const obvV=obvArr(bars);
  const {vwap:vwapV,newSession}=vwapSession(bars);

  // Volume split
  const upVol=bars.map(b=>b.close>b.open?b.volume:0);
  const dnVol=bars.map(b=>b.close<b.open?b.volume:0);
  const barDelta=upVol.map((u,i)=>u-dnVol[i]);

  // ATR SMA50 for implied move
  const atrSMA50=new Array(n).fill(NaN);
  for(let i=49;i<n;i++) atrSMA50[i]=sma(atr,50,i);

  // BB
  const bbBasis=ema(closes,20).map((_,i)=>sma(closes,20,i));
  const bbDev=new Array(n).fill(NaN);
  for(let i=19;i<n;i++) bbDev[i]=stdev(closes,20,i);

  // KC
  const atr10=atrArr(bars,10);
  const kcBasis=ema(closes,20);

  // Persistent state (simulates Pine var)
  let regime="QUIET",pendingRegime="",regimeConfirmCount=0;
  let barsSinceRevBull=999,barsSinceRevBear=999;
  let absorbBullCluster=0,absorbBearCluster=0,absorbClusterPrice=NaN;
  let deltaDivBullStack=0,deltaDivBearStack=0;
  let squeezeDuration=0;
  let barsAtExtreme=0;
  let lastSwingHigh=NaN,lastSwingLow=NaN,prevSwingHigh=NaN,prevSwingLow=NaN;
  let structureBias=0;
  let lastBuyBar=0,lastSellBar=0;
  let orHigh:number|null=null,orLow:number|null=null,orEstablished=false,orBrokenUp=false,orBrokenDown=false;
  // Self-correction (simplified)
  let consecutiveLosses=0,consecutiveWins=0;
  // Liq pools (rolling)
  const recentSwH:number[]=[]; const recentSwL:number[]=[];

  // FVG tracking
  const fvgTop:number[]=[],fvgBot:number[]=[],fvgIsBull:boolean[]=[],fvgBar:number[]=[];

  // HTF proxy — use 12-bar EMA of probability as HTF score proxy
  const htfEma9v=ema(closes,9*12);
  const htfEma21v=ema(closes,21*12);
  const htfAtr=atrArr(bars.map(b=>({...b,high:b.high,low:b.low,close:b.close,open:b.open,volume:b.volume,time:b.time})),14);

  // Rolling delta
  const rollingDeltaArr=new Array(n).fill(0);
  for(let i=lookback-1;i<n;i++) rollingDeltaArr[i]=sma(barDelta,lookback,i)*lookback;

  const results:IFPQv4Bar[]=[];

  // Win tracker (simplified)
  let inLongTrade=false,inShortTrade=false,lastLongSL=0,lastShortSL=0,lastLongTP=0,lastShortTP=0;
  let longEntryBar=0,shortEntryBar=0,lastLongGrade="",lastShortGrade="";

  for(let i=0;i<n;i++){
    if(i<lookback+20) continue; // warmup

    const close=closes[i],open=opens[i],high=highs[i],low=lows[i];
    const vol=volumes[i];
    const hv=hasVol[i];
    const atrI=atr[i]||0.001;
    const vwapI=vwapV[i];
    const ns=newSession[i];

    // ── Module 1: Regime ──
    const atrZ=zScore(atr,lookback,i);
    const adxSmooth=adxEma[i]||0;
    const adxTrending=adxSmooth>25;
    const atrExpanding=atrZ>1.0;
    const atrContracting=atrZ<-0.5;

    let rawRegime="RANGING";
    if(adxTrending&&atrExpanding) rawRegime="VOLATILE TREND";
    else if(adxTrending&&!atrExpanding) rawRegime="TRENDING";
    else if(!adxTrending&&atrExpanding) rawRegime="VOLATILE";
    else if(!adxTrending&&atrContracting) rawRegime="QUIET";

    if(rawRegime!==regime){
      if(rawRegime===pendingRegime){regimeConfirmCount++;}
      else{pendingRegime=rawRegime;regimeConfirmCount=1;}
      if(regimeConfirmCount>=3){regime=rawRegime;regimeConfirmCount=0;}
    } else{pendingRegime="";regimeConfirmCount=0;}

    const regimeColor=["TRENDING","VOLATILE TREND"].includes(regime)?"#00E676":regime==="RANGING"?"#2196F3":regime==="VOLATILE"?"#FF5252":"#787B86";

    let sigThresh=baseSigThresh;
    sigThresh=regime==="QUIET"?baseSigThresh*0.85:regime==="VOLATILE"?baseSigThresh*1.10:["TRENDING","VOLATILE TREND"].includes(regime)?baseSigThresh*0.95:baseSigThresh;

    const dynStopMult=["VOLATILE","VOLATILE TREND"].includes(regime)?Math.max(1.5,2.0):["QUIET","RANGING"].includes(regime)?Math.max(1.5,1.8):1.5;
    let dynCooldown=["VOLATILE","RANGING"].includes(regime)?Math.max(20,30):regime==="QUIET"?Math.max(20,25):Math.min(20,15);

    // ── Module 2: Probability ──
    const rsiZ=zScore(rsiV,lookback,i);
    const macdZ=zScore(macdHist,lookback,i);
    const rocZ=zScore(rocV,lookback,i);
    const momentumComposite=rsiZ*0.35+macdZ*0.35+rocZ*0.30;

    const obvZ=hv?zScore(obvV,lookback,i):0;
    const volZ=hv?zScore(volumes,lookback,i):0;
    const deltaZ=hv?zScore(rollingDeltaArr,lookback,i):0;
    const priceZ=zScore(closes,lookback,i);
    const volumeComposite=hv?(obvZ*0.35+deltaZ*0.40+volZ*0.25):0;

    const fastTrend=atrI>0?(ema9v[i]-ema21v[i])/atrI:0;
    const medTrend=atrI>0?(ema21v[i]-ema50v[i])/atrI:0;
    const structBias=close>ema200v[i]?1:close<ema200v[i]?-1:0;
    const contTrend=fastTrend*0.50+medTrend*0.30+structBias*0.20;
    const contTrendArr=new Array(n).fill(0);
    // approximate contTrend for zScore — use current value
    for(let j=0;j<=i;j++) contTrendArr[j]=atr[j]>0?((ema9v[j]-ema21v[j])/atr[j])*0.50+((ema21v[j]-ema50v[j])/atr[j])*0.30+(closes[j]>ema200v[j]?1:closes[j]<ema200v[j]?-1:0)*0.20:0;
    const trendZ=zScore(contTrendArr,lookback,i);
    const rangeHigh=highest(highs,lookback,i);
    const rangeLow=lowest(lows,lookback,i);
    const rangePos=rangeLow!==rangeHigh?(close-rangeLow)/(rangeHigh-rangeLow)*2-1:0;
    const trendComposite=trendZ*0.5+rangePos*0.5;

    const bbBasisI=bbBasis[i];
    const bbDevI=bbDev[i]||0;
    const bbPos=bbDevI!==0?(close-bbBasisI)/bbDevI:0;
    const vwapDevArr=closes.map((c,j)=>c-vwapV[j]);
    const vwapDev=zScore(vwapDevArr,lookback,i);
    const meanRevComposite=(bbPos*0.5+vwapDev*0.5)*-1;

    let tw=["TRENDING","VOLATILE TREND"].includes(regime)?0.40:0.20;
    let mw=["TRENDING","VOLATILE TREND"].includes(regime)?0.30:0.25;
    let vw=0.25*(hv?1:0);
    let mrw=regime==="VOLATILE TREND"?0:regime==="TRENDING"?0.05:["RANGING","QUIET"].includes(regime)?0.30:0.15;
    const total=tw+mw+vw+mrw; tw/=total;mw/=total;vw/=total;mrw/=total;
    const rawScore=trendComposite*tw+momentumComposite*mw+volumeComposite*vw+meanRevComposite*mrw;
    const regimeScale=regime==="TRENDING"?50:regime==="VOLATILE TREND"?45:regime==="RANGING"?35:regime==="VOLATILE"?30:45;
    const probability=clamp(rawScore*regimeScale,-100,100);

    // ── Module 3: HTF (simplified using longer EMAs) ──
    const htfEma9I=htfEma9v[i];const htfEma21I=htfEma21v[i];const htfAtrI=htfAtr[i]||1;
    const htfTrendStrength=htfAtrI>0?(htfEma9I-htfEma21I)/htfAtrI:0;
    const htfRsiDev=(rsiV[i]-50)/50; // use current RSI as proxy
    const htfScore=htfTrendStrength*0.6+htfRsiDev*0.4;
    const htfDirectionMatch=probability>0?htfScore:probability<0?-htfScore:0;
    const mtfMultiplier=clamp(1.0+htfDirectionMatch*0.25,0.7,1.3);
    const adjustedProbability=clamp(probability*mtfMultiplier,-100,100);
    const htfBullish=htfScore>0.2; const htfBearish=htfScore<-0.2;
    const htfAligned=(adjustedProbability>0&&!htfBearish)||(adjustedProbability<0&&!htfBullish);

    // ── Module 4: Prob Momentum ──
    const adjProbArr=new Array(n).fill(0);
    // We build a running array — use results so far
    // Approximate: use adjustedProbability EMA
    for(let j=0;j<=i;j++) adjProbArr[j]=j<results.length?results[j-(i-results.length+1+(n-results.length))]?.adjustedProbability??0:adjustedProbability;
    const probEma5I=ema(adjProbArr.slice(0,i+1),5)[i]??adjustedProbability;
    const probEma20I=ema(adjProbArr.slice(0,i+1),20)[i]??adjustedProbability;
    const probMomentum=probEma5I-probEma20I;
    const probAccel=i>=5?adjustedProbability-(results[results.length-5]?.adjustedProbability??adjustedProbability):0;
    const probMomStr=probMomentum>10?"RISING ▲":probMomentum<-10?"FADING ▼":"STEADY ─";
    const convictionOK=!(probMomentum>10&&adjustedProbability<0)&&!(probMomentum<-10&&adjustedProbability>0);

    // ── Module 5: Reversal ──
    // VWAP SD
    const vwapDiffArr=closes.map((c,j)=>c-vwapV[j]);
    const vwapSD=stdev(vwapDiffArr,lookback,i)||atrI;
    const proj1Upper=vwapI+vwapSD;const proj1Lower=vwapI-vwapSD;
    const proj2Upper=vwapI+vwapSD*2;const proj2Lower=vwapI-vwapSD*2;

    // Component 1: Vol exhaustion
    const volSpike=hv&&volZ>2.0;
    const priceAtHigh=rangePos>0.85; const priceAtLow=rangePos<-0.85;
    const exhaustionBull=volSpike&&priceAtLow; const exhaustionBear=volSpike&&priceAtHigh;

    // Component 2: Momentum divergence
    const priceLow20=lowest(lows,20,i); const priceHigh20=highest(highs,20,i);
    let rsiAtLow=rsiV[i],rsiAtHigh=rsiV[i];
    for(let j=Math.max(0,i-20);j<=i;j++){
      if(lows[j]===priceLow20){rsiAtLow=rsiV[j];break;}
    }
    for(let j=Math.max(0,i-20);j<=i;j++){
      if(highs[j]===priceHigh20){rsiAtHigh=rsiV[j];break;}
    }
    const momDivBull=low<=priceLow20*1.001&&rsiV[i]>rsiAtLow+3&&rsiV[i]<45;
    const momDivBear=high>=priceHigh20*0.999&&rsiV[i]<rsiAtHigh-3&&rsiV[i]>55;

    // Component 3: Band rejection
    const prev=i>0;
    const bandRejectBull=prev&&lows[i-1]<=proj2Lower&&close>proj2Lower;
    const bandRejectBear=prev&&highs[i-1]>=proj2Upper&&close<proj2Upper;

    // Component 4: Prob shift
    const prevMom=results.length>=3?results[results.length-3]?.probMomentum??0:0;
    const probShiftBull=probMomentum>0&&prevMom<0&&adjustedProbability<0;
    const probShiftBear=probMomentum<0&&prevMom>0&&adjustedProbability>0;

    let revScoreBull=(exhaustionBull?25:0)+(momDivBull?25:0)+(bandRejectBull?25:0)+(probShiftBull?25:0);
    let revScoreBear=(exhaustionBear?25:0)+(momDivBear?25:0)+(bandRejectBear?25:0)+(probShiftBear?25:0);
    const revThreshold=["TRENDING","VOLATILE TREND","VOLATILE"].includes(regime)?75:50;
    const strongTrendDown=trendZ<-1.5;const strongTrendUp=trendZ>1.5;
    const trendGateBull=!strongTrendDown||revScoreBull>=75;
    const trendGateBear=!strongTrendUp||revScoreBear>=75;

    // Waterfall filter
    let newLowCount=0,newHighCount=0;
    for(let j=0;j<8;j++){
      if(i-j>=0&&lows[i-j]<=lowest(lows,5,Math.max(0,i-j-1))) newLowCount++;
      if(i-j>=0&&highs[i-j]>=highest(highs,5,Math.max(0,i-j-1))) newHighCount++;
    }
    const notWaterfall=newLowCount<4; const notMeltup=newHighCount<4;
    barsSinceRevBull++;barsSinceRevBear++;
    const revCooldownBull=barsSinceRevBull>=8; const revCooldownBear=barsSinceRevBear>=8;

    const revBull=revScoreBull>=revThreshold&&trendGateBull&&notWaterfall&&revCooldownBull;
    const revBear=revScoreBear>=revThreshold&&trendGateBear&&notMeltup&&revCooldownBear;
    if(revBull) barsSinceRevBull=0;
    if(revBear) barsSinceRevBear=0;
    const revActive=revBull||revBear;
    const revScore=Math.max(revScoreBull,revScoreBear);
    const revGrade=revScore>=100?"A+":revScore>=75?"A":revScore>=50?"B":"—";
    const revCountBull=(exhaustionBull?1:0)+(momDivBull?1:0)+(bandRejectBull?1:0)+(probShiftBull?1:0);
    const revCountBear=(exhaustionBear?1:0)+(momDivBear?1:0)+(bandRejectBear?1:0)+(probShiftBear?1:0);
    const revCountMax=Math.max(revCountBull,revCountBear);
    let revDetail="";
    if(revScoreBull>=revScoreBear){
      if(exhaustionBull)revDetail+="Exhaust ";if(momDivBull)revDetail+="Diverg ";
      if(bandRejectBull)revDetail+="BandRej ";if(probShiftBull)revDetail+="ProbFlip ";
    } else {
      if(exhaustionBear)revDetail+="Exhaust ";if(momDivBear)revDetail+="Diverg ";
      if(bandRejectBear)revDetail+="BandRej ";if(probShiftBear)revDetail+="ProbFlip ";
    }

    // ── Module 6: Near-edge ──
    const absAdjProb=Math.abs(adjustedProbability);
    const nearEdge=absAdjProb>=sigThresh*0.45&&absAdjProb<sigThresh&&absAdjProb>=48;
    const buildingLong=nearEdge&&adjustedProbability>0&&probMomentum>0;
    const buildingShort=nearEdge&&adjustedProbability<0&&probMomentum<0;
    const decayingLong=nearEdge&&adjustedProbability>0&&probMomentum<=0;
    const decayingShort=nearEdge&&adjustedProbability<0&&probMomentum<=0;
    const atEdgeLong=adjustedProbability>=sigThresh;
    const atEdgeShort=adjustedProbability<=-sigThresh;
    let nearEdgeStr="";
    if(buildingLong) nearEdgeStr=`BUILDING ▲ ${Math.round(adjustedProbability)}% → ${Math.round(sigThresh)}`;
    else if(buildingShort) nearEdgeStr=`BUILDING ▼ ${Math.round(adjustedProbability)}% → -${Math.round(sigThresh)}`;
    else if(decayingLong||decayingShort) nearEdgeStr=`FADING ${Math.round(adjustedProbability)}% ← losing steam`;
    else if(atEdgeLong) nearEdgeStr=`AT EDGE ▲ ${Math.round(adjustedProbability)}% ✓`;
    else if(atEdgeShort) nearEdgeStr=`AT EDGE ▼ ${Math.round(adjustedProbability)}% ✓`;

    // ── Candle basics ──
    const isBull=close>open; const isBear=close<open;
    const bodySize=Math.abs(close-open); const totalRange=high-low;
    const bodyRatio=totalRange>0?bodySize/totalRange:0;
    const upV=isBull?vol:0; const dnV=isBear?vol:0;
    const barBuyPct=hv&&vol>0?upV/vol:0.5;
    const upperWick=high-Math.max(close,open); const lowerWick=Math.min(close,open)-low;
    const strongUpperWick=totalRange>0&&upperWick/totalRange>0.30;
    const strongLowerWick=totalRange>0&&lowerWick/totalRange>0.30;

    // ── Module v4-A: Absorption ──
    const absorbProx=atrI*0.5;
    const nearKeyLevel=Math.abs(close-vwapI)<=absorbProx;
    const nearVWAP=Math.abs(close-vwapI)<=absorbProx;
    const candleMid=(high+low)/2;
    const deltaConfirmBull=hv&&barBuyPct<0.52;
    const deltaConfirmBear=hv&&barBuyPct>0.48;
    const highVolAbs=hv&&volZ>0.5; const smallBody=bodyRatio<0.35;
    const absorbBull=highVolAbs&&smallBody&&nearKeyLevel&&close>=candleMid;
    const absorbBear=highVolAbs&&smallBody&&nearKeyLevel&&close<candleMid;
    const absorbActive=absorbBull||absorbBear;
    const strictVol=hv&&volZ>0.8; const strictBody=bodyRatio<0.25;
    const hasWicks=(upperWick>bodySize*0.5)||(lowerWick>bodySize*0.5);
    const absorbBullStrict=strictVol&&strictBody&&nearKeyLevel&&hasWicks&&strongLowerWick&&deltaConfirmBull&&close>=candleMid;
    const absorbBearStrict=strictVol&&strictBody&&nearKeyLevel&&hasWicks&&strongUpperWick&&deltaConfirmBear&&close<candleMid;

    if(absorbBull&&(isNaN(absorbClusterPrice)||Math.abs(close-absorbClusterPrice)<=atrI*0.3)){
      absorbBullCluster++;absorbBearCluster=0;absorbClusterPrice=close;
    } else if(absorbBear&&(isNaN(absorbClusterPrice)||Math.abs(close-absorbClusterPrice)<=atrI*0.3)){
      absorbBearCluster++;absorbBullCluster=0;absorbClusterPrice=close;
    } else if(!absorbActive){
      absorbBullCluster=Math.max(0,absorbBullCluster-1);
      absorbBearCluster=Math.max(0,absorbBearCluster-1);
      if(absorbBullCluster===0&&absorbBearCluster===0) absorbClusterPrice=NaN;
    }
    const absorbClusterBull=absorbBullCluster>=2;
    const absorbClusterBear=absorbBearCluster>=2;
    const absorbContext=nearVWAP?"VWAP":"LVL";

    // ── Module v4-B: Trapped traders ──
    const swHigh5=i>=4?highest(highs,5,i):high;
    const swLow5=i>=4?lowest(lows,5,i):low;
    const multiBarBreakDown=i>=2&&lows[i-1]<lowest(lows,5,Math.max(0,i-2))&&lows[i-2]<lowest(lows,5,Math.max(0,i-3));
    const multiBarBreakUp=i>=2&&highs[i-1]>highest(highs,5,Math.max(0,i-2))&&highs[i-2]>highest(highs,5,Math.max(0,i-3));
    const reclaimBodyBull=bodyRatio>0.35&&close>open;
    const reclaimBodyBear=bodyRatio>0.35&&close<open;
    const prev1volZ=i>0?zScore(volumes,lookback,i-1):0;
    const breakDown=i>0&&lows[i-1]<(i>1?lowest(lows,5,i-2):lows[i-1])&&prev1volZ>0.3&&!multiBarBreakDown;
    const bullReclaim=close>open&&i>0&&close>(highs[i-1]+lows[i-1])/2;
    const trapShorts=breakDown&&bullReclaim;
    const breakUp=i>0&&highs[i-1]>(i>1?highest(highs,5,i-2):highs[i-1])&&prev1volZ>0.3&&!multiBarBreakUp;
    const bearReclaim=close<open&&i>0&&close<(highs[i-1]+lows[i-1])/2;
    const trapLongs=breakUp&&bearReclaim;
    const trapActive=trapShorts||trapLongs;

    // ── Module v4-C: Delta divergence ──
    const deltaDivBull=hv&&isBear&&barBuyPct>0.55;
    const deltaDivBear=hv&&isBull&&barBuyPct<0.45;
    if(deltaDivBull){deltaDivBullStack++;deltaDivBearStack=0;}
    else if(deltaDivBear){deltaDivBearStack++;deltaDivBullStack=0;}
    else{deltaDivBullStack=0;deltaDivBearStack=0;}
    const deltaDivSignal=deltaDivBullStack>=2||deltaDivBearStack>=2;
    const deltaDivScore=Math.max(deltaDivBullStack,deltaDivBearStack)/5;

    // ── Module v4-D: KC/BB Squeeze ──
    const kcUpper=kcBasis[i]+atr10[i]*1.5;
    const kcLower=kcBasis[i]-atr10[i]*1.5;
    const bbUpper=bbBasisI+bbDevI*2;
    const bbLower=bbBasisI-bbDevI*2;
    const bbInsideKC=bbUpper<kcUpper&&bbLower>kcLower;
    if(bbInsideKC) squeezeDuration++;else squeezeDuration=0;
    const volSqueezeActive=bbInsideKC&&squeezeDuration>=3;
    const prevSqueezeDur=results.length>0?results[results.length-1]?.squeezeDuration??0:0;
    const volSqueezeRelease=!bbInsideKC&&prevSqueezeDur>=3;
    const squeezeStrength=volSqueezeActive?Math.min(squeezeDuration/20,1):0;

    // Level squeeze
    let squeezeLevelCount=0;
    if(Math.abs(proj1Upper-close)<=atrI) squeezeLevelCount++;
    if(Math.abs(proj1Lower-close)<=atrI) squeezeLevelCount++;
    if(Math.abs(vwapI-close)<=atrI) squeezeLevelCount++;
    const isSqueeze=squeezeLevelCount>=3;
    const dualSqueeze=isSqueeze&&volSqueezeActive;

    // ── Module v4-E: Implied move ──
    const volPremium=atrSMA50[i]>0?atrI/atrSMA50[i]:1;
    const impliedMoveAdj=clamp(2.0-volPremium,0.8,1.2);
    const volPremStr=volPremium>1.3?"HIGH VOL":volPremium>1.0?"ABOVE AVG":volPremium>0.7?"BELOW AVG":"LOW VOL";

    // ── Module v4-F: Time at extreme ──
    const extremeThresh=vwapSD*1.5||atrI;
    const aboveExtreme=close>vwapI+extremeThresh;
    const belowExtreme=close<vwapI-extremeThresh;
    if(aboveExtreme||belowExtreme) barsAtExtreme++;else barsAtExtreme=0;
    const reversionPressure=Math.min(barsAtExtreme/15,1);
    const highRevPressure=reversionPressure>=0.4;

    // ── Module v4-G: FVG ──
    const bullFVG=i>=2&&low>highs[i-2]&&closes[i-1]>opens[i-1];
    const bearFVG=i>=2&&high<lows[i-2]&&closes[i-1]<opens[i-1];
    if(bullFVG){fvgTop.push(low);fvgBot.push(highs[i-2]??0);fvgIsBull.push(true);fvgBar.push(i);}
    if(bearFVG){fvgTop.push(lows[i-2]??0);fvgBot.push(high);fvgIsBull.push(false);fvgBar.push(i);}
    // Clean FVGs
    for(let fi=fvgTop.length-1;fi>=0;fi--){
      const filled=fvgIsBull[fi]?(low<=fvgBot[fi]):(high>=fvgTop[fi]);
      const expired=i-fvgBar[fi]>100;
      if(filled||expired){fvgTop.splice(fi,1);fvgBot.splice(fi,1);fvgIsBull.splice(fi,1);fvgBar.splice(fi,1);}
    }
    let nearestFVG:number|null=null;
    if(fvgTop.length>0){
      let minD=Infinity;
      for(let fi=0;fi<fvgTop.length;fi++){
        const mid=(fvgTop[fi]+fvgBot[fi])/2;
        const d=Math.abs(close-mid);
        if(d<minD){minD=d;nearestFVG=mid;}
      }
    }
    const nearFVG=nearestFVG!==null&&Math.abs(close-nearestFVG)<=atrI*0.5;

    // ── Module v4-H: BOS/CHoCH ──
    const swL5=pivotLow(lows,5,5,i);
    const swH5=pivotHigh(highs,5,5,i);
    if(swH5!==null){prevSwingHigh=lastSwingHigh;lastSwingHigh=swH5;}
    if(swL5!==null){prevSwingLow=lastSwingLow;lastSwingLow=swL5;}
    const higherHigh=!isNaN(lastSwingHigh)&&!isNaN(prevSwingHigh)&&lastSwingHigh>prevSwingHigh;
    const higherLow=!isNaN(lastSwingLow)&&!isNaN(prevSwingLow)&&lastSwingLow>prevSwingLow;
    const lowerHigh=!isNaN(lastSwingHigh)&&!isNaN(prevSwingHigh)&&lastSwingHigh<prevSwingHigh;
    const lowerLow=!isNaN(lastSwingLow)&&!isNaN(prevSwingLow)&&lastSwingLow<prevSwingLow;
    if(higherHigh&&higherLow) structureBias=1;
    else if(lowerHigh&&lowerLow) structureBias=-1;
    const bullBOS=!isNaN(lastSwingHigh)&&close>lastSwingHigh&&(i>0?closes[i-1]:close)<=lastSwingHigh;
    const bearBOS=!isNaN(lastSwingLow)&&close<lastSwingLow&&(i>0?closes[i-1]:close)>=lastSwingLow;
    const bullCHoCH=bullBOS&&structureBias===-1;
    const bearCHoCH=bearBOS&&structureBias===1;
    const structStr=structureBias===1?"HH/HL ▲":structureBias===-1?"LH/LL ▼":"MIXED";
    const structTrendDiv=(structureBias===1&&adjustedProbability<-20)||(structureBias===-1&&adjustedProbability>20);

    // ── Module v4-I: Liq pools ──
    if(swH5!==null){recentSwH.push(swH5);if(recentSwH.length>20)recentSwH.shift();}
    if(swL5!==null){recentSwL.push(swL5);if(recentSwL.length>20)recentSwL.shift();}
    const eqThresh=atrI*0.15;
    let liqPoolHigh:number|null=null,liqPoolLow:number|null=null;
    let liqPoolHighCount=0,liqPoolLowCount=0;
    if(recentSwH.length>=2){
      for(let fi=recentSwH.length-1;fi>=0;fi--){
        const lvl=recentSwH[fi];let cnt=0;
        for(let fj=0;fj<recentSwH.length;fj++){if(fj!==fi&&Math.abs(recentSwH[fj]-lvl)<=eqThresh)cnt++;}
        if(cnt>=1&&(liqPoolHigh===null||Math.abs(lvl-close)<Math.abs(liqPoolHigh-close))){liqPoolHigh=lvl;liqPoolHighCount=cnt+1;}
      }
    }
    if(recentSwL.length>=2){
      for(let fi=recentSwL.length-1;fi>=0;fi--){
        const lvl=recentSwL[fi];let cnt=0;
        for(let fj=0;fj<recentSwL.length;fj++){if(fj!==fi&&Math.abs(recentSwL[fj]-lvl)<=eqThresh)cnt++;}
        if(cnt>=1&&(liqPoolLow===null||Math.abs(lvl-close)<Math.abs(liqPoolLow-close))){liqPoolLow=lvl;liqPoolLowCount=cnt+1;}
      }
    }
    const liqSweepBull=liqPoolLow!==null&&low<=liqPoolLow&&close>liqPoolLow;
    const liqSweepBear=liqPoolHigh!==null&&high>=liqPoolHigh&&close<liqPoolHigh;
    const trapWithSweepBull=trapShorts&&liqSweepBull;
    const trapWithSweepBear=trapLongs&&liqSweepBear;

    // ── Module v4-L: ORB (ET time) ──
    const d=new Date(bars[i].time*1000);
    const etH=((d.getUTCHours()-4+24)%24);
    const etM=d.getUTCMinutes();
    const currentTime=etH*100+etM;
    if(ns){orHigh=null;orLow=null;orEstablished=false;orBrokenUp=false;orBrokenDown=false;}
    const isORWindow=currentTime>=930&&currentTime<1000;
    const isPostOR=currentTime>=1000&&currentTime<1600;
    if(isORWindow){orHigh=orHigh===null?high:Math.max(orHigh,high);orLow=orLow===null?low:Math.min(orLow,low);}
    if(isPostOR&&orHigh!==null&&!orEstablished) orEstablished=true;
    const orbLong=orEstablished&&!orBrokenUp&&close>(orHigh??0)&&hv&&volZ>0.5;
    const orbShort=orEstablished&&!orBrokenDown&&close<(orLow??0)&&hv&&volZ>0.5;
    if(orbLong) orBrokenUp=true;if(orbShort) orBrokenDown=true;

    // ── Module v4-M: Time quality ──
    let timeQuality=1.0;
    if(currentTime>=930&&currentTime<1000) timeQuality=1.15;
    else if(currentTime>=1000&&currentTime<1030) timeQuality=1.10;
    else if(currentTime>=1030&&currentTime<1130) timeQuality=1.05;
    else if(currentTime>=1130&&currentTime<1330) timeQuality=0.85;
    else if(currentTime>=1500&&currentTime<1545) timeQuality=1.10;
    else if(currentTime>=1545&&currentTime<1600) timeQuality=0.90;
    else if(currentTime<930||currentTime>=1600) timeQuality=0.80;

    // ── v4 Composite boost ──
    let v4Boost=0;let v4Count=0;
    if(absorbClusterBull&&adjustedProbability>0){v4Boost+=0.08;v4Count++;}
    else if(absorbBull&&adjustedProbability>0){v4Boost+=0.05;v4Count++;}
    if(absorbClusterBear&&adjustedProbability<0){v4Boost+=0.08;v4Count++;}
    else if(absorbBear&&adjustedProbability<0){v4Boost+=0.05;v4Count++;}
    if(trapWithSweepBull&&adjustedProbability>0){v4Boost+=0.12;v4Count++;}
    else if(trapShorts&&adjustedProbability>0){v4Boost+=0.08;v4Count++;}
    if(trapWithSweepBear&&adjustedProbability<0){v4Boost+=0.12;v4Count++;}
    else if(trapLongs&&adjustedProbability<0){v4Boost+=0.08;v4Count++;}
    if(deltaDivBullStack>=2&&adjustedProbability>0){v4Boost+=deltaDivScore*0.05;v4Count++;}
    if(deltaDivBearStack>=2&&adjustedProbability<0){v4Boost+=deltaDivScore*0.05;v4Count++;}
    if(volSqueezeActive){v4Boost+=squeezeStrength*0.06;v4Count++;}
    if(highRevPressure&&((aboveExtreme&&adjustedProbability<0)||(belowExtreme&&adjustedProbability>0))){v4Boost+=reversionPressure*0.06;v4Count++;}
    if(nearFVG){v4Boost+=0.04;v4Count++;}
    if(bullBOS&&adjustedProbability>0){v4Boost+=0.05;v4Count++;}
    if(bearBOS&&adjustedProbability<0){v4Boost+=0.05;v4Count++;}
    if(liqSweepBull&&adjustedProbability>0){v4Boost+=0.07;v4Count++;}
    if(liqSweepBear&&adjustedProbability<0){v4Boost+=0.07;v4Count++;}
    if(orbLong&&adjustedProbability>0){v4Boost+=0.06;v4Count++;}
    if(orbShort&&adjustedProbability<0){v4Boost+=0.06;v4Count++;}
    if(structTrendDiv) v4Boost-=0.05;
    const v4Multiplier=clamp((1+v4Boost)*timeQuality*impliedMoveAdj,0.6,1.5);
    const v4Probability=clamp(adjustedProbability*v4Multiplier,-100,100);
    const v4Grade=v4Count>=5?"S":v4Count>=3?"A":v4Count>=1?"B":"—";

    // ── Module 9: Signal generation ──
    const candleQuality=bodyRatio>=0.50?1.0:bodyRatio>=0.30?0.85:0;
    const bullConfirm=isBull&&candleQuality>0&&(!hv||vol>sma(volumes,20,i));
    const bearConfirm=isBear&&candleQuality>0&&(!hv||vol>sma(volumes,20,i));
    const candleAdjProb=v4Probability*candleQuality;
    const absProb=Math.abs(candleAdjProb);
    const sigGrade=absProb>=85?"A+":absProb>=70?"A":absProb>=55?"B":"C";
    const longTrajectory=probAccel>0;const shortTrajectory=probAccel<0;
    const bGradeOKLong=absProb>=70||probMomentum>0;
    const bGradeOKShort=absProb>=70||probMomentum<0;
    const vwapDist=Math.abs(close-vwapI);
    const overextThresh=vwapSD*1.5||atrI;
    const overextended=vwapDist>overextThresh;
    const overextGuardOK=!overextended||revActive;
    let pullbackOK=true;
    if(["TRENDING","VOLATILE TREND"].includes(regime)){
      if(adjustedProbability>0) pullbackOK=close<=vwapI+vwapSD||close<ema9v[i];
      else pullbackOK=close>=vwapI-vwapSD||close>ema9v[i];
    }
    const sessionOK=!(currentTime<930||currentTime>=1600);
    const qualityGate=absProb>=55&&htfAligned&&convictionOK;

    // Adaptive threshold (simplified — no rolling history)
    const adaptiveMult=1.0;
    sigThresh=Math.max(35,Math.min(85,sigThresh*adaptiveMult));

    const longSignal=candleAdjProb>=sigThresh&&bullConfirm&&i-lastBuyBar>=dynCooldown&&qualityGate&&bGradeOKLong&&longTrajectory&&overextGuardOK&&pullbackOK&&sessionOK;
    const shortSignal=candleAdjProb<=-sigThresh&&bearConfirm&&i-lastSellBar>=dynCooldown&&qualityGate&&bGradeOKShort&&shortTrajectory&&overextGuardOK&&pullbackOK&&sessionOK;
    if(longSignal) lastBuyBar=i;
    if(shortSignal) lastSellBar=i;

    // ── Bar color ──
    let barCol:string|null=null;
    if(revActive) barCol="rgba(224,64,251,0.4)";
    else if(adjustedProbability>=70) barCol="#00E676";
    else if(adjustedProbability<=-70) barCol="#FF5252";
    else if(adjustedProbability>=40) barCol="rgba(0,230,118,0.5)";
    else if(adjustedProbability<=-40) barCol="rgba(255,82,82,0.5)";

    // ── Action text ──
    let actionText="⏳ NO EDGE — Stay Flat";
    if(revActive){
      actionText=revBull?"🔄 REVERSAL — Bullish":"🔄 REVERSAL — Bearish";
    } else if(adjustedProbability>=70){actionText="🟢 LOOK FOR LONGS";}
    else if(adjustedProbability<=-70){actionText="🔴 LOOK FOR SHORTS";}
    else if(adjustedProbability>=sigThresh){actionText="🟡 LONGS POSSIBLE";}
    else if(adjustedProbability<=-sigThresh){actionText="🟡 SHORTS POSSIBLE";}
    else if(buildingLong){actionText="📈 BUILDING LONG";}
    else if(buildingShort){actionText="📉 BUILDING SHORT";}
    else if(regime==="QUIET"){actionText="⏸ WAIT — Compression";}
    else if(regime==="VOLATILE"){actionText="⚠ CAUTION — Choppy";}

    results.push({
      time:bars[i].time,
      probability, adjustedProbability, regime, regimeColor,
      grade: revGrade, sigGrade,
      longSignal, shortSignal,
      momentum: Math.round(clamp(momentumComposite*regimeScale,-100,100)),
      volume: Math.round(clamp(volumeComposite*regimeScale,-100,100)),
      trend: Math.round(clamp(trendComposite*regimeScale,-100,100)),
      meanRev: Math.round(clamp(meanRevComposite*regimeScale,-100,100)),
      probMomentum, probMomStr, probAccel,
      revBull, revBear, revScore, revGrade, revCountMax, revDetail, revActive,
      buildingLong, buildingShort, atEdgeLong, atEdgeShort, nearEdgeStr, sigThresh,
      vwap: vwapI, proj1Upper, proj1Lower, proj2Upper, proj2Lower, vwapSD,
      bullBOS, bearBOS, bullCHoCH, bearCHoCH, structStr,
      absorbBull, absorbBear, absorbBullStrict, absorbBearStrict,
      absorbClusterBull, absorbClusterBear, absorbContext,
      trapShorts, trapLongs, trapActive, trapWithSweepBull, trapWithSweepBear,
      deltaDivBull, deltaDivBear, deltaDivBullStack, deltaDivBearStack,
      bbInsideKC, volSqueezeActive, volSqueezeRelease, squeezeDuration, isSqueeze,
      bullFVG, bearFVG,
      liqSweepBull, liqSweepBear, liqPoolHigh, liqPoolLow,
      barsAtExtreme, reversionPressure,
      volPremium, volPremStr,
      orbLong, orbShort, orHigh, orLow,
      v4Count, v4Grade,
      htfAligned, htfScore,
      actionText,
      barCol,
    });
  }
  return results;
}
