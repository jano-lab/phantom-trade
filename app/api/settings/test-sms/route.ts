import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const settings = await req.json();
  const ok = await sendSMS("⚡ Phantom Trade test SMS — notifications are working!", settings);
  return NextResponse.json({ ok, error: ok ? null : "Check Twilio configuration" });
}
