"use client";
import { useEffect, useRef } from "react";

/**
 * Connects to Finnhub WebSocket for real-time tick-level price updates.
 * Falls back to Finnhub REST quote poll if WebSocket fails.
 * 
 * Requires:
 *   NEXT_PUBLIC_FINNHUB_API_KEY in your env vars
 */
export function useLiveTicker(
  ticker: string,
  onPrice: (price: number, prevClose: number) => void,
  enabled = true
) {
  const cb = useRef(onPrice);
  useEffect(() => { cb.current = onPrice; });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn("[useLiveTicker] NEXT_PUBLIC_FINNHUB_API_KEY not set");
      return;
    }

    let ws: WebSocket | null = null;
    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let wsAlive = false;
    let prevClose = 0;

    // ── REST poll — runs immediately and as fallback when WS is down ────────
    const poll = async () => {
      if (dead) return;
      try {
        const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`);
        const data = await res.json();
        // Finnhub quote shape: { c: current, pc: prevClose, o, h, l, t }
        if (data?.c && data.c > 0) {
          if (data.pc) prevClose = data.pc;
          cb.current(data.c, data.pc ?? prevClose);
        }
      } catch {}
    };

    // Poll immediately, then every 1s as fallback
    poll();
    pollTimer = setInterval(poll, 1000);

    // ── Finnhub WebSocket — tick-level trades ───────────────────────────────
    const connect = () => {
      if (dead) return;

      ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

      ws.onopen = () => {
        // Subscribe to trades for this symbol
        ws!.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          // Finnhub trade message shape: { type:"trade", data:[{s,p,t,v,c},...] }
          if (msg.type === "trade" && Array.isArray(msg.data)) {
            // Take the last trade in the batch (most recent)
            const last = msg.data[msg.data.length - 1];
            if (last?.p && last.s === ticker) {
              wsAlive = true;
              cb.current(last.p, prevClose);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        wsAlive = false;
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => { try { ws?.close(); } catch {} };
    };

    connect();

    return () => {
      dead = true;
      wsAlive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      // Unsubscribe cleanly before closing
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "unsubscribe", symbol: ticker }));
        }
        ws?.close();
      } catch {}
    };
  }, [ticker, enabled]); // eslint-disable-line
}
