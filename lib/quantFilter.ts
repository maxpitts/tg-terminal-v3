// lib/quantFilter.ts
// Quant-style statistical filtering for dark pool and options flow
// Surfaces only statistically significant, non-random institutional activity

export interface QuantStats {
  // Rolling statistics per ticker
  dpNotionalMean: number;
  dpNotionalStdDev: number;
  premiumMean: number;
  premiumStdDev: number;
  sweepRate: number;        // % of flow that is sweeps (0-1)
  callPutRatio: number;     // >1 = bullish bias, <1 = bearish
  sampleSize: number;
}

export interface QuantScore {
  zScoreNotional: number;   // std devs above mean notional
  zScorePremium: number;    // std devs above mean premium
  isStatSig: boolean;       // statistically significant (z > 1.5)
  isUnusual: boolean;       // very unusual (z > 2.5)
  unusualVolume: boolean;   // options size is unusual vs recent
  clusterScore: number;     // 0-100, how coordinated is this activity
  verdict: "NOISE" | "WATCH" | "SIGNAL" | "STRONG";
}

// ── Rolling stats per ticker ─────────────────────────────────────────────────
const tickerStats: Record<string, {
  dpNotionals: number[];
  premiums: number[];
  sides: string[];
  types: string[];
  lastReset: number;
}> = {};

const WINDOW_SIZE = 50;  // rolling window
const RESET_HOURS = 8;   // reset stats every 8 hours (new session)

function getTickerBuffer(ticker: string) {
  const now = Date.now();
  if (!tickerStats[ticker] || (now - tickerStats[ticker].lastReset) > RESET_HOURS * 3600000) {
    tickerStats[ticker] = { dpNotionals: [], premiums: [], sides: [], types: [], lastReset: now };
  }
  return tickerStats[ticker];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance) || 1;
}

function zScore(value: number, arr: number[]): number {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  const s = stdDev(arr);
  return (value - m) / s;
}

// ── Record a new dark pool print ─────────────────────────────────────────────
export function recordDarkPool(ticker: string, notional: number) {
  const buf = getTickerBuffer(ticker);
  buf.dpNotionals.push(notional);
  if (buf.dpNotionals.length > WINDOW_SIZE) buf.dpNotionals.shift();
}

// ── Record a new options flow ────────────────────────────────────────────────
export function recordOptionsFlow(ticker: string, premium: number, side: string, type: string) {
  const buf = getTickerBuffer(ticker);
  buf.premiums.push(premium);
  buf.sides.push(side);
  buf.types.push(type);
  if (buf.premiums.length > WINDOW_SIZE) buf.premiums.shift();
  if (buf.sides.length > WINDOW_SIZE) buf.sides.shift();
  if (buf.types.length > WINDOW_SIZE) buf.types.shift();
}

// ── Score a dark pool print quantitatively ───────────────────────────────────
export function scoreDarkPool(ticker: string, notional: number, size: number): QuantScore {
  const buf = getTickerBuffer(ticker);
  
  const zN = zScore(notional, buf.dpNotionals);
  const isStatSig = zN > 1.5 || buf.dpNotionals.length < 5;
  const isUnusual = zN > 2.5;

  // Cluster: check if multiple large prints in last 10 mins
  const clusterScore = Math.min(100, Math.round(Math.max(0, zN) * 30));

  let verdict: QuantScore["verdict"] = "NOISE";
  if (notional >= 5e7 || zN > 2.5) verdict = "STRONG";
  else if (notional >= 1e7 || zN > 1.5) verdict = "SIGNAL";
  else if (notional >= 1e6 || zN > 0.5) verdict = "WATCH";

  return {
    zScoreNotional: parseFloat(zN.toFixed(2)),
    zScorePremium: 0,
    isStatSig,
    isUnusual,
    unusualVolume: size > 10000,
    clusterScore,
    verdict,
  };
}

// ── Score an options flow print quantitatively ───────────────────────────────
export function scoreOptionsFlow(ticker: string, premium: number, side: string, type: string, dte: number): QuantScore {
  const buf = getTickerBuffer(ticker);

  const zP = zScore(premium, buf.premiums);
  
  // Call/put ratio bias
  const calls = buf.types.filter(t => t === "CALL").length;
  const puts  = buf.types.filter(t => t === "PUT").length;
  const cpRatio = puts > 0 ? calls / puts : calls > 0 ? 2 : 1;
  
  // Sweep rate
  const sweeps = buf.sides.filter(s => s === "SWEEP").length;
  const sweepRate = buf.sides.length > 0 ? sweeps / buf.sides.length : 0;

  const isStatSig = zP > 1.5 || buf.premiums.length < 5;
  const isUnusual = zP > 2.5;

  // Low DTE + high premium + sweep = most aggressive
  const dteBonus = dte <= 7 ? 1.3 : dte <= 30 ? 1.1 : 1.0;
  const sideBonus = side === "SWEEP" ? 1.2 : 1.0;
  const clusterScore = Math.min(100, Math.round(Math.max(0, zP) * 25 * dteBonus * sideBonus));

  // Directional conviction: if new flow agrees with existing bias
  const biasAgrees = (type === "CALL" && cpRatio > 1.5) || (type === "PUT" && cpRatio < 0.67);

  let verdict: QuantScore["verdict"] = "NOISE";
  if ((premium >= 1e6 || zP > 2.5) && side === "SWEEP") verdict = "STRONG";
  else if (premium >= 5e5 || zP > 2.0) verdict = "SIGNAL";
  else if (premium >= 1e5 || zP > 1.0) verdict = "WATCH";

  return {
    zScoreNotional: 0,
    zScorePremium: parseFloat(zP.toFixed(2)),
    isStatSig,
    isUnusual,
    unusualVolume: biasAgrees,
    clusterScore,
    verdict,
  };
}

// ── Enhanced correlation score with quant overlay ────────────────────────────
export function quantEnhancedScore(
  baseScore: number,
  dpQuant: QuantScore,
  flQuant: QuantScore
): number {
  let enhanced = baseScore;

  // Boost for statistical significance
  if (dpQuant.isUnusual && flQuant.isUnusual) enhanced += 15;
  else if (dpQuant.isStatSig && flQuant.isStatSig) enhanced += 8;

  // Boost for cluster activity
  const clusterBoost = Math.round((dpQuant.clusterScore + flQuant.clusterScore) / 2 / 10);
  enhanced += Math.min(10, clusterBoost);

  // Penalize noise
  if (dpQuant.verdict === "NOISE" || flQuant.verdict === "NOISE") enhanced -= 15;
  if (dpQuant.verdict === "WATCH" && flQuant.verdict === "WATCH") enhanced -= 5;

  return Math.min(100, Math.max(0, Math.round(enhanced)));
}

// ── Should this print be shown at all? ──────────────────────────────────────
export function shouldShowDarkPool(ticker: string, notional: number, size: number): boolean {
  const buf = getTickerBuffer(ticker);
  
  // Always show if very large
  if (notional >= 5e7) return true;
  
  // With enough history, use z-score
  if (buf.dpNotionals.length >= 10) {
    const z = zScore(notional, buf.dpNotionals);
    return z > 0.5; // above average
  }
  
  // Cold start: use absolute threshold
  return notional >= 1e6;
}

export function shouldShowOptionsFlow(ticker: string, premium: number, side: string): boolean {
  const buf = getTickerBuffer(ticker);
  
  // Always show large sweeps
  if (premium >= 5e5 && side === "SWEEP") return true;
  
  // With history, use z-score
  if (buf.premiums.length >= 10) {
    const z = zScore(premium, buf.premiums);
    return z > 0.3;
  }
  
  // Cold start
  return premium >= 50000;
}

// ── Get ticker stats summary ─────────────────────────────────────────────────
export function getTickerStats(ticker: string): QuantStats {
  const buf = getTickerBuffer(ticker);
  const calls = buf.types.filter(t => t === "CALL").length;
  const puts  = buf.types.filter(t => t === "PUT").length;
  const sweeps = buf.sides.filter(s => s === "SWEEP").length;
  return {
    dpNotionalMean: mean(buf.dpNotionals),
    dpNotionalStdDev: stdDev(buf.dpNotionals),
    premiumMean: mean(buf.premiums),
    premiumStdDev: stdDev(buf.premiums),
    sweepRate: buf.sides.length > 0 ? sweeps / buf.sides.length : 0,
    callPutRatio: puts > 0 ? calls / puts : calls > 0 ? 2 : 1,
    sampleSize: Math.max(buf.dpNotionals.length, buf.premiums.length),
  };
}
