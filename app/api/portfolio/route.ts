import { NextRequest, NextResponse } from "next/server";
import { getAllHoldings, upsertHolding, deleteHolding, updateHoldingShares } from "@/lib/db/schema";

export async function GET() {
  return NextResponse.json(getAllHoldings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  upsertHolding(body);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, shares, avg_cost } = await req.json();
  updateHoldingShares(id, shares, avg_cost);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteHolding(id);
  return NextResponse.json({ ok: true });
}
