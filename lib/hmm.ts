// lib/hmm.ts
// Hidden Markov Model for institutional flow regime detection
// States: ACCUMULATION | DISTRIBUTION | NEUTRAL
// Observations derived from dark pool + options flow signals

export type HMMState = "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";

export interface HMMObservation {
  dpNotionalTier: 0 | 1 | 2 | 3 | 4;   // 0=none, 1=<$1M, 2=$1-10M, 3=$10-50M, 4=$50M+
  optionType: 0 | 1 | 2;                // 0=none, 1=CALL, 2=PUT
  flowSide: 0 | 1 | 2;                  // 0=none, 1=SWEEP, 2=BLOCK
  premiumTier: 0 | 1 | 2 | 3 | 4;      // 0=none, 1=<$100K, 2=$100-500K, 3=$500K-1M, 4=$1M+
  directional: 0 | 1 | 2;              // 0=neutral, 1=bullish aligned, 2=bearish aligned
}

export interface HMMResult {
  state: HMMState;
  probabilities: Record<HMMState, number>;
  confidence: number;
  stateChanged: boolean;
  prevState: HMMState;
}

// ── Transition matrix P(next_state | current_state) ──────────────────────────
// Rows = current state, Cols = [ACCUM, DIST, NEUTRAL]
const TRANSITIONS: Record<HMMState, Record<HMMState, number>> = {
  ACCUMULATION: { ACCUMULATION: 0.70, DISTRIBUTION: 0.05, NEUTRAL: 0.25 },
  DISTRIBUTION: { ACCUMULATION: 0.05, DISTRIBUTION: 0.70, NEUTRAL: 0.25 },
  NEUTRAL:      { ACCUMULATION: 0.20, DISTRIBUTION: 0.20, NEUTRAL: 0.60 },
};

// ── Emission probabilities P(observation | state) ────────────────────────────
// Simplified: score each observation component given state
function emissionScore(obs: HMMObservation, state: HMMState): number {
  let score = 1.0;

  // DP notional tier
  const dpWeights: Record<HMMState, number[]> = {
    ACCUMULATION: [0.05, 0.10, 0.20, 0.30, 0.35],
    DISTRIBUTION: [0.05, 0.10, 0.20, 0.30, 0.35],
    NEUTRAL:      [0.30, 0.30, 0.20, 0.15, 0.05],
  };
  score *= dpWeights[state][obs.dpNotionalTier];

  // Option type
  const typeWeights: Record<HMMState, number[]> = {
    ACCUMULATION: [0.10, 0.65, 0.25], // prefers CALLs
    DISTRIBUTION: [0.10, 0.25, 0.65], // prefers PUTs
    NEUTRAL:      [0.20, 0.40, 0.40],
  };
  score *= typeWeights[state][obs.optionType];

  // Flow side
  const sideWeights: Record<HMMState, number[]> = {
    ACCUMULATION: [0.05, 0.70, 0.25], // prefers SWEEPs
    DISTRIBUTION: [0.05, 0.70, 0.25],
    NEUTRAL:      [0.15, 0.45, 0.40],
  };
  score *= sideWeights[state][obs.flowSide];

  // Premium tier
  const premWeights: Record<HMMState, number[]> = {
    ACCUMULATION: [0.05, 0.10, 0.20, 0.25, 0.40],
    DISTRIBUTION: [0.05, 0.10, 0.20, 0.25, 0.40],
    NEUTRAL:      [0.30, 0.30, 0.20, 0.15, 0.05],
  };
  score *= premWeights[state][obs.premiumTier];

  // Directional alignment
  const dirWeights: Record<HMMState, number[]> = {
    ACCUMULATION: [0.20, 0.70, 0.10], // bullish aligned
    DISTRIBUTION: [0.20, 0.10, 0.70], // bearish aligned
    NEUTRAL:      [0.60, 0.20, 0.20],
  };
  score *= dirWeights[state][obs.directional];

  return Math.max(score, 1e-10); // avoid zero
}

// ── HMM class ────────────────────────────────────────────────────────────────
export class HiddenMarkovModel {
  public beliefs: Record<HMMState, number>;
  private prevState: HMMState = "NEUTRAL";
  private readonly STATES: HMMState[] = ["ACCUMULATION", "DISTRIBUTION", "NEUTRAL"];
  public observationCount = 0;

  constructor() {
    // Prior: start neutral
    this.beliefs = { ACCUMULATION: 0.20, DISTRIBUTION: 0.20, NEUTRAL: 0.60 };
  }

  // Forward algorithm — update beliefs given new observation
  update(obs: HMMObservation): HMMResult {
    this.observationCount++;
    const prevState = this.currentState;

    // Predict step: P(s_t) = sum_s' P(s_t|s') * P(s')
    const predicted: Record<HMMState, number> = { ACCUMULATION: 0, DISTRIBUTION: 0, NEUTRAL: 0 };
    for (const nextS of this.STATES) {
      for (const prevS of this.STATES) {
        predicted[nextS] += TRANSITIONS[prevS][nextS] * this.beliefs[prevS];
      }
    }

    // Update step: multiply by emission probability
    const updated: Record<HMMState, number> = { ACCUMULATION: 0, DISTRIBUTION: 0, NEUTRAL: 0 };
    let total = 0;
    for (const s of this.STATES) {
      updated[s] = predicted[s] * emissionScore(obs, s);
      total += updated[s];
    }

    // Normalize
    for (const s of this.STATES) {
      this.beliefs[s] = updated[s] / total;
    }

    const currentState = this.currentState;
    const stateChanged = currentState !== prevState;
    if (stateChanged) this.prevState = prevState;

    // Record history (max 200 points)
    this.history.push({ time: Date.now(), state: currentState, conf: Math.round(this.beliefs[currentState] * 100) });
    if (this.history.length > 200) this.history.shift();

    return {
      state: currentState,
      probabilities: { ...this.beliefs },
      confidence: Math.round(this.beliefs[currentState] * 100),
      stateChanged,
      prevState: this.prevState,
    };
  }

  get currentState(): HMMState {
    return this.STATES.reduce((a, b) => this.beliefs[a] > this.beliefs[b] ? a : b);
  }

  // Regime history for chart
  public history: Array<{ time: number; state: HMMState; conf: number }> = [];
  private lastFlipTime = 0;

  reset() {
    this.beliefs = { ACCUMULATION: 0.20, DISTRIBUTION: 0.20, NEUTRAL: 0.60 };
    this.observationCount = 0;
    this.history = [];
  }
}

// ── Observation builders ──────────────────────────────────────────────────────
export function buildObservation(
  dpNotional: number,
  optType: "CALL" | "PUT" | "",
  flowSide: "SWEEP" | "BLOCK" | "",
  premium: number,
  dpSide: "BUY" | "SELL" | "",
): HMMObservation {
  const dpTier = dpNotional >= 5e7 ? 4 : dpNotional >= 1e7 ? 3 : dpNotional >= 1e6 ? 2 : dpNotional >= 5e5 ? 1 : 0;
  const optionType = optType === "CALL" ? 1 : optType === "PUT" ? 2 : 0;
  const side = flowSide === "SWEEP" ? 1 : flowSide === "BLOCK" ? 2 : 0;
  const premTier = premium >= 1e6 ? 4 : premium >= 5e5 ? 3 : premium >= 1e5 ? 2 : premium >= 25000 ? 1 : 0;

  let directional: 0 | 1 | 2 = 0;
  if ((dpSide === "BUY" && optType === "CALL") || (dpSide === "SELL" && optType === "PUT")) directional = 1;
  else if ((dpSide === "BUY" && optType === "PUT") || (dpSide === "SELL" && optType === "CALL")) directional = 2;

  return {
    dpNotionalTier: dpTier as 0|1|2|3|4,
    optionType: optionType as 0|1|2,
    flowSide: side as 0|1|2,
    premiumTier: premTier as 0|1|2|3|4,
    directional,
  };
}

// ── Market-wide HMM (singleton across all tickers) ───────────────────────────
export const marketHMM = new HiddenMarkovModel();

// Per-ticker HMMs
const tickerHMMs: Record<string, HiddenMarkovModel> = {};
export function getTickerHMM(ticker: string): HiddenMarkovModel {
  if (!tickerHMMs[ticker]) tickerHMMs[ticker] = new HiddenMarkovModel();
  return tickerHMMs[ticker];
}

export function resetAllHMMs() {
  marketHMM.reset();
  Object.values(tickerHMMs).forEach(h => h.reset());
}
