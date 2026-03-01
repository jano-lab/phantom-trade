import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/db/schema";

export async function GET() {
  return NextResponse.json(getWatchlist());
}

export async function POST(req: NextRequest) {
  const { ticker, name } = await req.json();
  addToWatchlist(ticker?.toUpperCase(), name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { ticker } = await req.json();
  removeFromWatchlist(ticker?.toUpperCase());
  return NextResponse.json({ ok: true });
}
