// lib/indicators/utils.ts — shared math helpers for exact Pine Script ports

export interface Bar {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

// Simple Moving Average
export function sma(vals: number[], period: number): number[] {
  return vals.map((_, i) => {
    if (i < period - 1) return NaN;
    let s = 0; for (let j = i - period + 1; j <= i; j++) s += vals[j];
    return s / period;
  });
}

// EMA — matches Pine ta.ema exactly (RMA seed = first SMA)
export function ema(vals: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(vals.length).fill(NaN);
  let started = false, e = 0;
  for (let i = 0; i < vals.length; i++) {
    if (isNaN(vals[i])) continue;
    if (!started) { e = vals[i]; started = true; result[i] = e; continue; }
    e = vals[i] * k + e * (1 - k);
    result[i] = e;
  }
  return result;
}

// Standard deviation (population, matches Pine ta.stdev)
export function stdev(vals: number[], period: number): number[] {
  const m = sma(vals, period);
  return vals.map((_, i) => {
    if (i < period - 1) return NaN;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += (vals[j] - m[i]) ** 2;
    return Math.sqrt(s / period);
  });
}

// ATR — matches Pine ta.atr(period)
export function atr(bars: Bar[], period: number): number[] {
  const tr = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i-1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
  // Pine ta.atr uses RMA (Wilder smoothing), seed = first SMA
  const k = 1 / period;
  const result: number[] = new Array(bars.length).fill(NaN);
  let rma = 0, started = false;
  for (let i = 0; i < tr.length; i++) {
    if (!started && i >= period - 1) {
      let s = 0; for (let j = i - period + 1; j <= i; j++) s += tr[j];
      rma = s / period; started = true; result[i] = rma; continue;
    }
    if (started) { rma = tr[i] * k + rma * (1 - k); result[i] = rma; }
  }
  return result;
}

// RSI(14) — matches Pine ta.rsi exactly
export function rsi(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    const gain = Math.max(0, diff), loss = Math.max(0, -diff);
    if (i < period) { avgGain += gain / period; avgLoss += loss / period; continue; }
    if (i === period) { avgGain += gain / period; avgLoss += loss / period; }
    else { avgGain = (avgGain * (period-1) + gain) / period; avgLoss = (avgLoss * (period-1) + loss) / period; }
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// MACD — matches Pine ta.macd(close, 12, 26, 9)
export function macd(closes: number[], fast=12, slow=26, signal=9) {
  const eF = ema(closes, fast);
  const eS = ema(closes, slow);
  const hist = closes.map((_, i) => isNaN(eF[i]) || isNaN(eS[i]) ? NaN : eF[i] - eS[i]);
  const sigLine = ema(hist, signal);
  const histogram = hist.map((v, i) => isNaN(v) || isNaN(sigLine[i]) ? NaN : v - sigLine[i]);
  return { macdLine: hist, signalLine: sigLine, histogram };
}

// ROC(10) — matches Pine ta.roc
export function roc(closes: number[], period: number): number[] {
  return closes.map((c, i) => i < period || closes[i-period] === 0 ? NaN : (c - closes[i-period]) / closes[i-period] * 100);
}

// Pearson correlation — matches Pine ta.correlation
export function correlation(a: number[], b: number[], period: number): number[] {
  return a.map((_, i) => {
    if (i < period - 1) return NaN;
    const sa = a.slice(i-period+1, i+1);
    const sb = b.slice(i-period+1, i+1);
    const ma = sa.reduce((s,v) => s+v, 0) / period;
    const mb = sb.reduce((s,v) => s+v, 0) / period;
    let cov = 0, va = 0, vb = 0;
    for (let j = 0; j < period; j++) {
      cov += (sa[j]-ma)*(sb[j]-mb);
      va  += (sa[j]-ma)**2;
      vb  += (sb[j]-mb)**2;
    }
    const denom = Math.sqrt(va*vb);
    return denom === 0 ? 0 : cov / denom;
  });
}

// Highest / Lowest over period
export function highest(vals: number[], period: number): number[] {
  return vals.map((_, i) => i < period-1 ? NaN : Math.max(...vals.slice(i-period+1, i+1)));
}
export function lowest(vals: number[], period: number): number[] {
  return vals.map((_, i) => i < period-1 ? NaN : Math.min(...vals.slice(i-period+1, i+1)));
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
