import { NextRequest, NextResponse } from "next/server";
import { runAlertEngine } from "@/lib/alerts/engine";

/**
 * Cron endpoint — called every minute by:
 * - Vercel Cron Jobs (vercel.json)
 * - Google Cloud Scheduler
 * - Local node-cron (scripts/cron.ts)
 *
 * Protect with a secret key in production
 */
export async function GET(req: NextRequest) {
  const secret     = req.nextUrl.searchParams.get("key");
  const envSecret  = process.env.CRON_SECRET;

  // In production, validate secret
  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runAlertEngine();
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Also support POST for Vercel cron
export const POST = GET;
