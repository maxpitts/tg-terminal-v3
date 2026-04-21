// lib/polygon.ts
// Server-side only — never import on client
const BASE = "https://api.polygon.io";
const KEY = () => process.env.POLYGON_API_KEY!;

// ── REST: Candle aggregates ───────────────────────────────────
export interface Candle {
  t: string;   // time label "HH:MM"
  o: number; h: number; l: number; c: number;
  vol: number; bull: boolean;
}

export async function fetchCandles(
  ticker: string,
  multiplier = 5,
  timespan: "minute" | "hour" | "day" = "minute",
  limit = 60
): Promise<Candle[]> {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const url = `${BASE}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${KEY()}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  const data = await res.json();
  if (!data.results?.length) throw new Error("No data");
  return data.results.map((b: any) => ({
    t: new Date(b.t).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
    o: b.o, h: b.h, l: b.l, c: b.c, vol: b.v, bull: b.c >= b.o,
  }));
}

// ── REST: Snapshot (current price + day stats) ───────────────
export async function fetchSnapshot(ticker: string) {
  const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${KEY()}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  const data = await res.json();
  return data.ticker;
}

// ── REST: Options snapshot (chain) ───────────────────────────
export async function fetchOptionsChain(ticker: string) {
  const url = `${BASE}/v3/snapshot/options/${ticker}?limit=50&apiKey=${KEY()}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

// ── REST: News ────────────────────────────────────────────────
export async function fetchNews(ticker?: string, limit = 20) {
  const q = ticker ? `&ticker=${ticker}` : "";
  const url = `${BASE}/v2/reference/news?limit=${limit}&order=desc&sort=published_utc${q}&apiKey=${KEY()}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  const data = await res.json();
  return data.results || [];
}

// ── WebSocket: Stream handler (runs server-side in API route) ─
export type PolygonMessage = {
  ev: string;
  sym?: string;
  p?: number;
  s?: number;
  c?: string[];
  v?: number;
  av?: number;
  vw?: number;
  o?: number;
  z?: string;
  t?: number;
};

export function createPolygonSocket(
  onMessage: (msgs: PolygonMessage[]) => void,
  onConnected: () => void
) {
  const WebSocket = require("ws");
  const ws = new WebSocket("wss://socket.polygon.io/options");

  ws.on("open", () => {
    ws.send(JSON.stringify({ action: "auth", params: KEY() }));
  });

  ws.on("message", (raw: Buffer) => {
    try {
      const msgs: PolygonMessage[] = JSON.parse(raw.toString());
      msgs.forEach((m) => {
        if (m.ev === "status" && (m as any).status === "auth_success") {
          // Subscribe: options trades + stock aggregates (for dark pool TRF)
          ws.send(JSON.stringify({ action: "subscribe", params: "T.*,A.*" }));
          onConnected();
        }
      });
      onMessage(msgs);
    } catch {}
  });

  ws.on("error", (e: Error) => console.error("[Polygon WS]", e.message));
  ws.on("close", () => console.log("[Polygon WS] closed"));

  return ws;
}

// ── Dark pool filter: condition 41 = TRF print ───────────────
export function isDarkPool(msg: PolygonMessage): boolean {
  return msg.ev === "T" && Array.isArray(msg.c) && msg.c.includes("41");
}

// ── Options trade classifier ──────────────────────────────────
export function classifyOptionsMsg(msg: PolygonMessage) {
  // Polygon options symbol format: O:AAPL240119C00150000
  const sym = msg.sym || "";
  const parts = sym.replace("O:", "").match(/^([A-Z]+)(\d{6})(C|P)(\d+)$/);
  if (!parts) return null;
  const [, ticker, expRaw, cp, strikeRaw] = parts;
  const exp = `${expRaw.substring(2, 4)}/${expRaw.substring(4, 6)}/20${expRaw.substring(0, 2)}`;
  const strike = (parseInt(strikeRaw) / 1000).toFixed(0);
  const premium = (msg.p || 0) * (msg.s || 0) * 100;
  // Sweep heuristic: large size, rapid execution (condition codes 14, 41)
  const isSweep = Array.isArray(msg.c) && (msg.c.includes("14") || msg.c.includes("41"));
  return {
    ticker, type: cp === "C" ? "CALL" : "PUT",
    strike: "$" + strike, expiry: exp,
    premium, side: isSweep ? "SWEEP" : "BLOCK",
    dte: Math.round((new Date(exp).getTime() - Date.now()) / 86400000),
  };
}
