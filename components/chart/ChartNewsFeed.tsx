"use client";
import { useEffect, useState, useCallback } from "react";

interface NewsItem {
  id: string; title: string; description?: string;
  article_url: string; published_utc: string;
  author?: string; image_url?: string;
  tickers?: string[];
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props { ticker: string; }

export default function ChartNewsFeed({ ticker }: Props) {
  const [news, setNews]       = useState<NewsItem[]>([]);
  const [sel, setSel]         = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/polygon/news?ticker=${ticker}&_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const data = await res.json();
      if (data.news?.length) {
        setNews(data.news);
        setLastUpdated(new Date());
      }
    } catch {}
    setLoading(false);
  }, [ticker]);

  useEffect(() => {
    setNews([]); setSel(null);
    load();
    const t = setInterval(load, 30 * 1000); // refresh every 30 seconds
    return () => clearInterval(t);
  }, [load]);

  const s: Record<string,any> = {
    wrap:    { height:"100%", display:"flex", flexDirection:"column", background:"#09090f", borderLeft:"1px solid rgba(255,255,255,0.06)", width:300, flexShrink:0 },
    header:  { padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 },
    htitle:  { fontSize:11, fontWeight:600, color:"#666666", letterSpacing:1.5 },
    scroll:  { flex:1, overflowY:"auto" as const, padding:"6px 0" },
    card:    { padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer" },
    ticker:  { fontSize:9, fontWeight:700, color:"#FF9500", marginBottom:3 },
    title:   { fontSize:12, color:"#E0E0E0", lineHeight:1.45, marginBottom:4 },
    meta:    { fontSize:10, color:"#333333" },
    detail:  { position:"absolute" as const, inset:0, background:"#09090f", zIndex:10, overflowY:"auto" as const, padding:16 },
    dbk:     { background:"none", border:"none", color:"#666666", fontSize:12, cursor:"pointer", marginBottom:12, display:"flex", alignItems:"center", gap:4 },
    dt:      { fontSize:14, color:"#E0E0E0", lineHeight:1.6, marginBottom:12, fontWeight:600 },
    dd:      { fontSize:12, color:"#888888", lineHeight:1.7, marginBottom:16 },
    dlink:   { fontSize:12, color:"#FF9500", textDecoration:"none" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.htitle}>{ticker} NEWS</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {lastUpdated && (
            <span style={{ fontSize:9, color:"#1e293b" }}>
              {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <button onClick={load} disabled={loading}
            style={{ background:"none", border:"1px solid rgba(255,255,255,0.08)", color:"#555555",
              padding:"2px 8px", borderRadius:4, fontSize:10, cursor:"pointer" }}>
            {loading ? "…" : "↺"}
          </button>
        </div>
      </div>

      <div style={{ ...s.scroll, position:"relative" }}>
        {sel && (
          <div style={s.detail}>
            <button style={s.dbk} onClick={() => setSel(null)}>← Back</button>
            <div style={s.dt}>{sel.title}</div>
            <div style={{ ...s.meta, marginBottom:12 }}>
              {sel.author && <span>{sel.author} · </span>}
              {timeAgo(sel.published_utc)} · {new Date(sel.published_utc).toLocaleDateString()}
            </div>
            {sel.description && <div style={s.dd}>{sel.description}</div>}
            {sel.tickers && sel.tickers.length > 0 && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" as const, marginBottom:12 }}>
                {sel.tickers.slice(0,8).map(t => (
                  <span key={t} style={{ fontSize:9, color:"#FF9500", background:"rgba(255,149,0,0.08)", padding:"1px 5px", borderRadius:3 }}>{t}</span>
                ))}
              </div>
            )}
            <a href={sel.article_url} target="_blank" rel="noopener noreferrer" style={s.dlink}>
              Read full article →
            </a>
          </div>
        )}

        {news.length === 0 && !loading && (
          <div style={{ padding:20, color:"#333333", fontSize:12, textAlign:"center" }}>
            No recent news for {ticker}
          </div>
        )}

        {news.map(item => (
          <div key={item.id} style={s.card} onClick={() => setSel(item)}
            onMouseEnter={e => (e.currentTarget.style.background="#0d0d0d") as any}
            onMouseLeave={e => (e.currentTarget.style.background="transparent") as any}>
            {item.tickers && item.tickers.length > 0 && (
              <div style={s.ticker}>{item.tickers.slice(0,3).join(" · ")}</div>
            )}
            <div style={s.title}>{item.title}</div>
            <div style={s.meta}>
              {item.author && <span>{item.author} · </span>}
              {timeAgo(item.published_utc)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
