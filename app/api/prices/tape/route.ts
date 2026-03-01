import { NextResponse } from "next/server";
import { getMultiQuote } from "@/lib/api/yahoo";
import { getAllHoldings, getWatchlist } from "@/lib/db/schema";

const DEFAULT = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN","GOOGL","AMD"];

export async function GET() {
  try {
    const holdings = getAllHoldings().map(h => h.ticker);
    const watchlist = getWatchlist().map(w => w.ticker);
    const tickers   = [...new Set([...holdings, ...watchlist, ...DEFAULT])].slice(0, 20);
    const quotes    = await getMultiQuote(tickers);
    const items = Object.values(quotes).map(q => ({
      ticker:     q.ticker,
      price:      q.price,
      change_pct: q.change_pct,
    }));
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
