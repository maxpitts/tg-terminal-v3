// lib/indicators/reversal.ts
// Reversal Engine — exhaustion candle + swing structure break detection

import type { OHLCV } from "./vwap";

export interface ReversalSignal {
  time:    number;
  type:    "BULL_REVERSAL" | "BEAR_REVERSAL";
  trigger: "EXHAUSTION" | "STRUCTURE_BREAK" | "VWAP_RECLAIM";
  value:   number;
  conf:    number;
}

export function calcReversal(candles: OHLCV[], vwap: { time: number; value: number }[]): ReversalSignal[] {
  if (candles.length < 15) return [];
  const signals: ReversalSignal[] = [];
  const vwapMap = new Map(vwap.map(v => [v.time, v.value]));

  for (let i = 10; i < candles.length; i++) {
    const c     = candles[i];
    const prev  = candles[i - 1];
    const slice = candles.slice(i - 10, i);
    const vw    = vwapMap.get(c.time) || 0;

    // Exhaustion candle: large body, closes near extreme
    const range  = c.high - c.low || 0.001;
    const body   = Math.abs(c.close - c.open);
    const upper  = c.high - Math.max(c.open, c.close);
    const lower  = Math.min(c.open, c.close) - c.low;
    const isBigCandle = body / range > 0.7;
    const isLongUpper = upper > body * 0.8;
    const isLongLower = lower > body * 0.8;

    // Swing structure: recent high/low
    const recentHighs = slice.map(x => x.high);
    const recentLows  = slice.map(x => x.low);
    const swingHigh   = Math.max(...recentHighs);
    const swingLow    = Math.min(...recentLows);

    // VWAP reclaim
    const prevVW = vwapMap.get(prev.time) || 0;
    const vwapReclaim      = prevVW > 0 && prev.close < prevVW && c.close > vw && vw > 0;
    const vwapBreakdown    = prevVW > 0 && prev.close > prevVW && c.close < vw && vw > 0;

    // Volume confirmation
    const volAvg   = slice.reduce((s,x) => s+(x.volume||0),0) / slice.length;
    const volConf  = (c.volume||0) > volAvg * 1.1;

    // Bull reversal signals
    if (isBigCandle && isLongLower && c.close > c.open && volConf) {
      signals.push({ time: c.time, type: "BULL_REVERSAL", trigger: "EXHAUSTION", value: c.low, conf: Math.round(70 + (lower/range)*25) });
    } else if (c.low < swingLow && c.close > swingLow && volConf) {
      signals.push({ time: c.time, type: "BULL_REVERSAL", trigger: "STRUCTURE_BREAK", value: c.low, conf: 75 });
    } else if (vwapReclaim && volConf) {
      signals.push({ time: c.time, type: "BULL_REVERSAL", trigger: "VWAP_RECLAIM", value: c.close, conf: 68 });
    }

    // Bear reversal signals
    if (isBigCandle && isLongUpper && c.close < c.open && volConf) {
      signals.push({ time: c.time, type: "BEAR_REVERSAL", trigger: "EXHAUSTION", value: c.high, conf: Math.round(70 + (upper/range)*25) });
    } else if (c.high > swingHigh && c.close < swingHigh && volConf) {
      signals.push({ time: c.time, type: "BEAR_REVERSAL", trigger: "STRUCTURE_BREAK", value: c.high, conf: 75 });
    } else if (vwapBreakdown && volConf) {
      signals.push({ time: c.time, type: "BEAR_REVERSAL", trigger: "VWAP_RECLAIM", value: c.close, conf: 68 });
    }
  }

  return signals;
}
