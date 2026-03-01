import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/db/schema";
import { detectAcceleration } from "@/lib/indicators";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "";
  if (!ticker) return NextResponse.json(null, { status: 400 });

  const history = (await getPriceHistory(ticker.toUpperCase(), 1)) as unknown as { price: number; snapped_at: string }[];
  const mapped  = history.map(h => ({ price: h.price, timestamp: new Date(h.snapped_at).getTime() }));
  const signal  = detectAcceleration(mapped, ticker.toUpperCase());
  return NextResponse.json(signal);
}
