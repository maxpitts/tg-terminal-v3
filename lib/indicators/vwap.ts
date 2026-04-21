export interface OHLCV { time: number; open: number; high: number; low: number; close: number; volume: number; vol?: number; }

// VWAP resets each trading session (day) at 9:30am ET
// time is in UTC seconds — ET = UTC-4 (EDT) or UTC-5 (EST)
export function calcVWAP(candles: OHLCV[]): { time: number; value: number }[] {
  let cumPV = 0, cumV = 0;
  let lastDay = -1;

  return candles.map(c => {
    // Convert UTC seconds to ET date (approximate — EDT is UTC-4)
    const etOffset = 4 * 3600; // use EDT (UTC-4) — close enough year-round
    const etTime   = c.time - etOffset;
    const dayOfYear = Math.floor(etTime / 86400); // unique day identifier

    // Reset at start of each new trading day
    if (dayOfYear !== lastDay) {
      cumPV   = 0;
      cumV    = 0;
      lastDay = dayOfYear;
    }

    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * (c.volume || 0);
    cumV  += (c.volume || 0);

    return {
      time:  c.time,
      value: cumV > 0 ? parseFloat((cumPV / cumV).toFixed(4)) : c.close,
    };
  });
}

export function calcEMA(candles: OHLCV[], period: number): { time: number; value: number }[] {
  const k = 2 / (period + 1);
  let ema = candles[0]?.close || 0;
  return candles.map((c, i) => {
    if (i === 0) { ema = c.close; return { time: c.time, value: ema }; }
    ema = c.close * k + ema * (1 - k);
    return { time: c.time, value: parseFloat(ema.toFixed(4)) };
  });
}

export function calcSMA(candles: OHLCV[], period: number): { time: number; value: number }[] {
  return candles.map((c, i) => {
    if (i < period - 1) return { time: c.time, value: NaN };
    const slice = candles.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / period;
    return { time: c.time, value: parseFloat(avg.toFixed(4)) };
  }).filter(p => !isNaN(p.value));
}
