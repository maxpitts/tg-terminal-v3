# T&G Terminal — Trades & Gains OS

Full production deployment of the Trades & Gains OS/2-inspired trading terminal.  
Live at: `os.tradesandgains.com`

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Charts | TradingView Lightweight Charts |
| Live Data | Polygon.io WebSocket (proxied as SSE) |
| Auth | Whop OAuth (membership gating) |
| Database | Supabase (Postgres + RLS) |
| State | Zustand (persisted to localStorage + Supabase) |
| Deploy | Vercel |
| Domain | `os.tradesandgains.com` |

---

## Step 1 — Clone and install

```bash
git clone https://github.com/yourusername/tg-terminal
cd tg-terminal
npm install
cp .env.example .env.local
```

---

## Step 2 — Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy your project URL + anon key + service role key into `.env.local`
3. Go to **SQL Editor** → paste and run `supabase/schema.sql`
4. Done — RLS is configured automatically

---

## Step 3 — Polygon.io

1. Go to [polygon.io](https://polygon.io) → Sign up → **Starter plan ($29/mo)**
   - Includes: REST API, WebSocket streams, options data, dark pool TRF
2. Copy your API key into `.env.local` as `POLYGON_API_KEY`
3. The app proxies all Polygon calls server-side — your key is **never** exposed to the client

**What it connects to:**
- `wss://socket.polygon.io/options` → Options trades (sweeps, blocks)
- `T.*` subscription → All trades including dark pool TRF prints (condition 41)
- REST `/v2/aggs/...` → Chart candlestick data

---

## Step 4 — Whop (membership gating)

1. Go to [whop.com](https://whop.com) → Create app
2. Set redirect URI to: `https://os.tradesandgains.com/api/whop/callback`
3. Copy Client ID + API key into `.env.local`
4. Get your product/plan ID from your Whop product page
5. Set `WHOP_PRODUCT_ID` — only users with an **active** membership to this plan get in

For local dev, use `http://localhost:3000/api/whop/callback` as redirect URI.

---

## Step 5 — GammaFlow webhook (TradingView)

In your TradingView Pine Script alert, set the webhook URL to:
```
https://os.tradesandgains.com/api/signals
```

Add this header: `x-webhook-secret: YOUR_GAMMFLOW_WEBHOOK_SECRET`

Alert message body (JSON):
```json
{
  "ticker": "{{ticker}}",
  "signal": "GAMMA SQUEEZE",
  "regime": "BULL",
  "confidence": 85,
  "timeframe": "5m"
}
```

Signals are stored in Supabase and broadcast in real-time to all connected users.

---

## Step 6 — Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add all env vars in Vercel dashboard:  
`Settings → Environment Variables` → paste everything from `.env.local`

Set your custom domain:  
`Settings → Domains → Add → os.tradesandgains.com`

---

## Step 7 — DNS

In your domain registrar (wherever tradesandgains.com is registered):

```
CNAME  os  →  cname.vercel-dns.com
```

---

## Local development

```bash
npm run dev
# Open http://localhost:3000
```

For local dev without Whop auth, you can temporarily comment out the middleware or add:
```bash
# .env.local
SKIP_AUTH=true  # Add a check in middleware.ts
```

---

## Architecture notes

**SSE streams** — `/api/polygon/stream` opens a Polygon WebSocket on the server and relays messages as SSE to the browser. This keeps your API key server-side and supports multiple clients per connection.

**Correlation engine** — lives in `store/flow.ts`. When an options sweep arrives, it checks the dark pool buffer (last 5 min, same ticker). If a match exists, it scores 0–100 and creates a correlation. Score ≥75 = HOT → fires SFX + notification + saves to Supabase.

**Desktop state** — Zustand persists icon positions, SFX preference, and API key to localStorage. Window positions sync to Supabase on close so your layout survives refreshes.

**TradingView charts** — `ChartApp.tsx` uses `lightweight-charts` v4. The chart initializes on mount, data loads from `/api/polygon/candles` (30s cache). Clicking any ticker anywhere opens a new chart window.

---

## File structure

```
tg-terminal/
├── app/
│   ├── layout.tsx                    Root layout
│   ├── page.tsx                      Desktop OS (Server Component)
│   ├── globals.css
│   ├── login/page.tsx                Whop OAuth login
│   └── api/
│       ├── polygon/
│       │   ├── stream/route.ts       SSE proxy (Polygon WS → browser)
│       │   ├── candles/route.ts      Chart data (REST)
│       │   └── news/route.ts         News feed
│       ├── signals/route.ts          GammaFlow webhook + SSE
│       ├── journal/route.ts          Trade journal CRUD
│       └── whop/callback/route.ts    OAuth callback
├── components/
│   ├── desktop/
│   │   ├── DesktopClient.tsx         Main OS shell
│   │   ├── Window.tsx                Draggable/resizable OS/2 window
│   │   ├── DeskIcon.tsx              Draggable desktop icon
│   │   ├── Taskbar.tsx               OS/2 taskbar
│   │   ├── Boot.tsx                  Boot sequence
│   │   ├── LiveBG.tsx                Animated teal background
│   │   └── NotifStack.tsx            HOT signal notifications
│   └── apps/
│       ├── ChartApp.tsx              TradingView chart
│       ├── DarkFlowApp.tsx           Correlation engine UI
│       ├── DarkPoolApp.tsx           Dark pool feed
│       ├── OptionsApp.tsx            Options flow feed
│       ├── GammaApp.tsx              Gamma signals
│       ├── NewsApp.tsx               News feed
│       ├── SubstackApp.tsx           T&G Substack
│       ├── JournalApp.tsx            Trade journal
│       └── SettingsApp.tsx           API keys + SFX
├── store/
│   ├── desktop.ts                    Zustand: windows, icons, settings
│   └── flow.ts                       Zustand: live data + correlation engine
├── hooks/
│   └── useStream.ts                  SSE connection manager
├── lib/
│   ├── polygon.ts                    Polygon REST + WS client
│   ├── supabase.ts                   Supabase client (browser + server)
│   └── sounds.ts                     SFX engine
├── supabase/
│   └── schema.sql                    Full DB schema
├── middleware.ts                     Whop auth gating
├── vercel.json                       Deployment config
└── .env.example                      All required env vars
```
