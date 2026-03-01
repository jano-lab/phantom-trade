import { NextRequest, NextResponse } from "next/server";
import { getMultiQuote, getQuote } from "@/lib/api/yahoo";
import { cachePrice } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean);
  const single  = req.nextUrl.searchParams.get("ticker");

  try {
    if (single) {
      const q = await getQuote(single.toUpperCase());
      if (!q) return NextResponse.json(null);
      await cachePrice(q.ticker, q.price, q.change_pct, q.volume);
      return NextResponse.json(q);
    }
    const quotes = await getMultiQuote(tickers.map(t => t.toUpperCase()));
    for (const q of Object.values(quotes)) {
      await cachePrice(q.ticker, q.price, q.change_pct, q.volume);
    }
    return NextResponse.json(quotes);
  } catch (err) {
    console.error("[API/quotes]", err);
    return NextResponse.json({}, { status: 500 });
  }
}
