import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/db/schema";

export async function GET() {
  return NextResponse.json(await getWatchlist());
}

export async function POST(req: NextRequest) {
  const { ticker, name } = await req.json();
  await addToWatchlist(ticker?.toUpperCase(), name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { ticker } = await req.json();
  await removeFromWatchlist(ticker?.toUpperCase());
  return NextResponse.json({ ok: true });
}
