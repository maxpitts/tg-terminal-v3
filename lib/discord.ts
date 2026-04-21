// lib/discord.ts
// Sends HOT signal alerts to a Discord channel via webhook
// Set DISCORD_WEBHOOK_URL in your .env.local / Vercel env vars

export interface HotSignalPayload {
  ticker: string;
  score: number;
  // Dark pool side
  dp: {
    notional: number;
    size: number;
    side: "BUY" | "SELL";
    venue: string;
    price: number;
  };
  // Options flow
  flow: {
    type: "CALL" | "PUT";
    strike: string;
    expiry: string;
    premium: number;
    side: "SWEEP" | "BLOCK";
    dte: number;
  };
  // Time delta between DP print and options flow (minutes)
  deltaMins: number;
  timestamp: string; // ISO
}

const fmt$ = (v: number) =>
  v >= 1e9
    ? `$${(v / 1e9).toFixed(1)}B`
    : v >= 1e6
    ? `$${(v / 1e6).toFixed(0)}M`
    : `$${(v / 1e3).toFixed(0)}K`;

// Score → color sidebar (Discord embed color is decimal RGB)
const scoreColor = (score: number) =>
  score >= 90
    ? 0xff2244 // red — extreme
    : score >= 80
    ? 0x9b30d9 // purple — HOT
    : 0x39ff14; // green — elevated

export async function sendHotSignal(payload: HotSignalPayload): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[discord] DISCORD_WEBHOOK_URL not set — skipping alert");
    return;
  }

  const { ticker, score, dp, flow, deltaMins, timestamp } = payload;

  const isBull = flow.type === "CALL" && dp.side === "BUY";
  const isBear = flow.type === "PUT" && dp.side === "SELL";
  const sentiment = isBull ? "🟢 BULLISH" : isBear ? "🔴 BEARISH" : "⚪ MIXED";
  const emoji = flow.type === "CALL" ? "📈" : "📉";

  const embed = {
    title: `${emoji} HOT SIGNAL — ${ticker} [${score}/100]`,
    description: `**${sentiment}** · ${flow.side} detected with correlated dark pool print`,
    color: scoreColor(score),
    fields: [
      // Dark pool block
      {
        name: "🌑 Dark Pool Print",
        value: [
          `**Notional:** ${fmt$(dp.notional)}`,
          `**Size:** ${(dp.size / 1e3).toFixed(0)}K shares @ $${dp.price.toFixed(2)}`,
          `**Side:** ${dp.side === "BUY" ? "🟢 BUY" : "🔴 SELL"}`,
          `**Venue:** ${dp.venue}`,
        ].join("\n"),
        inline: true,
      },
      // Options flow block
      {
        name: `${emoji} Options Flow`,
        value: [
          `**Type:** ${flow.type === "CALL" ? "🟢 CALL" : "🔴 PUT"}`,
          `**Strike:** $${flow.strike}`,
          `**Expiry:** ${flow.expiry} (${flow.dte}d)`,
          `**Premium:** ${fmt$(flow.premium)}`,
          `**Side:** ${flow.side === "SWEEP" ? "⚡ SWEEP" : "🟦 BLOCK"}`,
        ].join("\n"),
        inline: true,
      },
      // Correlation stats
      {
        name: "📊 Correlation",
        value: [
          `**Score:** ${score}/100`,
          `**Time Delta:** ${deltaMins}m apart`,
          `**Signal:** ${score >= 90 ? "EXTREME" : score >= 80 ? "VERY HIGH" : "HIGH"}`,
        ].join("\n"),
        inline: true,
      },
    ],
    footer: {
      text: `T&G Terminal — DarkFlow Engine • ${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" })} ET`,
    },
    timestamp,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "T&G DarkFlow",
        avatar_url: "https://os.tradesandgains.com/icon.png", // update if you have a hosted icon
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      console.error(`[discord] Webhook failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[discord] Webhook error:", err);
  }
}

// ── Cooldown map — prevents spamming the same ticker ──────────────────────
// Resets after COOLDOWN_MS of silence for that ticker
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per ticker
const lastSent = new Map<string, number>();

export async function sendHotSignalWithCooldown(
  payload: HotSignalPayload
): Promise<void> {
  const now = Date.now();
  const last = lastSent.get(payload.ticker) ?? 0;

  if (now - last < COOLDOWN_MS) {
    console.log(
      `[discord] Skipping ${payload.ticker} — cooldown active (${Math.round((COOLDOWN_MS - (now - last)) / 1000)}s remaining)`
    );
    return;
  }

  lastSent.set(payload.ticker, now);
  await sendHotSignal(payload);
}
