// lib/indicators/ifpq.ts
// Exact port of IFP-Q v4.0 Pine Script — Composite Probability Engine
// Modules: Momentum (RSI+MACD+ROC) + Volume-Price (OBV+Delta) + Trend (EMA) + MeanRev (BB+VWAP)
// Weighted by regime, scaled, MTF-adjusted → probability score → signals

import { Bar, sma, ema, stdev, atr, rsi as calcRSI, macd as calcMACD, roc as calcROC, highest, lowest, clamp } from "./utils";

export interface IFPQBar {
  time:        number;
  probability: number;   // -100 to +100 (adjustedProbability)
  regime:      string;   // TRENDING | VOLATILE TREND | RANGING | VOLATILE | QUIET
  signal?:     "LONG" | "SHORT";
  grade:       string;   // A+ | A | B | C
  momentum:    number;   // -100 to +100
  trend:       number;
  volume:      number;
  meanRev:     number;
  revBull?:    boolean;  // reversal signal
  revBear?:    boolean;
}

export function calcIFPQ(bars: Bar[], lookback = 100, sensitivity = "Normal"): IFPQBar[] {
  const n = bars.length;
  if (n < 220) return []; // need enough for EMA200

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume || 0);
  const opens   = bars.map(b => b.open);

  // ── Module 1: Market Regime ────────────────────────────────────────────────
  const atrArr  = atr(bars, 14);
  const ema20   = ema(closes, 20);
  const ema50   = ema(closes, 50);

  // ADX components (simplified Pine ta.dmi port)
  const adxArr: number[] = new Array(n).fill(NaN);
  {
    const dLen = 14;
    const trArr   = bars.map((b,i) => i===0 ? b.high-b.low : Math.max(b.high-b.low, Math.abs(b.high-bars[i-1].close), Math.abs(b.low-bars[i-1].close)));
    const dmPlus  = bars.map((b,i) => i===0 ? 0 : Math.max(b.high-bars[i-1].high, 0) > Math.max(bars[i-1].low-b.low, 0) ? Math.max(b.high-bars[i-1].high, 0) : 0);
    const dmMinus = bars.map((b,i) => i===0 ? 0 : Math.max(bars[i-1].low-b.low, 0) > Math.max(b.high-bars[i-1].high, 0) ? Math.max(bars[i-1].low-b.low, 0) : 0);
    const k = 1/dLen;
    let smTR=0, smDMp=0, smDMm=0, adxPrev=0, started=false;
    for (let i=0; i<n; i++) {
      if (!started && i<dLen) { smTR+=trArr[i]; smDMp+=dmPlus[i]; smDMm+=dmMinus[i]; if(i===dLen-1) started=true; continue; }
      if (!started) continue;
      smTR  = smTR  - smTR/dLen + trArr[i];
      smDMp = smDMp - smDMp/dLen + dmPlus[i];
      smDMm = smDMm - smDMm/dLen + dmMinus[i];
      const diP = smTR>0 ? smDMp/smTR*100 : 0;
      const diM = smTR>0 ? smDMm/smTR*100 : 0;
      const dx  = (diP+diM)>0 ? Math.abs(diP-diM)/(diP+diM)*100 : 0;
      adxPrev = i===dLen ? dx : (adxPrev*(dLen-1)+dx)/dLen;
      adxArr[i] = adxPrev;
    }
  }

  // Smooth ADX (EMA5)
  const adxSmooth = ema(adxArr, 5);

  // ATR z-score over lookback
  const atrZ: number[] = new Array(n).fill(0);
  for (let i=lookback-1; i<n; i++) {
    const sl = atrArr.slice(i-lookback+1, i+1).filter(v=>!isNaN(v));
    if (!sl.length) continue;
    const m = sl.reduce((s,v)=>s+v,0)/sl.length;
    const sd = Math.sqrt(sl.reduce((s,v)=>s+(v-m)**2,0)/sl.length) || 1;
    atrZ[i] = (atrArr[i]-m)/sd;
  }

  // Regime detection with smoothing (Pine: require 3 bars to confirm)
  const rawRegimes: string[] = new Array(n).fill("RANGING");
  for (let i=0; i<n; i++) {
    const adx = adxSmooth[i] ?? 0;
    const az  = atrZ[i];
    const adxT = adx > 25, atrE = az > 1.0, atrC = az < -0.5;
    if (adxT && atrE)       rawRegimes[i] = "VOLATILE TREND";
    else if (adxT && !atrE) rawRegimes[i] = "TRENDING";
    else if (!adxT && atrE) rawRegimes[i] = "VOLATILE";
    else if (!adxT && atrC) rawRegimes[i] = "QUIET";
    else                     rawRegimes[i] = "RANGING";
  }
  // 3-bar confirmation
  const regimes: string[] = [...rawRegimes];
  let pending = "", pendingCount = 0;
  for (let i=1; i<n; i++) {
    if (rawRegimes[i] !== regimes[i-1]) {
      if (rawRegimes[i] === pending) pendingCount++;
      else { pending = rawRegimes[i]; pendingCount = 1; }
      if (pendingCount >= 3) { regimes[i] = pending; pendingCount = 0; }
      else regimes[i] = regimes[i-1];
    } else { pending = ""; pendingCount = 0; regimes[i] = rawRegimes[i]; }
  }

  // ── Module 2A: Momentum composite ─────────────────────────────────────────
  const rsiArr  = calcRSI(closes, 14);
  const { histogram: macdHist } = calcMACD(closes, 12, 26, 9);
  const rocArr  = calcROC(closes, 10);

  // z-scores over lookback
  const zScore = (vals: number[], i: number): number => {
    if (i < lookback-1) return 0;
    const sl = vals.slice(i-lookback+1, i+1).filter(v=>!isNaN(v));
    if (sl.length < 3) return 0;
    const m = sl.reduce((s,v)=>s+v,0)/sl.length;
    const sd = Math.sqrt(sl.reduce((s,v)=>s+(v-m)**2,0)/sl.length) || 1;
    return (vals[i]-m)/sd;
  };

  // ── Module 2B: Volume-Price ────────────────────────────────────────────────
  // OBV
  const obvArr: number[] = new Array(n).fill(0);
  for (let i=1; i<n; i++) obvArr[i] = obvArr[i-1] + (closes[i]>closes[i-1] ? volumes[i] : closes[i]<closes[i-1] ? -volumes[i] : 0);

  // Rolling delta (bar buy/sell)
  const upVol = bars.map(b => b.close > b.open ? (b.volume||0) : 0);
  const dnVol = bars.map(b => b.close < b.open ? (b.volume||0) : 0);
  const barDelta = upVol.map((u,i) => u - dnVol[i]);
  const rollingDelta = sma(barDelta, lookback);

  // ── Module 2C: Trend composite ─────────────────────────────────────────────
  const ema9arr  = ema(closes, 9);
  const ema21arr = ema(closes, 21);
  const ema200   = ema(closes, 200);

  // ── Module 2D: Mean Reversion ──────────────────────────────────────────────
  const bbBasis = sma(closes, 20);
  const bbDev   = stdev(closes, 20);
  // VWAP (cumulative session — approximate with SMA for simplicity across TFs)
  const vwapArr = sma(bars.map(b=>(b.high+b.low+b.close)/3), 20);

  // ── Output ────────────────────────────────────────────────────────────────
  const results: IFPQBar[] = [];
  let lastLongBar = -999, lastShortBar = -999;

  // Probability EMA for momentum tracking
  const probHistory: number[] = [];

  for (let i = Math.max(200, lookback); i < n; i++) {
    const regime = regimes[i];
    const baseSigThresh = sensitivity === "Conservative" ? 70 : sensitivity === "Aggressive" ? 40 : 55;
    // Regime-adjusted threshold
    const sigThresh = regime === "QUIET" ? baseSigThresh*0.85 : regime === "VOLATILE" ? baseSigThresh*1.10 : (regime==="TRENDING"||regime==="VOLATILE TREND") ? baseSigThresh*0.95 : baseSigThresh;
    // Regime scale
    const regimeScale = regime==="TRENDING"?50 : regime==="VOLATILE TREND"?45 : regime==="RANGING"?35 : regime==="VOLATILE"?30 : 45;

    // 2A: Momentum
    const rsiZ  = zScore(rsiArr, i);
    const macdZ = zScore(macdHist, i);
    const rocZ  = zScore(rocArr, i);
    const momentumComposite = rsiZ*0.35 + macdZ*0.35 + rocZ*0.30;

    // 2B: Volume-Price
    const hasVol = (volumes[i]||0) > 0;
    const obvZ   = hasVol ? zScore(obvArr, i) : 0;
    const volZ   = hasVol ? zScore(volumes, i) : 0;
    const deltaZ = hasVol ? zScore(rollingDelta as number[], i) : 0;
    const priceZ = zScore(closes, i);
    const vpDiv  = priceZ - deltaZ;
    const volumeComposite = hasVol ? obvZ*0.35 + deltaZ*0.40 + volZ*0.25 : 0;

    // 2C: Trend (continuous score — ATR-normalized EMA slopes)
    const atrV    = atrArr[i] || 1;
    const fastTrend  = (ema9arr[i] - ema21arr[i]) / atrV;
    const medTrend   = (ema21arr[i] - (ema50[i]??closes[i])) / atrV;
    const structBias = closes[i] > (ema200[i]??closes[i]) ? 1 : -1;
    const contTrend  = fastTrend*0.50 + medTrend*0.30 + structBias*0.20;
    const trendZ     = zScore(Array.from({length:n},(_,j)=>j<=i?contTrend:NaN), i);
    const rangeHi    = Math.max(...highs.slice(Math.max(0,i-lookback+1),i+1));
    const rangeLo    = Math.min(...lows.slice(Math.max(0,i-lookback+1),i+1));
    const rangePos   = rangeHi!==rangeLo ? (closes[i]-rangeLo)/(rangeHi-rangeLo)*2-1 : 0;
    const trendComposite = trendZ*0.5 + rangePos*0.5;

    // 2D: Mean Reversion
    const bbPos  = bbDev[i] ? (closes[i]-bbBasis[i])/bbDev[i] : 0;
    const vwapDev = zScore(closes.map((c,j)=>c-(vwapArr[j]??c)), i);
    const meanRevComposite = (bbPos*0.5 + vwapDev*0.5) * -1;

    // Weights by regime
    let tW = (regime==="TRENDING"||regime==="VOLATILE TREND") ? 0.40 : 0.20;
    let mW = (regime==="TRENDING"||regime==="VOLATILE TREND") ? 0.30 : 0.25;
    let vW = 0.25 * (hasVol ? 1 : 0);
    let mrW = regime==="VOLATILE TREND"?0:regime==="TRENDING"?0.05:(regime==="RANGING"||regime==="QUIET")?0.30:0.15;
    const total = tW+mW+vW+mrW || 1;
    tW/=total; mW/=total; vW/=total; mrW/=total;

    const rawScore = trendComposite*tW + momentumComposite*mW + volumeComposite*vW + meanRevComposite*mrW;
    const probability = clamp(rawScore * regimeScale, -100, 100);

    // Module 3: HTF multiplier (simplified — no request.security, use 1.0)
    const mtfMultiplier = 1.0;
    const adjustedProbability = clamp(probability * mtfMultiplier, -100, 100);

    // Module 4: Probability momentum
    probHistory.push(adjustedProbability);
    const pEma5  = ema(probHistory, 5);
    const pEma20 = ema(probHistory, 20);
    const probMomentum = (pEma5[pEma5.length-1]??adjustedProbability) - (pEma20[pEma20.length-1]??adjustedProbability);

    // Module 5: Reversal detection
    const rsiV  = rsiArr[i] ?? 50;
    const volRatio = hasVol && volumes.slice(Math.max(0,i-19),i+1).length > 0
      ? (volumes[i]||0) / (volumes.slice(Math.max(0,i-19),i+1).reduce((s,v)=>s+v,0)/20||1) : 1;
    const priceLo20 = Math.min(...lows.slice(Math.max(0,i-19),i+1));
    const priceHi20 = Math.max(...highs.slice(Math.max(0,i-19),i+1));
    const exhaustBull = volZ > 2.0 && (rangeLo!==rangeHi ? (closes[i]-rangeLo)/(rangeHi-rangeLo) < 0.15 : false);
    const exhaustBear = volZ > 2.0 && (rangeLo!==rangeHi ? (closes[i]-rangeLo)/(rangeHi-rangeLo) > 0.85 : false);
    const momDivBull  = closes[i] <= priceLo20*1.001 && rsiV < 45;
    const momDivBear  = closes[i] >= priceHi20*0.999 && rsiV > 55;
    const vwap = vwapArr[i] ?? closes[i];
    const vwapSD = bbDev[i] ?? atrV;
    const bandRejectBull = (lows[i-1]??closes[i]) <= vwap-vwapSD*2 && closes[i] > vwap-vwapSD*2;
    const bandRejectBear = (highs[i-1]??closes[i]) >= vwap+vwapSD*2 && closes[i] < vwap+vwapSD*2;
    const probShiftBull  = probMomentum > 0 && adjustedProbability < 0;
    const probShiftBear  = probMomentum < 0 && adjustedProbability > 0;

    let revScoreBull = (exhaustBull?25:0)+(momDivBull?25:0)+(bandRejectBull?25:0)+(probShiftBull?25:0);
    let revScoreBear = (exhaustBear?25:0)+(momDivBear?25:0)+(bandRejectBear?25:0)+(probShiftBear?25:0);
    const revThreshold = (regime==="TRENDING"||regime==="VOLATILE TREND"||regime==="VOLATILE") ? 75 : 50;
    const revBull = revScoreBull >= revThreshold;
    const revBear = revScoreBear >= revThreshold;

    // Signal generation
    const absProb = Math.abs(adjustedProbability);
    const grade   = absProb>=85?"A+":absProb>=70?"A":absProb>=55?"B":"C";
    const cooldown = regime==="VOLATILE"||regime==="RANGING" ? Math.max(30,20) : regime==="QUIET" ? Math.max(25,20) : Math.min(20,15);

    const bullConfirm = closes[i] > opens[i];
    const bearConfirm = closes[i] < opens[i];
    const volAvg = volumes.slice(Math.max(0,i-19),i+1).reduce((s,v)=>s+v,0)/20;
    const volConfirm = !hasVol || (volumes[i]||0) > volAvg;
    const convictionOK = !(probMomentum>10&&adjustedProbability<0) && !(probMomentum<-10&&adjustedProbability>0);

    const longOK  = absProb>=sigThresh && bullConfirm && volConfirm && convictionOK && probMomentum>0 && i-lastLongBar>=cooldown;
    const shortOK = absProb>=sigThresh && bearConfirm && volConfirm && convictionOK && probMomentum<0 && i-lastShortBar>=cooldown;

    let signal: "LONG"|"SHORT"|undefined;
    if (adjustedProbability >= sigThresh && longOK)  { signal = "LONG";  lastLongBar  = i; }
    if (adjustedProbability <= -sigThresh && shortOK) { signal = "SHORT"; lastShortBar = i; }

    results.push({
      time:        bars[i].time,
      probability: Math.round(adjustedProbability),
      regime,
      signal,
      grade,
      momentum:  Math.round(clamp(momentumComposite * regimeScale, -100, 100)),
      trend:     Math.round(clamp(trendComposite * regimeScale, -100, 100)),
      volume:    Math.round(clamp(volumeComposite * regimeScale, -100, 100)),
      meanRev:   Math.round(clamp(meanRevComposite * regimeScale, -100, 100)),
      revBull,
      revBear,
    });
  }

  return results;
}
