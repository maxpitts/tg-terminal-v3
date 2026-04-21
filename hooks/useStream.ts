"use client";
import { useEffect, useRef } from "react";

type PriceCallback = (data: { price: number; volume?: number; vwap?: number }) => void;

const listeners = new Map<string, Set<PriceCallback>>();

export function useStream(ticker: string, onPrice?: PriceCallback) {
  const esRef = useRef<EventSource | null>(null);
  const tickerRef = useRef(ticker);
  tickerRef.current = ticker;

  useEffect(() => {
    if (!ticker || typeof window === "undefined") return;
    esRef.current?.close();

    const es = new EventSource(`/api/stream?ticker=${ticker}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "price" && msg.ticker === tickerRef.current) {
          onPrice?.({ price: msg.price, volume: msg.volume, vwap: msg.vwap });
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (tickerRef.current === ticker) {
          esRef.current = new EventSource(`/api/stream?ticker=${ticker}`);
        }
      }, 5000);
    };

    return () => { es.close(); esRef.current = null; };
  }, [ticker]);
}
