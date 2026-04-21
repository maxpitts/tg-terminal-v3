// lib/indicators/gammaflow.ts
// Exact port of GammaFlow [TraderLink] v2 Pine Script
// Core engine: priceAccel × volRatio → normalized gamma → regime detection

import { Bar, sma, ema, stdev, atr, highest, lowest, clamp } from "./utils";

export type GammaRegime = "CALM" | "WILD" | "SQUEEZE" | "PINNED";

export interface GammaBar {
  time:        number;
  gammaFlow:   number;   // normalized gamma oscillator
  regime:      GammaRegime;
  isCalm:      boolean;
  isWild:      boolean;
  isSqueeze:   boolean;
  isPinning:   boolean;
  confidence:  number;   // 0-95
  predictDir:  number;   // -1, 0, 1
  tradeType:   string;   // "BUY" | "SELL" | "WAIT" | "BUY BREAKOUT" | "SELL BREAKOUT"
  signal?:     "BUY" | "SELL";  // only when signal fires
  signalType?: "TRAP" | "ALGO" | "SQUEEZE" | "";
  rangePos:    number;   // 0-1 position in range
}

export function calcGammaFlow(
  bars: Bar[],
  gammaLen = 20,
  smoothLen = 5,
  sensitivity = 1.5
): GammaBar[] {
  const n = bars.length;
  if (n < gammaLen + smoothLen + 5) return [];

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume || 0);
  const opens   = bars.map(b => b.open);

  // ── Core gamma engine ──────────────────────────────────────────────────────
  const priceMoves  = closes.map((c, i) => i === 0 ? 0 : c - closes[i-1]);
  const priceAccels = priceMoves.map((m, i) => i === 0 ? 0 : m - priceMoves[i-1]);
  const volSMA      = sma(volumes, gammaLen);
  const volRatios   = volumes.map((v, i) => isNaN(volSMA[i]) || volSMA[i] === 0 ? 1 : v / volSMA[i]);
  const rawGamma    = priceAccels.map((a, i) => a * volRatios[i]);
  const gammaSmoArr = sma(rawGamma, smoothLen);
  const gammaStdArr = stdev(rawGamma, gammaLen);
  const gammaFlows  = rawGamma.map((_, i) =>
    isNaN(gammaStdArr[i]) || gammaStdArr[i] === 0 ? 0 : gammaSmoArr[i] / gammaStdArr[i]
  );

  // ── Regime detection ───────────────────────────────────────────────────────
  const returns     = closes.map((c, i) => i === 0 ? 0 : c / closes[i-1] - 1);
  const returnsPrev = [0, ...returns.slice(0, -1)];
  const autocorrs   = returns.map((_, i) => {
    if (i < gammaLen - 1) return 0;
    const a = returns.slice(i - gammaLen + 1, i + 1);
    const b = returnsPrev.slice(i - gammaLen + 1, i + 1);
    const ma = a.reduce((s,v) => s+v, 0) / gammaLen;
    const mb = b.reduce((s,v) => s+v, 0) / gammaLen;
    let cov=0, va=0, vb=0;
    for (let j=0; j<gammaLen; j++) { cov+=(a[j]-ma)*(b[j]-mb); va+=(a[j]-ma)**2; vb+=(b[j]-mb)**2; }
    return Math.sqrt(va*vb) === 0 ? 0 : cov / Math.sqrt(va*vb);
  });
  const meanRevScores = autocorrs.map(a => -a);

  const halfLen = Math.round(gammaLen / 2);
  const rvFast  = stdev(returns, halfLen).map(v => isNaN(v) ? NaN : v * Math.sqrt(252) * 100);
  const rvSlow  = stdev(returns, gammaLen).map(v => isNaN(v) ? NaN : v * Math.sqrt(252) * 100);
  const volTrends = rvFast.map((f, i) => isNaN(f) || isNaN(rvSlow[i]) || rvSlow[i] === 0 ? 0 : (f - rvSlow[i]) / rvSlow[i]);

  const regimeRaws = meanRevScores.map((mr, i) => (mr + (volTrends[i] > 0 ? 0.5 : -0.5)) / 2);
  const regimeClamped = regimeRaws.map(r => clamp(r * 2, -1, 1));
  const regimeArr = ema(regimeClamped, smoothLen);

  // ── Trend filter (EMA 9/21/50) ─────────────────────────────────────────────
  const atrArr    = atr(bars, gammaLen);
  const ema9arr   = ema(closes, 9);
  const ema21arr  = ema(closes, 21);
  const ema50arr  = ema(closes, 50);

  // ── Swing highs/lows for structure ─────────────────────────────────────────
  const swingHiArr    = highest(highs, gammaLen);
  const swingLoArr    = lowest(lows, gammaLen);
  const prevSwingHiArr = highest(highs.map((_, i) => i < gammaLen ? NaN : highs[i - gammaLen] ?? NaN), gammaLen);
  const prevSwingLoArr = lowest(lows.map((_, i) => i < gammaLen ? NaN : lows[i - gammaLen] ?? NaN), gammaLen);

  // ── Result array ───────────────────────────────────────────────────────────
  const results: GammaBar[] = [];
  const confThreshold = 55.0 * sensitivity; // default 82.5

  // Track previous signal for crossover detection
  let prevPredDir = 0, prevConf = 0;

  for (let i = Math.max(gammaLen + smoothLen, 50); i < n; i++) {
    const c  = bars[i];
    const regime = isNaN(regimeArr[i]) ? 0 : regimeArr[i];
    const isCalm = regime > 0;
    const isWild = !isCalm;

    const emaF  = ema9arr[i]  ?? closes[i];
    const emaS  = ema21arr[i] ?? closes[i];
    const emaT  = ema50arr[i] ?? closes[i];
    const atrV  = atrArr[i]   ?? 1;

    // Trend slope
    const trendSlope = atrV !== 0 ? (emaT - (ema50arr[i-5] ?? emaT)) / atrV : 0;
    const isTrendUp  = trendSlope > 0.1 && c.close > emaT;
    const isTrendDn  = trendSlope < -0.1 && c.close < emaT;
    const trendStr   = Math.abs(trendSlope);

    const bullStack  = emaF > emaS && emaS > emaT;
    const bearStack  = emaF < emaS && emaS < emaT;

    const swingHi    = swingHiArr[i] ?? c.high;
    const swingLo    = swingLoArr[i] ?? c.low;
    const prevSH     = prevSwingHiArr[i] ?? swingHi;
    const prevSL     = prevSwingLoArr[i] ?? swingLo;
    const structBull = swingHi > prevSH && swingLo > prevSL;
    const structBear = swingLo < prevSL && swingHi < prevSH;

    // Range position (0-1)
    const rangeHi  = Math.max(...highs.slice(Math.max(0, i-gammaLen+1), i+1));
    const rangeLo  = Math.min(...lows.slice(Math.max(0, i-gammaLen+1), i+1));
    const rangePos = rangeHi !== rangeLo ? (c.close - rangeLo) / (rangeHi - rangeLo) : 0.5;

    // Magnet detection
    const p = c.close;
    const mag = p > 1000 ? Math.round(p/50)*50 : p > 500 ? Math.round(p/25)*25 : p > 100 ? Math.round(p/10)*10 : p > 50 ? Math.round(p/5)*5 : Math.round(p/1)*1;
    const distToMag = Math.abs(c.close - mag) / c.close * 100;
    const magnetZW  = 0.5;
    const pinRaw    = distToMag < magnetZW ? 1 - distToMag / magnetZW : 0;
    const rangeCompress = (atr(bars.slice(Math.max(0,i-4), i+1), 5)[4] ?? atrV) / atrV;
    const isPinning = pinRaw > 0.3 && rangeCompress < 0.8 && isCalm;

    // Squeeze: wild + acceleration + volume surge + big move
    const priceMove  = priceMoves[i] ?? 0;
    const accelV     = priceAccels[i] ?? 0;
    const accelEMA   = ema(priceAccels.slice(Math.max(0,i-smoothLen), i+1), smoothLen);
    const accelSm    = accelEMA[accelEMA.length-1] ?? 0;
    const volRatio   = volRatios[i] ?? 1;
    const volSurge   = volRatio > 1.5;
    const recentMoves = priceMoves.slice(Math.max(0,i-2), i+1);
    const movEMA     = recentMoves.reduce((s,v)=>s+v,0)/recentMoves.length;
    const bigMove    = Math.abs(movEMA) > atrV * 0.5;
    const squeezeBull = isWild && accelSm > 0 && volSurge && bigMove && priceMove > 0;
    const squeezeBear = isWild && accelSm < 0 && volSurge && bigMove && priceMove < 0;
    const isSqueeze  = squeezeBull || squeezeBear;

    // False breakout detection
    const consHi  = Math.max(...highs.slice(Math.max(0,i-gammaLen-4), i-4));
    const consLo  = Math.min(...lows.slice(Math.max(0,i-gammaLen-4), i-4));
    const consRange = consHi - consLo;
    const rangeATR2 = atrV * 2.5; // simplified: gammaLen*2 ATR proxy
    const wasConsolidating = consRange < rangeATR2;
    const breakMargin = atrV * 0.15;
    const brokeAbove  = [1,2,3].some(k => (highs[i-k] ?? 0) > consHi + breakMargin);
    const brokeBelow  = [1,2,3].some(k => (lows[i-k] ?? 999999) < consLo - breakMargin);
    const bSize = Math.abs(c.close - c.open);
    const fRange = c.high - c.low || 1;
    const uWick  = c.high - Math.max(c.close, c.open);
    const lWick  = Math.min(c.close, c.open) - c.low;
    const bullWick = lWick > bSize*1.5 && lWick > fRange*0.4 && c.close > c.open;
    const bearWick = uWick > bSize*1.5 && uWick > fRange*0.4 && c.close < c.open;
    const volConf  = volRatio > 0.8;
    const rejAbove = brokeAbove && c.close < consHi && c.close < c.open;
    const rejBelow = brokeBelow && c.close > consLo && c.close > c.open;
    const fbBull   = wasConsolidating && rejBelow && volConf && !isTrendDn && (bullWick || c.close > consLo + consRange*0.3);
    const fbBear   = wasConsolidating && rejAbove && volConf && !isTrendUp && (bearWick || c.close < consHi - consRange*0.3);

    // Algo flow
    const absorp   = volRatio > 1.8 && bSize < atrV * 0.3;
    const vol3     = volumes.slice(Math.max(0,i-2),i+1).reduce((s,v)=>s+v,0)/3;
    const vol10    = volumes.slice(Math.max(0,i-9),i+1).reduce((s,v)=>s+v,0)/10;
    const volSpike = vol3 > vol10 * 1.5;
    const buyPres  = c.close - c.low, sellPres = c.high - c.close;
    const delta    = buyPres - sellPres;
    const prevDeltas = bars.slice(Math.max(0,i-smoothLen),i+1).map(b => (b.close-b.low)-(b.high-b.close));
    const deltaSmooth = prevDeltas.reduce((s,v)=>s+v,0)/prevDeltas.length;
    const dBull    = deltaSmooth > atrV * 0.3, dBear = deltaSmooth < -atrV * 0.3;
    const algoBuy  = volSpike && dBull && (absorp || c.close > c.open);
    const algoSell = volSpike && dBear && (absorp || c.close < c.open);

    // Momentum
    const recentEMA = ema(priceMoves.slice(Math.max(0,i-smoothLen),i+1), smoothLen);
    const momSmooth = recentEMA[recentEMA.length-1] ?? 0;
    const momentumUp = momSmooth > 0, momentumDn = momSmooth < 0;
    const momentumStr = Math.abs(momSmooth) / atrV;
    const volConviction = Math.min(2.0, volRatio);

    // ── Prediction engine (exact port from Pine priority chain) ────────────
    let predictDir = 0, confidence = 0, tradeType = "WAIT", signalType: any = "";

    if (fbBull && !isTrendDn) {
      predictDir = 1; tradeType = "BUY"; signalType = "TRAP";
      confidence = Math.min(85, 55 + volConviction*10 + (bullWick?15:0));
    } else if (fbBear && !isTrendUp) {
      predictDir = -1; tradeType = "SELL"; signalType = "TRAP";
      confidence = Math.min(85, 55 + volConviction*10 + (bearWick?15:0));
    } else if (algoBuy && !isTrendDn) {
      predictDir = 1; tradeType = "BUY"; signalType = "ALGO";
      confidence = Math.min(88, 55 + volConviction*12);
    } else if (algoSell && !isTrendUp) {
      predictDir = -1; tradeType = "SELL"; signalType = "ALGO";
      confidence = Math.min(88, 55 + volConviction*12);
    } else if (isSqueeze) {
      predictDir = squeezeBull ? 1 : -1; signalType = "SQUEEZE";
      tradeType  = squeezeBull ? "BUY BREAKOUT" : "SELL BREAKOUT";
      confidence = Math.min(95, 60 + momentumStr*15 + volConviction*10);
    } else if (isPinning) {
      predictDir = 0; tradeType = "WAIT";
      confidence = Math.min(80, 40 + pinRaw*30);
    } else if (isCalm) {
      if (rangePos > 0.8 && !isTrendUp && !structBull) {
        predictDir = -1; tradeType = "SELL";
        confidence = Math.min(80, 35 + (rangePos-0.5)*50 + Math.abs(regime)*15);
      } else if (rangePos < 0.2 && !isTrendDn && !structBear) {
        predictDir = 1; tradeType = "BUY";
        confidence = Math.min(80, 35 + (0.5-rangePos)*50 + Math.abs(regime)*15);
      } else if (rangePos < 0.2 && isTrendDn) {
        predictDir = -1; tradeType = "SELL";
        confidence = Math.min(70, 35 + trendStr*20);
      } else if (rangePos > 0.8 && isTrendUp) {
        predictDir = 1; tradeType = "WAIT"; confidence = Math.min(60, 30 + trendStr*15);
      } else { predictDir = 0; confidence = 20; tradeType = "WAIT"; }
    } else { // isWild
      if (momentumUp && volConviction > 1.0 && (isTrendUp || !isTrendDn) && !structBear) {
        predictDir = 1; tradeType = "BUY";
        confidence = Math.min(88, 40 + momentumStr*20 + volConviction*10 + (bullStack?10:0));
      } else if (momentumDn && volConviction > 1.0 && (isTrendDn || !isTrendUp) && !structBull) {
        predictDir = -1; tradeType = "SELL";
        confidence = Math.min(88, 40 + momentumStr*20 + volConviction*10 + (bearStack?10:0));
      } else { predictDir = 0; confidence = 20; tradeType = "WAIT"; }
    }

    // Confidence adjustments
    if (predictDir > 0 && bullStack)   confidence = Math.min(95, confidence + 8);
    if (predictDir < 0 && bearStack)   confidence = Math.min(95, confidence + 8);
    if (predictDir > 0 && isTrendDn)   confidence = Math.max(0, confidence - 25);
    if (predictDir < 0 && isTrendUp)   confidence = Math.max(0, confidence - 25);
    if (predictDir > 0 && algoBuy)     confidence = Math.min(95, confidence + 10);
    if (predictDir < 0 && algoSell)    confidence = Math.min(95, confidence + 10);

    // Signal: fires on direction change OR new confidence threshold cross
    const wasSignal = prevPredDir !== 0 && prevConf > confThreshold;
    const isSignal  = predictDir !== 0 && confidence > confThreshold;
    const crossover = (prevPredDir <= 0 || prevConf <= confThreshold) && isSignal && predictDir > 0;
    const crossunder = (prevPredDir >= 0 || prevConf <= confThreshold) && isSignal && predictDir < 0;
    const signal = crossover ? "BUY" : crossunder ? "SELL" : undefined;

    const isSq: GammaRegime = isSqueeze ? "SQUEEZE" : isPinning ? "PINNED" : isCalm ? "CALM" : "WILD";

    results.push({
      time: c.time, gammaFlow: gammaFlows[i] ?? 0,
      regime: isSq, isCalm, isWild, isSqueeze, isPinning,
      confidence: Math.round(confidence), predictDir, tradeType, signal, signalType,
      rangePos,
    });

    prevPredDir = predictDir; prevConf = confidence;
  }

  return results;
}
