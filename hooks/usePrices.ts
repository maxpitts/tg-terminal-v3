// hooks/usePrices.ts
// Polls snapshot API every 15s and feeds the central price store
// All components read from usePriceStore — one source of truth

"use client";
import { useEffect, useRef } from "react";
import { usePriceStore, TRACKED_TICKERS } from "@/store/prices";
import type { PriceData } from "@/store/prices";

const POLL_MS = 15000; // 15s — fast enough to track intraday moves

export function usePrices(extraTickers: string[] = []) {
  const { setPrices } = usePriceStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = async (tickers: string[]) => {
    if (tickers.length === 0) return;
    try {
      const unique = [...new Set(tickers)].join(",");
      const res    = await fetch(`/api/polygon/snapshot?tickers=${unique}`);
      const data   = await res.json();

      const map: Record<string, PriceData> = {};
      for (const t of (data.tickers || [])) {
        map[t.ticker] = t as PriceData;
      }
      if (Object.keys(map).length > 0) setPrices(map);
    } catch {}
  };

  useEffect(() => {
    const all = [...new Set([...TRACKED_TICKERS, ...extraTickers])];
    fetchPrices(all);
    timerRef.current = setInterval(() => fetchPrices(all), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [extraTickers.join(",")]);
}

// Helper hook for a single ticker price
export function useTickerPrice(ticker: string) {
  const data = usePriceStore(st => st.prices[ticker]);
  return data || null;
}

// Format helpers
export function fmtPrice(p: number): string {
  return p >= 1000 ? `$${p.toFixed(0)}` : `$${p.toFixed(2)}`;
}

export function fmtChange(chg: number, pct: number): string {
  const sign = chg >= 0 ? "+" : "";
  return `${sign}$${Math.abs(chg).toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
}
