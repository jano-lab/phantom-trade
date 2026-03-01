import { NextRequest, NextResponse } from "next/server";
import { getAlerts, insertAlert, deactivateAlert, deleteAlert, getAlertLog } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? undefined;
  const log    = req.nextUrl.searchParams.get("log") === "1";
  if (log) return NextResponse.json(await getAlertLog(100));
  return NextResponse.json(await getAlerts(ticker));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id   = await insertAlert({
    ticker:       body.ticker.toUpperCase(),
    type:         body.type,
    condition:    JSON.stringify(body.condition),
    active:       1,
    notify_email: body.notify_email ?? 1,
    notify_sms:   body.notify_sms  ?? 1,
  });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const { id, active } = await req.json();
  if (active === false || active === 0) await deactivateAlert(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteAlert(id);
  return NextResponse.json({ ok: true });
}
