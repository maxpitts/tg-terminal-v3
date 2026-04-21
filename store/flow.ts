"use client";
import { create } from "zustand";

export interface DarkPoolPrint {
  id: string;
  ticker: string;
  size: number;
  price: number;
  notional: number;
  side: "BUY" | "SELL";
  venue: string;
  time: string;
  timestamp: number;
}

export interface OptionsFlow {
  id: string;
  ticker: string;
  type: "CALL" | "PUT";
  strike: string;
  expiry: string;
  premium: number;
  side: "SWEEP" | "BLOCK";
  dte: number;
  time: string;
  timestamp: number;
}

export interface GammaSignal {
  id: string;
  ticker: string;
  signal: string;
  conf: number;
  confidence?: number;
  regime: "BULL" | "BEAR" | "NEUTRAL";
  time: string;
  timestamp: number;
  // Auto-generated fields
  source?: "HMM_FLIP" | "GAMMA_SPIKE" | "SWEEP_CLUSTER" | "TRADINGVIEW";
  prevRegime?: "BULL" | "BEAR" | "NEUTRAL";
  dpNotional?: number;
  premium?: number;
  // Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  iv?: number;
  strike?: string;
  expiry?: string;
}

export interface HMMSignal {
  tickerState: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  tickerConf: number;
  marketState: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  marketConf: number;
  stateChanged: boolean;
}

export interface CorrelatedSignal {
  id: string;
  ticker: string;
  dp: DarkPoolPrint;
  fl: OptionsFlow;
  score: number;
  hot: boolean;
  delta: number;
  time: string;
  timestamp: number;
  hmm?: HMMSignal;
}

interface FlowState {
  correlations: CorrelatedSignal[];
  darkPool: DarkPoolPrint[];
  options: OptionsFlow[];
  gamma: GammaSignal[];
  addCorrelation: (s: CorrelatedSignal) => void;
  addDarkPool: (p: DarkPoolPrint) => void;
  addOptions: (f: OptionsFlow) => void;
  addGamma: (g: GammaSignal) => void;
  hydrateDarkPool: (prints: DarkPoolPrint[]) => void;
  hydrateOptions: (flows: OptionsFlow[]) => void;
  hydrateCorrelations: (sigs: any[]) => void;
  clearAll: () => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  correlations: [],
  darkPool: [],
  options: [],
  gamma: [],
  addCorrelation: (s) =>
    set((st) => ({ correlations: [s, ...st.correlations].slice(0, 200) })),
  addDarkPool: (p) => {
    if (p.notional < 500000) return; // $500K+ only
    set((st) => ({ darkPool: [p, ...st.darkPool].slice(0, 200) }));
  },
  addOptions: (f) =>
    set((st) => {
      // Deduplicate — keep most recent per ticker+strike+expiry+type
      const key = `${f.ticker}-${f.strike}-${f.expiry}-${f.type}`;
      const filtered = st.options.filter(o => 
        `${o.ticker}-${o.strike}-${o.expiry}-${o.type}` !== key
      );
      return { options: [f, ...filtered].slice(0, 200) };
    }),
  // Hydration from persistence
  hydrateDarkPool: (prints: DarkPoolPrint[]) =>
    set((st) => {
      const seen = new Set(st.darkPool.map(d => d.id));
      const fresh = prints.filter(p => !seen.has(p.id));
      return { darkPool: [...st.darkPool, ...fresh].sort((a,b) => b.timestamp - a.timestamp).slice(0, 500) };
    }),

  hydrateOptions: (flows: OptionsFlow[]) =>
    set((st) => {
      const seen = new Set(st.options.map(o => o.id));
      const fresh = flows.filter(f => !seen.has(f.id));
      return { options: [...st.options, ...fresh].sort((a,b) => b.timestamp - a.timestamp).slice(0, 500) };
    }),

  hydrateCorrelations: (sigs: any[]) =>
    set((st) => {
      const seen = new Set(st.correlations.map(c => c.id));
      const fresh = sigs.filter(s => !seen.has(s.id));
      return { correlations: [...st.correlations, ...fresh].sort((a,b) => b.timestamp - a.timestamp).slice(0, 500) };
    }),

  addGamma: (g) =>
    set((st) => ({ gamma: [g, ...st.gamma].slice(0, 50) })),
  clearAll: () => set({ correlations: [], darkPool: [], options: [], gamma: [] }),
}));

export function scoreCorrelation(dp: DarkPoolPrint, fl: OptionsFlow): number {
  let score = 0;

  // Dark pool notional size (25 pts max)
  if (dp.notional >= 1e8) score += 25;
  else if (dp.notional >= 5e7) score += 20;
  else if (dp.notional >= 1e7) score += 12;
  else if (dp.notional >= 1e6) score += 6;
  else if (dp.notional >= 5e5) score += 2;

  // Options side (20 pts max)
  if (fl.side === "SWEEP") score += 20;
  else score += 8;

  // Time delta — use wall-clock delta since both use Date.now() with 15min delay
  // Both signals arrive with ~15min delay so we compare receipt time
  const deltaMins = Math.abs(fl.timestamp - dp.timestamp) / 60000;
  if (deltaMins <= 5) score += 20;
  else if (deltaMins <= 15) score += 15;
  else if (deltaMins <= 30) score += 8;
  else if (deltaMins <= 60) score += 3;

  // Options premium size (20 pts max)
  if (fl.premium >= 5e6) score += 20;
  else if (fl.premium >= 1e6) score += 15;
  else if (fl.premium >= 5e5) score += 10;
  else if (fl.premium >= 1e5) score += 5;
  else if (fl.premium >= 25000) score += 2;

  // Directional alignment (15 pts max)
  if ((dp.side === "BUY" && fl.type === "CALL") || (dp.side === "SELL" && fl.type === "PUT")) score += 15;
  else if ((dp.side === "BUY" && fl.type === "PUT") || (dp.side === "SELL" && fl.type === "CALL")) score -= 5;

  // DTE bonus — near-term options are more aggressive (5 pts max)
  if (fl.dte <= 7) score += 5;
  else if (fl.dte <= 30) score += 2;
  return Math.min(100, Math.round(score));
}

// ── HOT Signal History (persisted to localStorage) ───────────────────────
export interface HotSignalRecord {
  id: string;
  ticker: string;
  score: number;
  type: "CALL" | "PUT";
  side: "SWEEP" | "BLOCK";
  strike: string;
  premium: number;
  dpNotional: number;
  dpSide: "BUY" | "SELL";
  delta: number;
  time: string;
  date: string;
}

const HISTORY_KEY = "tg_hot_history";
const MAX_HISTORY = 500;

export function saveHotSignal(signal: HotSignalRecord) {
  try {
    const existing: HotSignalRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const updated = [signal, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export function loadHotHistory(): HotSignalRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

export function clearHotHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
