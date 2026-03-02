import { NextRequest, NextResponse } from "next/server";
import { getHistoricalOHLC, getIntradayOHLC } from "@/lib/api/yahoo";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "";
  const period = (req.nextUrl.searchParams.get("period") ?? "6mo") as any;
  if (!ticker) return NextResponse.json([], { status: 400 });

  if (period === "1d") {
    // Returns { bars, meta } so the chart can draw pre/post market session bands
    const data = await getIntradayOHLC(ticker.toUpperCase());
    return NextResponse.json(data);
  }

  const bars = await getHistoricalOHLC(ticker.toUpperCase(), period);
  return NextResponse.json(bars);
}
