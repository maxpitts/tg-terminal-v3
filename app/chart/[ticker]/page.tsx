import ChartPageClient from "@/components/chart/ChartPageClient";

export default function ChartPage({ params }: { params: { ticker: string } }) {
  const ticker = (params.ticker || "SPY").toUpperCase();
  return <ChartPageClient initialTicker={ticker} />;
}

export function generateStaticParams() {
  return [{ ticker: "SPY" }, { ticker: "NVDA" }, { ticker: "QQQ" }];
}
