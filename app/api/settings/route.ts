import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db/schema";

export async function GET() {
  const settings = await getAllSettings();
  const masked   = { ...settings };
  for (const key of ["smtp_pass","twilio_token","twilio_sid","finnhub_key","newsapi_key","alpha_vantage_key"]) {
    if (masked[key]) masked[key] = "••••••••";
  }
  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (value === "••••••••") continue;
    await setSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
