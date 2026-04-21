// lib/persistence.ts
// Dual-layer persistence: Supabase (cross-session) + localStorage (fast cache)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!_client) _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

const LS_DP_KEY   = "tg_dp_history";
const LS_OPT_KEY  = "tg_opt_history";
const LS_SIG_KEY  = "tg_sig_history";
const MAX_LOCAL   = 500;

// ── localStorage helpers ─────────────────────────────────────────────────────
function lsGet(key: string): any[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function lsSet(key: string, data: any[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(data.slice(0, MAX_LOCAL))); } catch {}
}

function lsAppend(key: string, item: any) {
  const existing = lsGet(key);
  const deduped  = existing.filter((r: any) => r.id !== item.id);
  lsSet(key, [item, ...deduped]);
}

// ── Dark Pool persistence ────────────────────────────────────────────────────
export async function saveDarkPool(print: any) {
  lsAppend(LS_DP_KEY, print);
  try {
    await (getClient() as any).from("dark_pool_prints").upsert({
      id:         print.id,
      ticker:     print.ticker,
      notional:   print.notional,
      size:       print.size,
      price:      print.price,
      side:       print.side,
      venue:      print.venue,
      time:       print.time,
      timestamp:  print.timestamp,
      quant_verdict: (print as any).quantVerdict || null,
      z_score:    (print as any).zScore || null,
      created_at: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
  } catch {}
}

export function getDarkPoolHistory(): any[] {
  return lsGet(LS_DP_KEY);
}

// ── Options Flow persistence ─────────────────────────────────────────────────
export async function saveOptionsFlow(flow: any) {
  lsAppend(LS_OPT_KEY, flow);
  try {
    await (getClient() as any).from("options_flow").upsert({
      id:        flow.id,
      ticker:    flow.ticker,
      type:      flow.type,
      strike:    flow.strike,
      expiry:    flow.expiry,
      dte:       flow.dte,
      premium:   flow.premium,
      size:      flow.size,
      side:      flow.side,
      time:      flow.time,
      timestamp: flow.timestamp,
      created_at: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
  } catch {}
}

export function getOptionsHistory(): any[] {
  return lsGet(LS_OPT_KEY);
}

// ── Correlation signal persistence ───────────────────────────────────────────
export async function saveSignal(signal: any) {
  lsAppend(LS_SIG_KEY, signal);
  try {
    await (getClient() as any).from("correlation_signals").upsert({
      id:         signal.id,
      ticker:     signal.ticker,
      score:      signal.score,
      hot:        signal.hot,
      dp_notional: signal.dp?.notional,
      dp_side:    signal.dp?.side,
      opt_type:   signal.fl?.type,
      opt_side:   signal.fl?.side,
      opt_strike: signal.fl?.strike,
      opt_expiry: signal.fl?.expiry,
      opt_premium: signal.fl?.premium,
      delta_mins: signal.delta,
      hmm_state:  signal.hmm?.tickerState,
      hmm_conf:   signal.hmm?.tickerConf,
      time:       signal.time,
      timestamp:  signal.timestamp,
      created_at: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
  } catch {}
}

export function getSignalHistory(): any[] {
  return lsGet(LS_SIG_KEY);
}

// ── Load from Supabase into localStorage on boot ─────────────────────────────
export async function hydrateFromSupabase() {
  try {
    const sb = getClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days

    const [dpRes, optRes, sigRes] = await Promise.all([
      (sb as any).from("dark_pool_prints").select("*").gte("created_at", since).order("timestamp", { ascending: false }).limit(200),
      (sb as any).from("options_flow").select("*").gte("created_at", since).order("timestamp", { ascending: false }).limit(200),
      (sb as any).from("correlation_signals").select("*").gte("created_at", since).order("timestamp", { ascending: false }).limit(200),
    ]);

    if (dpRes.data?.length)  lsSet(LS_DP_KEY,  dpRes.data);
    if (optRes.data?.length) lsSet(LS_OPT_KEY, optRes.data);
    if (sigRes.data?.length) lsSet(LS_SIG_KEY, sigRes.data);

    return {
      darkPool: dpRes.data || [],
      options:  optRes.data || [],
      signals:  sigRes.data || [],
    };
  } catch {
    return { darkPool: [], options: [], signals: [] };
  }
}
