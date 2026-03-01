import { NextRequest, NextResponse } from "next/server";
import { getInsiderTransactions, getInstitutionalHolders } from "@/lib/api/insiders";
import { getSetting } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker") ?? "";
  const type    = req.nextUrl.searchParams.get("type") ?? "insider";
  const apiKey  = getSetting("finnhub_key");

  if (!ticker) return NextResponse.json([], { status: 400 });

  if (type === "institutional") {
    const data = await getInstitutionalHolders(ticker.toUpperCase());
    return NextResponse.json(data);
  }

  const data = await getInsiderTransactions(ticker.toUpperCase(), apiKey);
  return NextResponse.json(data);
}
