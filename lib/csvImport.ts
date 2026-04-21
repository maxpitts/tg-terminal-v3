// lib/csvImport.ts
// Brokerage CSV import parsers

export interface ImportedTrade {
  ticker: string;
  direction: "LONG" | "SHORT";
  entry: number;
  exit: number | null;
  size: number;
  pnl: number | null;
  status: "OPEN" | "CLOSED";
  date: string;
  notes: string;
  tag: "TRADE";
  broker: string;
}

type ParseResult = { trades: ImportedTrade[]; errors: string[]; broker: string };

// ── Detect broker from CSV headers ───────────────────────────────────────────
export function detectBroker(headers: string[]): string {
  const h = headers.map(h => h.toLowerCase().trim()).join(",");
  if (h.includes("tastytrade") || h.includes("execution price") && h.includes("value")) return "tastytrade";
  if (h.includes("webull") || h.includes("side") && h.includes("filled qty")) return "webull";
  if (h.includes("robinhood") || h.includes("average price") && h.includes("quantity")) return "robinhood";
  if (h.includes("ibkr") || h.includes("interactive") || h.includes("t. price") && h.includes("comm/fee")) return "ibkr";
  if (h.includes("schwab") || h.includes("action") && h.includes("description") && h.includes("amount")) return "schwab";
  return "generic";
}

// ── Parse CSV string into rows ────────────────────────────────────────────────
function parseCSVRows(csv: string): string[][] {
  const lines = csv.trim().split("\n").filter(l => l.trim());
  return lines.map(line => {
    const cols: string[] = [];
    let inQuote = false, cur = "";
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function num(s: string): number {
  return parseFloat(s?.replace(/[$,%\s]/g, "") || "0") || 0;
}

function fmtDate(s: string): string {
  if (!s) return new Date().toISOString().split("T")[0];
  try {
    return new Date(s).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ── Tastytrade ────────────────────────────────────────────────────────────────
// Headers: Date/Time, Type, Action, Symbol, Instrument Type, Description, Value, Quantity, Average Price, Commissions, Fees, Multiplier, Root Symbol, Underlying Symbol, Expiration Date, Strike Price, Call or Put, Order #
function parseTastytrade(rows: string[][], headers: string[]): ParseResult {
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const dateI   = idx("date");
  const actionI = idx("action");
  const symI    = idx("underlying symbol") !== -1 ? idx("underlying symbol") : idx("symbol");
  const qtyI    = idx("quantity");
  const priceI  = idx("average price");
  const valueI  = idx("value");

  const trades: ImportedTrade[] = [];
  const errors: string[] = [];
  const openPositions: Record<string, ImportedTrade> = {};

  for (const row of rows) {
    if (row.length < 5) continue;
    const action = row[actionI]?.toLowerCase() || "";
    if (!action.includes("buy") && !action.includes("sell")) continue;

    const ticker = row[symI]?.replace(/\s/g,"") || "";
    if (!ticker) continue;

    const qty   = Math.abs(num(row[qtyI]));
    const price = Math.abs(num(row[priceI]));
    const date  = fmtDate(row[dateI]);

    if (!qty || !price) continue;

    const isBuy = action.includes("buy");
    const key = ticker;

    if (isBuy) {
      openPositions[key] = {
        ticker, direction: "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: `Imported from Tastytrade`, tag: "TRADE", broker: "Tastytrade",
      };
    } else {
      if (openPositions[key]) {
        const open = openPositions[key];
        const pnl  = (price - open.entry) * qty * (open.direction === "LONG" ? 1 : -1);
        trades.push({ ...open, exit: price, pnl: parseFloat(pnl.toFixed(2)), status: "CLOSED" });
        delete openPositions[key];
      } else {
        trades.push({
          ticker, direction: "SHORT", entry: price, exit: null,
          size: qty, pnl: null, status: "OPEN", date,
          notes: `Imported from Tastytrade`, tag: "TRADE", broker: "Tastytrade",
        });
      }
    }
  }

  // Add remaining open positions
  Object.values(openPositions).forEach(t => trades.push(t));

  return { trades, errors, broker: "Tastytrade" };
}

// ── Webull ────────────────────────────────────────────────────────────────────
// Headers: Symbol, Side, Filled Qty, Avg Price, Filled Time, Order Type, Status
function parseWebull(rows: string[][], headers: string[]): ParseResult {
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const symI   = idx("symbol");
  const sideI  = idx("side");
  const qtyI   = idx("filled qty");
  const priceI = idx("avg price");
  const dateI  = idx("filled time");

  const trades: ImportedTrade[] = [];
  const openPositions: Record<string, ImportedTrade> = {};

  for (const row of rows) {
    if (row.length < 4) continue;
    const side   = row[sideI]?.toLowerCase() || "";
    const ticker = row[symI]?.trim() || "";
    const qty    = Math.abs(num(row[qtyI]));
    const price  = Math.abs(num(row[priceI]));
    const date   = fmtDate(row[dateI]);

    if (!ticker || !qty || !price) continue;

    const isBuy = side.includes("buy");
    const key   = ticker;

    if (isBuy) {
      openPositions[key] = {
        ticker, direction: "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported from Webull", tag: "TRADE", broker: "Webull",
      };
    } else if (openPositions[key]) {
      const open = openPositions[key];
      const pnl  = (price - open.entry) * qty;
      trades.push({ ...open, exit: price, pnl: parseFloat(pnl.toFixed(2)), status: "CLOSED" });
      delete openPositions[key];
    } else {
      trades.push({
        ticker, direction: "SHORT", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported from Webull", tag: "TRADE", broker: "Webull",
      });
    }
  }
  Object.values(openPositions).forEach(t => trades.push(t));
  return { trades, errors: [], broker: "Webull" };
}

// ── Robinhood ─────────────────────────────────────────────────────────────────
// Headers: Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount
function parseRobinhood(rows: string[][], headers: string[]): ParseResult {
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const dateI  = idx("activity date");
  const symI   = idx("instrument");
  const descI  = idx("description");
  const codeI  = idx("trans code");
  const qtyI   = idx("quantity");
  const priceI = idx("price");

  const trades: ImportedTrade[] = [];
  const openPositions: Record<string, ImportedTrade> = {};

  for (const row of rows) {
    if (row.length < 5) continue;
    const code   = row[codeI]?.toUpperCase() || "";
    const ticker = row[symI]?.trim() || "";
    const qty    = Math.abs(num(row[qtyI]));
    const price  = Math.abs(num(row[priceI]));
    const date   = fmtDate(row[dateI]);

    if (!ticker || !qty || !price) continue;
    if (!["BUY","STO","BTO","STC","BTC","SELL"].includes(code) && !["BUY","SELL"].includes(code)) continue;

    const isBuy = code.includes("B");
    const key   = ticker;

    if (isBuy) {
      openPositions[key] = {
        ticker, direction: "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: `${row[descI]||""} — Robinhood`, tag: "TRADE", broker: "Robinhood",
      };
    } else if (openPositions[key]) {
      const open = openPositions[key];
      const pnl  = (price - open.entry) * qty;
      trades.push({ ...open, exit: price, pnl: parseFloat(pnl.toFixed(2)), status: "CLOSED" });
      delete openPositions[key];
    } else {
      trades.push({
        ticker, direction: "SHORT", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: `${row[descI]||""} — Robinhood`, tag: "TRADE", broker: "Robinhood",
      });
    }
  }
  Object.values(openPositions).forEach(t => trades.push(t));
  return { trades, errors: [], broker: "Robinhood" };
}

// ── Interactive Brokers ───────────────────────────────────────────────────────
// Headers: DataDiscriminator, Asset Category, Currency, Symbol, Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee, Basis, Realized P/L, MTM P/L, Code
function parseIBKR(rows: string[][], headers: string[]): ParseResult {
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const symI   = idx("symbol");
  const dateI  = idx("date/time");
  const qtyI   = idx("quantity");
  const priceI = idx("t. price");
  const pnlI   = idx("realized p/l");

  const trades: ImportedTrade[] = [];

  for (const row of rows) {
    if (row.length < 6) continue;
    if (row[0]?.toLowerCase().includes("total")) continue;

    const ticker = row[symI]?.trim() || "";
    const qty    = num(row[qtyI]);
    const price  = Math.abs(num(row[priceI]));
    const date   = fmtDate(row[dateI]);
    const pnl    = pnlI !== -1 ? num(row[pnlI]) : null;

    if (!ticker || !price) continue;

    trades.push({
      ticker, direction: qty >= 0 ? "LONG" : "SHORT",
      entry: price, exit: pnl !== null ? price : null,
      size: Math.abs(qty), pnl: pnl || null,
      status: pnl !== null && pnl !== 0 ? "CLOSED" : "OPEN",
      date, notes: "Imported from Interactive Brokers",
      tag: "TRADE", broker: "Interactive Brokers",
    });
  }
  return { trades, errors: [], broker: "Interactive Brokers" };
}

// ── Schwab ────────────────────────────────────────────────────────────────────
// Headers: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
function parseSchwab(rows: string[][], headers: string[]): ParseResult {
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const dateI   = idx("date");
  const actionI = idx("action");
  const symI    = idx("symbol");
  const qtyI    = idx("quantity");
  const priceI  = idx("price");

  const trades: ImportedTrade[] = [];
  const openPositions: Record<string, ImportedTrade> = {};

  for (const row of rows) {
    if (row.length < 5) continue;
    const action = row[actionI]?.toLowerCase() || "";
    if (!action.includes("buy") && !action.includes("sell")) continue;

    const ticker = row[symI]?.trim() || "";
    const qty    = Math.abs(num(row[qtyI]));
    const price  = Math.abs(num(row[priceI]));
    const date   = fmtDate(row[dateI]);

    if (!ticker || !qty || !price) continue;

    const isBuy = action.includes("buy");
    const key   = ticker;

    if (isBuy) {
      openPositions[key] = {
        ticker, direction: "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported from Schwab", tag: "TRADE", broker: "Schwab",
      };
    } else if (openPositions[key]) {
      const open = openPositions[key];
      const pnl  = (price - open.entry) * qty;
      trades.push({ ...open, exit: price, pnl: parseFloat(pnl.toFixed(2)), status: "CLOSED" });
      delete openPositions[key];
    } else {
      trades.push({
        ticker, direction: "SHORT", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported from Schwab", tag: "TRADE", broker: "Schwab",
      });
    }
  }
  Object.values(openPositions).forEach(t => trades.push(t));
  return { trades, errors: [], broker: "Schwab" };
}

// ── Generic CSV ───────────────────────────────────────────────────────────────
function parseGeneric(rows: string[][], headers: string[]): ParseResult {
  const lower = headers.map(h => h.toLowerCase().trim());
  const find  = (...names: string[]) => {
    for (const n of names) {
      const i = lower.findIndex(h => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const symI    = find("symbol","ticker","stock","instrument");
  const dateI   = find("date","time","datetime");
  const qtyI    = find("qty","quantity","shares","size","filled");
  const priceI  = find("price","avg","average","exec","fill");
  const sideI   = find("side","action","type","direction","trans");
  const pnlI    = find("pnl","p&l","profit","gain","realized");

  if (symI === -1 || priceI === -1) {
    return { trades: [], errors: ["Could not detect required columns (symbol, price). Please check your CSV format."], broker: "Generic" };
  }

  const trades: ImportedTrade[] = [];
  const openPositions: Record<string, ImportedTrade> = {};

  for (const row of rows) {
    const ticker = row[symI]?.trim() || "";
    const price  = Math.abs(num(row[priceI]));
    const qty    = qtyI !== -1 ? Math.abs(num(row[qtyI])) : 1;
    const date   = dateI !== -1 ? fmtDate(row[dateI]) : new Date().toISOString().split("T")[0];
    const pnl    = pnlI !== -1 ? num(row[pnlI]) : null;

    if (!ticker || !price) continue;

    const sideVal = sideI !== -1 ? row[sideI]?.toLowerCase() || "" : "";
    const isBuy   = sideVal.includes("buy") || sideVal.includes("long") || sideVal.includes("b");
    const isSell  = sideVal.includes("sell") || sideVal.includes("short") || sideVal.includes("s");

    if (pnl !== null && pnl !== 0) {
      trades.push({
        ticker, direction: "LONG", entry: price, exit: price,
        size: qty, pnl, status: "CLOSED", date,
        notes: "Imported via Generic CSV", tag: "TRADE", broker: "Generic",
      });
    } else if (isBuy) {
      openPositions[ticker] = {
        ticker, direction: "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported via Generic CSV", tag: "TRADE", broker: "Generic",
      };
    } else if (isSell && openPositions[ticker]) {
      const open = openPositions[ticker];
      const p    = (price - open.entry) * qty;
      trades.push({ ...open, exit: price, pnl: parseFloat(p.toFixed(2)), status: "CLOSED" });
      delete openPositions[ticker];
    } else {
      trades.push({
        ticker, direction: isSell ? "SHORT" : "LONG", entry: price, exit: null,
        size: qty, pnl: null, status: "OPEN", date,
        notes: "Imported via Generic CSV", tag: "TRADE", broker: "Generic",
      });
    }
  }
  Object.values(openPositions).forEach(t => trades.push(t));
  return { trades, errors: [], broker: "Generic" };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseCSV(csvText: string): ParseResult {
  const rows    = parseCSVRows(csvText);
  if (rows.length < 2) return { trades: [], errors: ["CSV appears empty or invalid."], broker: "Unknown" };

  const headers = rows[0];
  const data    = rows.slice(1).filter(r => r.some(c => c.trim()));
  const broker  = detectBroker(headers);

  switch (broker) {
    case "tastytrade":      return parseTastytrade(data, headers);
    case "webull":          return parseWebull(data, headers);
    case "robinhood":       return parseRobinhood(data, headers);
    case "ibkr":            return parseIBKR(data, headers);
    case "schwab":          return parseSchwab(data, headers);
    default:                return parseGeneric(data, headers);
  }
}
