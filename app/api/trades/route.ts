import { NextRequest, NextResponse } from "next/server";
import { getAllTrades, insertTrade } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? undefined;
  return NextResponse.json(getAllTrades(ticker));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id   = insertTrade({
    ticker:     body.ticker.toUpperCase(),
    action:     body.action,
    shares:     parseFloat(body.shares),
    price:      parseFloat(body.price),
    fees:       parseFloat(body.fees ?? 0),
    total:      parseFloat(body.shares) * parseFloat(body.price) + parseFloat(body.fees ?? 0),
    account:    body.account ?? "brokerage",
    trade_date: body.trade_date ?? new Date().toISOString().split("T")[0],
    notes:      body.notes ?? null,
  });
  return NextResponse.json({ ok: true, id });
}
