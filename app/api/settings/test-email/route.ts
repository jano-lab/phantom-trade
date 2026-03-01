import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const settings = await req.json();
  const ok = await sendEmail({
    subject: "⚡ Phantom Trade — Test Email",
    text:    "This is a test email from Phantom Trade. Notifications are working correctly.",
    html:    `<div style="background:#080B14;color:#E8EEF5;padding:32px;font-family:sans-serif;border-radius:12px;">
               <h2 style="color:#3B82F6;">⚡ Phantom Trade</h2>
               <p>Test email successful. You will receive alert notifications here.</p>
               <p style="color:#7C8B9E;font-size:12px;margin-top:16px;">${new Date().toISOString()}</p>
             </div>`,
  }, settings);
  return NextResponse.json({ ok, error: ok ? null : "Check SMTP configuration" });
}
