import { NextRequest, NextResponse } from "next/server";
import { getHistoricalOHLC, getIntradayOHLC } from "@/lib/api/yahoo";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "";
  const period = (req.nextUrl.searchParams.get("period") ?? "6mo") as any;
  if (!ticker) return NextResponse.json([], { status: 400 });

  const bars = period === "1d"
    ? await getIntradayOHLC(ticker.toUpperCase())
    : await getHistoricalOHLC(ticker.toUpperCase(), period);

  return NextResponse.json(bars);
}
