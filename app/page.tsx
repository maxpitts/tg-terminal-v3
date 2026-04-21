'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────
interface Bar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number
}
interface NewsItem {
  id: string
  time: string
  headline: string
  source: string
  symbols: string[]
  category: string
  sentiment: number
  url?: string
}
interface MacroPoint {
  time: string
  indicator: string
  value: number
  prev_value: number
}
interface SymbolRow {
  symbol: string
  name: string
  exchange: string
  asset_type: string
  sector: string
}

// ── Watchlist ─────────────────────────────────────────────────
const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMD']

const MACRO_LABELS: Record<string, string> = {
  DFF:      'Fed Funds',
  T10Y2Y:   'Yield Curve',
  CPI:      'CPI',
  UNRATE:   'Unemployment',
  DGS10:    '10Y Treasury',
  DGS2:     '2Y Treasury',
  NONFARM:  'Nonfarm',
  M2:       'M2',
  UMCSENT:  'Consumer Sent.',
}

// ── Sparkline SVG ─────────────────────────────────────────────
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Price chart ───────────────────────────────────────────────
function PriceChart({ bars, loading }: { bars: Bar[]; loading: boolean }) {
  if (loading) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#f59e0b33', fontSize: 11, letterSpacing: 2 }}>LOADING...</span>
    </div>
  )
  if (!bars.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#f59e0b22', fontSize: 11 }}>NO DATA</span>
    </div>
  )

  const closes = bars.map(b => b.close)
  const min = Math.min(...closes) * 0.9985
  const max = Math.max(...closes) * 1.0015
  const range = max - min
  const W = 1000, H = 200

  const pts = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * W
    const y = H - ((c - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const lastX = W
  const lastY = H - ((closes[closes.length - 1] - min) / range) * H
  const isUp = closes[closes.length - 1] >= closes[0]
  const color = isUp ? '#22c55e' : '#ef4444'

  // Y axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: H - t * H,
    val: (min + t * range).toFixed(2),
  }))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 220, display: 'block' }}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yLabels.map((l, i) => (
        <line key={i} x1="0" y1={l.y} x2={W} y2={l.y} stroke="#f59e0b08" strokeWidth="1" />
      ))}
      {/* Area */}
      <path
        d={`M0,${H} L${pts.split(' ').join(' L')} L${W},${H} Z`}
        fill="url(#fill)"
      />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Last price line */}
      <line x1="0" y1={lastY.toFixed(1)} x2={W} y2={lastY.toFixed(1)}
        stroke={color} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function QuantaBase() {
  const [symbol, setSymbol]       = useState('SPY')
  const [timeframe, setTimeframe] = useState('1d')
  const [bars, setBars]           = useState<Bar[]>([])
  const [news, setNews]           = useState<NewsItem[]>([])
  const [macro, setMacro]         = useState<MacroPoint[]>([])
  const [loading, setLoading]     = useState(false)
  const [tab, setTab]             = useState<'chart' | 'news' | 'macro' | 'explorer'>('chart')
  const [searchQ, setSearchQ]     = useState('')
  const [searchRes, setSearchRes] = useState<SymbolRow[]>([])
  const [watchlist]               = useState(DEFAULT_WATCHLIST)
  const [watchBars, setWatchBars] = useState<Record<string, Bar[]>>({})
  const [time, setTime]           = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' ET')
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Load bars
  const loadBars = useCallback(async (sym: string, tf: string) => {
    setLoading(true)
    const limit = tf === '1d' ? 500 : 200
    const { data } = await supabase
      .from('ohlcv')
      .select('time,open,high,low,close,volume,vwap')
      .eq('symbol', sym)
      .eq('timeframe', tf)
      .order('time', { ascending: false })
      .limit(limit)
    setBars((data || []).reverse() as Bar[])
    setLoading(false)
  }, [])

  // Load news
  const loadNews = useCallback(async (sym: string) => {
    const { data } = await supabase
      .from('news_events')
      .select('id,time,headline,source,symbols,category,sentiment,url')
      .contains('symbols', [sym])
      .order('time', { ascending: false })
      .limit(30)
    setNews((data || []) as NewsItem[])
  }, [])

  // Load macro
  const loadMacro = useCallback(async () => {
    const { data } = await supabase
      .from('macro_data')
      .select('time,indicator,value,prev_value')
      .in('indicator', ['DFF', 'T10Y2Y', 'CPI', 'UNRATE', 'DGS10'])
      .order('time', { ascending: false })
      .limit(50)
    setMacro((data || []) as MacroPoint[])
  }, [])

  // Load watchlist sparklines
  const loadWatchlist = useCallback(async () => {
    const results: Record<string, Bar[]> = {}
    await Promise.all(watchlist.map(async s => {
      const { data } = await supabase
        .from('ohlcv')
        .select('time,close,volume')
        .eq('symbol', s)
        .eq('timeframe', '1d')
        .order('time', { ascending: false })
        .limit(30)
      results[s] = ((data || []).reverse()) as Bar[]
    }))
    setWatchBars(results)
  }, [watchlist])

  // Symbol search
  useEffect(() => {
    if (!searchQ.trim()) { setSearchRes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('symbols')
        .select('symbol,name,exchange,asset_type,sector')
        .or(`symbol.ilike.${searchQ.toUpperCase()}%,name.ilike.%${searchQ}%`)
        .eq('is_active', true)
        .limit(8)
      setSearchRes((data || []) as SymbolRow[])
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ])

  useEffect(() => { loadBars(symbol, timeframe) }, [symbol, timeframe, loadBars])
  useEffect(() => { loadNews(symbol) }, [symbol, loadNews])
  useEffect(() => { loadMacro(); loadWatchlist() }, [loadMacro, loadWatchlist])

  // Computed
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  const chg    = last && prev ? last.close - prev.close : 0
  const chgPct = last && prev ? (chg / prev.close) * 100 : 0
  const isUp   = chg >= 0

  // Latest macro per indicator
  const latestMacro = macro.reduce<Record<string, MacroPoint>>((acc, m) => {
    if (!acc[m.indicator]) acc[m.indicator] = m
    return acc
  }, {})

  const selectSymbol = (s: string) => {
    setSymbol(s)
    setSearchQ('')
    setSearchRes([])
  }

  const S: Record<string, React.CSSProperties> = {
    root: { background: '#000', minHeight: '100vh', color: '#e8e0d0', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: 'flex', flexDirection: 'column' },
    nav: { background: '#030303', borderBottom: '1px solid #f59e0b1a', padding: '0 20px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { display: 'grid', gridTemplateColumns: '200px 1fr 260px', flex: 1, minHeight: 0 },
    sidebar: { borderRight: '1px solid #f59e0b0f', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    main: { display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    right: { borderLeft: '1px solid #f59e0b0f', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    sectionLabel: { fontSize: 9, color: '#f59e0b44', letterSpacing: 2, textTransform: 'uppercase' as const, padding: '12px 14px 6px' },
    watchItem: { padding: '8px 14px', cursor: 'pointer', borderLeft: '2px solid transparent', transition: 'all 0.12s' },
    tab: { padding: '0 16px', height: 36, background: 'transparent', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' as const, cursor: 'pointer', borderBottom: '2px solid transparent' },
    tfBtn: { padding: '3px 9px', background: 'transparent', border: '1px solid #f59e0b2a', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: 'pointer' },
  }

  return (
    <div style={S.root}>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, border: '1.5px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>QB</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', letterSpacing: 3 }}>QUANTABASE</span>
          </div>
          <span style={{ fontSize: 9, color: '#f59e0b33', letterSpacing: 1, borderLeft: '1px solid #f59e0b1a', paddingLeft: 14 }}>FINANCIAL DATA INFRASTRUCTURE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Inline search */}
          <div style={{ position: 'relative' }} ref={searchRef}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search symbol..."
              style={{ background: '#0a0a0a', border: '1px solid #f59e0b22', color: '#e8e0d0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '5px 12px', outline: 'none', width: 180 }}
            />
            {searchRes.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0d0d0d', border: '1px solid #f59e0b22', zIndex: 100, maxHeight: 280, overflowY: 'auto' }}>
                {searchRes.map(r => (
                  <div key={r.symbol} onClick={() => selectSymbol(r.symbol)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f59e0b08' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f59e0b0a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>{r.symbol}</div>
                    <div style={{ color: '#e8e0d044', fontSize: 10, marginTop: 1 }}>{r.name?.slice(0, 32)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#22c55e66', letterSpacing: 1 }}>● LIVE</div>
          <div style={{ fontSize: 10, color: '#f59e0b33' }}>{time}</div>
        </div>
      </nav>

      {/* BODY */}
      <div style={S.body}>

        {/* LEFT — Watchlist */}
        <div style={S.sidebar}>
          <div style={S.sectionLabel}>Watchlist</div>
          {watchlist.map(s => {
            const d = watchBars[s] || []
            const l = d[d.length - 1]
            const p = d[d.length - 2]
            const c = l && p ? ((l.close - p.close) / p.close) * 100 : 0
            const up = c >= 0
            const active = symbol === s
            return (
              <div key={s} onClick={() => selectSymbol(s)}
                style={{ ...S.watchItem, borderLeftColor: active ? '#f59e0b' : 'transparent', background: active ? '#f59e0b08' : 'transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f59e0b05' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: active ? '#f59e0b' : '#e8e0d0', fontSize: 12 }}>{s}</span>
                  <span style={{ fontSize: 10, color: up ? '#22c55e' : '#ef4444' }}>{up ? '+' : ''}{c.toFixed(2)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#e8e0d055' }}>{l ? `$${l.close.toFixed(2)}` : '—'}</span>
                  <Sparkline data={d.slice(-20).map(b => b.close)} up={up} />
                </div>
              </div>
            )
          })}

          {/* Macro snapshot */}
          <div style={S.sectionLabel}>Macro</div>
          {Object.entries(latestMacro).map(([key, m]) => {
            const chg = m.prev_value ? m.value - m.prev_value : 0
            const up = chg >= 0
            return (
              <div key={key} style={{ padding: '6px 14px', borderBottom: '1px solid #f59e0b08' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: '#e8e0d055' }}>{MACRO_LABELS[key] || key}</span>
                  <span style={{ fontSize: 10, color: up ? '#22c55e88' : '#ef444488' }}>{up ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e0d0', marginTop: 1 }}>
                  {m.value.toFixed(2)}
                  {key === 'CPI' || key === 'UNRATE' ? '%' : ''}
                </div>
              </div>
            )
          })}
        </div>

        {/* MAIN PANEL */}
        <div style={S.main}>
          {/* Symbol header */}
          <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #f59e0b0f' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', letterSpacing: 2 }}>{symbol}</span>
                  {last && (
                    <>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#e8e0d0' }}>${last.close.toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: isUp ? '#22c55e' : '#ef4444' }}>
                        {isUp ? '+' : ''}{chg.toFixed(2)} ({isUp ? '+' : ''}{chgPct.toFixed(2)}%)
                      </span>
                    </>
                  )}
                </div>
                {last && (
                  <div style={{ fontSize: 10, color: '#e8e0d033', marginTop: 3 }}>
                    O {last.open.toFixed(2)} · H {last.high.toFixed(2)} · L {last.low.toFixed(2)} · V {(last.volume / 1e6).toFixed(2)}M {last.vwap ? `· VWAP ${last.vwap.toFixed(2)}` : ''}
                  </div>
                )}
              </div>
              {/* Timeframe */}
              <div style={{ display: 'flex', gap: 3 }}>
                {['1m', '5m', '15m', '1h', '1d'].map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    style={{ ...S.tfBtn, borderColor: timeframe === tf ? '#f59e0b' : '#f59e0b2a', color: timeframe === tf ? '#000' : '#f59e0b88', background: timeframe === tf ? '#f59e0b' : 'transparent', fontWeight: timeframe === tf ? 700 : 400 }}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0 }}>
              {(['chart', 'news', 'macro', 'explorer'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ ...S.tab, color: tab === t ? '#f59e0b' : '#e8e0d033', borderBottomColor: tab === t ? '#f59e0b' : 'transparent' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>

            {/* CHART */}
            {tab === 'chart' && (
              <div>
                <PriceChart bars={bars} loading={loading} />
                {/* OHLCV table */}
                {bars.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 9, color: '#f59e0b44', letterSpacing: 2, marginBottom: 8 }}>RECENT BARS</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {['DATE', 'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME', 'VWAP'].map(h => (
                            <th key={h} style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b33', fontWeight: 400, fontSize: 9, letterSpacing: 1, borderBottom: '1px solid #f59e0b0f' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...bars].reverse().slice(0, 15).map((b, i) => {
                          const up = b.close >= b.open
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f59e0b06' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f59e0b05')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '5px 8px', color: '#e8e0d044', textAlign: 'right' }}>{new Date(b.time).toLocaleDateString()}</td>
                              <td style={{ padding: '5px 8px', color: '#e8e0d077', textAlign: 'right' }}>{b.open.toFixed(2)}</td>
                              <td style={{ padding: '5px 8px', color: '#22c55e88', textAlign: 'right' }}>{b.high.toFixed(2)}</td>
                              <td style={{ padding: '5px 8px', color: '#ef444488', textAlign: 'right' }}>{b.low.toFixed(2)}</td>
                              <td style={{ padding: '5px 8px', color: up ? '#22c55e' : '#ef4444', textAlign: 'right', fontWeight: 700 }}>{b.close.toFixed(2)}</td>
                              <td style={{ padding: '5px 8px', color: '#e8e0d044', textAlign: 'right' }}>{(b.volume / 1e6).toFixed(2)}M</td>
                              <td style={{ padding: '5px 8px', color: '#e8e0d033', textAlign: 'right' }}>{b.vwap ? b.vwap.toFixed(2) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NEWS */}
            {tab === 'news' && (
              <div>
                <div style={{ fontSize: 9, color: '#f59e0b44', letterSpacing: 2, marginBottom: 12 }}>{news.length} ARTICLES — {symbol}</div>
                {news.length === 0 && <div style={{ color: '#e8e0d033', fontSize: 11 }}>No news found for {symbol}</div>}
                {news.map((n, i) => {
                  const sentColor = n.sentiment > 0.1 ? '#22c55e' : n.sentiment < -0.1 ? '#ef4444' : '#e8e0d044'
                  const catColor = n.category === 'earnings' ? '#f59e0b' : n.category === 'macro' ? '#3b82f6' : n.category === 'analyst' ? '#a855f7' : '#e8e0d044'
                  return (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f59e0b08' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: `${catColor}18`, color: catColor, letterSpacing: 1 }}>{n.category?.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: '#e8e0d033' }}>{new Date(n.time).toLocaleDateString()}</span>
                        <span style={{ fontSize: 9, color: '#e8e0d033' }}>{n.source}</span>
                        <span style={{ fontSize: 9, color: sentColor, marginLeft: 'auto' }}>{n.sentiment > 0.1 ? '▲ BULLISH' : n.sentiment < -0.1 ? '▼ BEARISH' : '— NEUTRAL'}</span>
                      </div>
                      <a href={n.url || '#'} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#e8e0d0', textDecoration: 'none', fontSize: 12, lineHeight: 1.5, display: 'block' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#e8e0d0')}
                      >
                        {n.headline}
                      </a>
                    </div>
                  )
                })}
              </div>
            )}

            {/* MACRO */}
            {tab === 'macro' && (
              <div>
                <div style={{ fontSize: 9, color: '#f59e0b44', letterSpacing: 2, marginBottom: 16 }}>MACRO INDICATORS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {Object.entries(latestMacro).map(([key, m]) => {
                    const chg = m.prev_value ? m.value - m.prev_value : 0
                    const up = chg >= 0
                    return (
                      <div key={key} style={{ background: '#080808', border: '1px solid #f59e0b11', padding: '14px 16px' }}>
                        <div style={{ fontSize: 9, color: '#f59e0b55', letterSpacing: 1, marginBottom: 6 }}>{MACRO_LABELS[key] || key}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e0d0' }}>{m.value.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: up ? '#22c55e' : '#ef4444', marginTop: 4 }}>
                          {up ? '▲' : '▼'} {Math.abs(chg).toFixed(3)} from prev
                        </div>
                        <div style={{ fontSize: 9, color: '#e8e0d033', marginTop: 4 }}>{new Date(m.time).toLocaleDateString()}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* EXPLORER */}
            {tab === 'explorer' && (
              <SymbolExplorer onSelect={selectSymbol} />
            )}

          </div>
        </div>

        {/* RIGHT PANEL — News feed */}
        <div style={S.right}>
          <div style={S.sectionLabel}>Market News</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <AllNews />
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Symbol Explorer ───────────────────────────────────────────
function SymbolExplorer({ onSelect }: { onSelect: (s: string) => void }) {
  const [rows, setRows]   = useState<SymbolRow[]>([])
  const [filter, setFilter] = useState('')
  const [type, setType]   = useState('all')

  useEffect(() => {
    async function load() {
      let q = supabase.from('symbols').select('symbol,name,exchange,asset_type,sector').eq('is_active', true).limit(200)
      if (type !== 'all') q = q.eq('asset_type', type)
      if (filter) q = q.or(`symbol.ilike.${filter.toUpperCase()}%,name.ilike.%${filter}%`)
      const { data } = await q.order('symbol')
      setRows((data || []) as SymbolRow[])
    }
    load()
  }, [filter, type])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..."
          style={{ flex: 1, background: '#0a0a0a', border: '1px solid #f59e0b22', color: '#e8e0d0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '5px 10px', outline: 'none' }} />
        {['all', 'equity', 'etf'].map(t => (
          <button key={t} onClick={() => setType(t)}
            style={{ padding: '5px 10px', background: type === t ? '#f59e0b' : 'transparent', border: '1px solid #f59e0b33', color: type === t ? '#000' : '#f59e0b88', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: 'pointer' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['SYMBOL', 'NAME', 'EXCHANGE', 'TYPE', 'SECTOR'].map(h => (
              <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: '#f59e0b33', fontWeight: 400, fontSize: 9, letterSpacing: 1, borderBottom: '1px solid #f59e0b0f' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.symbol} onClick={() => onSelect(r.symbol)} style={{ cursor: 'pointer', borderBottom: '1px solid #f59e0b06' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f59e0b08')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '5px 8px', color: '#f59e0b', fontWeight: 700 }}>{r.symbol}</td>
              <td style={{ padding: '5px 8px', color: '#e8e0d077', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
              <td style={{ padding: '5px 8px', color: '#e8e0d044' }}>{r.exchange}</td>
              <td style={{ padding: '5px 8px', color: '#e8e0d044' }}>{r.asset_type}</td>
              <td style={{ padding: '5px 8px', color: '#e8e0d033', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sector || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── All News (right panel) ────────────────────────────────────
function AllNews() {
  const [items, setItems] = useState<NewsItem[]>([])

  useEffect(() => {
    supabase.from('news_events')
      .select('id,time,headline,source,symbols,category,sentiment,url')
      .order('time', { ascending: false })
      .limit(50)
      .then(({ data }) => setItems((data || []) as NewsItem[]))
  }, [])

  return (
    <div>
      {items.map((n, i) => {
        const sentColor = n.sentiment > 0.1 ? '#22c55e88' : n.sentiment < -0.1 ? '#ef444488' : '#e8e0d022'
        return (
          <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #f59e0b06' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#e8e0d033' }}>{n.symbols?.slice(0, 3).join(' · ')}</span>
              <span style={{ fontSize: 9, color: '#e8e0d022' }}>{new Date(n.time).toLocaleDateString()}</span>
            </div>
            <a href={n.url || '#'} target="_blank" rel="noopener noreferrer"
              style={{ color: '#e8e0d088', textDecoration: 'none', fontSize: 11, lineHeight: 1.5, display: 'block' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e8e0d0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#e8e0d088')}
            >
              {n.headline}
            </a>
            <div style={{ fontSize: 9, color: sentColor, marginTop: 3 }}>
              {n.sentiment > 0.1 ? '▲' : n.sentiment < -0.1 ? '▼' : '—'} {n.source}
            </div>
          </div>
        )
      })}
    </div>
  )
}
