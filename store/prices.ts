// store/prices.ts
// Single source of truth for all stock prices across the terminal
// Uses Polygon v2/snapshot for real-time last price (not day close)

import { create } from "zustand";

export interface PriceData {
  ticker:    string;
  price:     number;   // last trade price — most accurate
  open:      number;
  high:      number;
  low:       number;
  prevClose: number;
  change:    number;   // $ change from prevClose
  changePct: number;   // % change
  volume:    number;
  vwap:      number;
  updated:   number;   // timestamp
}

interface PriceStore {
  prices: Record<string, PriceData>;
  loading: boolean;
  lastFetch: number;
  setPrice: (ticker: string, data: PriceData) => void;
  setPrices: (data: Record<string, PriceData>) => void;
  getPrice: (ticker: string) => PriceData | null;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices:    {},
  loading:   false,
  lastFetch: 0,

  setPrice: (ticker, data) =>
    set(st => ({ prices: { ...st.prices, [ticker]: data } })),

  setPrices: (data) =>
    set(st => ({ prices: { ...st.prices, ...data }, lastFetch: Date.now() })),

  getPrice: (ticker) => get().prices[ticker] || null,
}));

// Tracked tickers across the whole terminal
export const TRACKED_TICKERS = [
  "NVDA","AAPL","TSLA","SPY","QQQ","MSFT","META","AMD",
  "AMZN","GOOGL","PLTR","COIN","MSTR","MARA","HOOD",
];
