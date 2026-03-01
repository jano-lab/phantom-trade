/**
 * Notification engine — email (SMTP/Nodemailer) + SMS (Twilio)
 */
import nodemailer from "nodemailer";

export interface NotificationPayload {
  subject:  string;
  text:     string;
  html:     string;
}

// ─────────────────────── Email ───────────────────────────────

export async function sendEmail(payload: NotificationPayload, settings: Record<string, string>): Promise<boolean> {
  const { notification_email, smtp_host, smtp_port, smtp_user, smtp_pass } = settings;
  if (!notification_email || !smtp_user || !smtp_pass) {
    console.warn("[Notify] Email not configured");
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host:   smtp_host || "smtp.gmail.com",
      port:   parseInt(smtp_port || "587"),
      secure: parseInt(smtp_port || "587") === 465,
      auth:   { user: smtp_user, pass: smtp_pass },
    });
    await transporter.sendMail({
      from:    `"Phantom Trade" <${smtp_user}>`,
      to:      notification_email,
      subject: payload.subject,
      text:    payload.text,
      html:    payload.html,
    });
    console.log(`[Notify] Email sent: ${payload.subject}`);
    return true;
  } catch (err) {
    console.error("[Notify] Email error:", err);
    return false;
  }
}

// ─────────────────────── SMS ─────────────────────────────────

export async function sendSMS(message: string, settings: Record<string, string>): Promise<boolean> {
  const { notification_phone, twilio_sid, twilio_token, twilio_from } = settings;
  if (!notification_phone || !twilio_sid || !twilio_token || !twilio_from) {
    console.warn("[Notify] SMS not configured");
    return false;
  }
  try {
    const twilio = require("twilio");
    const client = twilio(twilio_sid, twilio_token);
    await client.messages.create({
      body: message,
      from: twilio_from,
      to:   notification_phone,
    });
    console.log(`[Notify] SMS sent: ${message.substring(0, 40)}...`);
    return true;
  } catch (err) {
    console.error("[Notify] SMS error:", err);
    return false;
  }
}

// ─────────────────────── Alert Templates ─────────────────────

export function buildPriceAlertEmail(opts: {
  ticker:    string;
  name:      string;
  alertType: string;
  price:     number;
  target:    number;
  changePct: number;
  news?:     { headline: string; url: string }[];
  maStatus?: { above50ma: boolean; aboveAVWAP: boolean; goldenCross: boolean; deathCross: boolean };
}): NotificationPayload {
  const { ticker, name, alertType, price, target, changePct, news = [], maStatus } = opts;
  const sign  = changePct >= 0 ? "+" : "";
  const color = changePct >= 0 ? "#00FF88" : "#FF3B5C";

  const newsHtml = news.length > 0 ? `
    <div style="margin-top:24px;">
      <h3 style="color:#7C8B9E;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Related Headlines</h3>
      ${news.map(n => `
        <div style="padding:12px;background:#111827;border-left:3px solid #3B82F6;margin-bottom:8px;border-radius:0 6px 6px 0;">
          <a href="${n.url}" style="color:#E8EEF5;text-decoration:none;font-size:13px;">${n.headline}</a>
        </div>
      `).join("")}
    </div>` : "";

  const maHtml = maStatus ? `
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      ${maStatus.above50ma    ? `<span style="background:#00FF88/20;color:#00FF88;padding:4px 10px;border-radius:4px;font-size:11px;border:1px solid #00FF88/30;">Above 50MA</span>` : `<span style="background:#FF3B5C20;color:#FF3B5C;padding:4px 10px;border-radius:4px;font-size:11px;border:1px solid #FF3B5C30;">Below 50MA</span>`}
      ${maStatus.aboveAVWAP   ? `<span style="background:#00FF8820;color:#00FF88;padding:4px 10px;border-radius:4px;font-size:11px;">Above AVWAP</span>` : `<span style="background:#FF3B5C20;color:#FF3B5C;padding:4px 10px;border-radius:4px;font-size:11px;">Below AVWAP</span>`}
      ${maStatus.goldenCross  ? `<span style="background:#F59E0B20;color:#F59E0B;padding:4px 10px;border-radius:4px;font-size:11px;">Golden Cross</span>` : ""}
      ${maStatus.deathCross   ? `<span style="background:#FF3B5C20;color:#FF3B5C;padding:4px 10px;border-radius:4px;font-size:11px;">Death Cross</span>` : ""}
    </div>` : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#080B14;font-family:'Inter',system-ui,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
    <div style="width:32px;height:32px;background:#3B82F620;border:1px solid #3B82F640;border-radius:8px;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:16px;">⚡</span>
    </div>
    <div>
      <div style="color:#E8EEF5;font-weight:600;font-size:14px;letter-spacing:2px;">PHANTOM TRADE</div>
      <div style="color:#7C8B9E;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Signal Triggered</div>
    </div>
  </div>

  <!-- Card -->
  <div style="background:#0D1117;border:1px solid #1C2333;border-radius:12px;padding:28px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <div style="margin-bottom:8px;">
      <span style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#E8EEF5;letter-spacing:2px;">${ticker}</span>
      <span style="color:#7C8B9E;font-size:14px;margin-left:10px;">${name}</span>
    </div>

    <div style="font-size:13px;color:#7C8B9E;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;">${alertType.replace(/_/g," ")}</div>

    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;">
      <div>
        <div style="color:#7C8B9E;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Current Price</div>
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#E8EEF5;">$${price.toFixed(2)}</div>
      </div>
      <div>
        <div style="color:#7C8B9E;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Change</div>
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:${color};">${sign}${changePct.toFixed(2)}%</div>
      </div>
      <div>
        <div style="color:#7C8B9E;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Alert Target</div>
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#3B82F6;">$${target.toFixed(2)}</div>
      </div>
    </div>

    ${maHtml}
    ${newsHtml}
  </div>

  <div style="text-align:center;margin-top:24px;color:#7C8B9E;font-size:11px;">
    Phantom Trade — Signal Over Noise &nbsp;·&nbsp; ${new Date().toLocaleString()}
  </div>
</div>
</body>
</html>`;

  const text = `PHANTOM TRADE ALERT\n\n${ticker} (${name})\n${alertType}\n\nPrice: $${price.toFixed(2)} (${sign}${changePct.toFixed(2)}%)\nTarget: $${target.toFixed(2)}\n\n${news.map(n => `• ${n.headline}\n  ${n.url}`).join("\n")}\n\nPhantom Trade — ${new Date().toISOString()}`;

  return {
    subject: `⚡ ${ticker} Alert: ${alertType.replace(/_/g," ")} @ $${price.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`,
    text,
    html,
  };
}

export function buildSMSAlert(ticker: string, alertType: string, price: number, changePct: number): string {
  const sign = changePct >= 0 ? "+" : "";
  return `⚡ PHANTOM: ${ticker} ${alertType.replace(/_/g," ")} | $${price.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
}

export function buildAccelerationSMS(ticker: string, projected5: number, severity: string): string {
  const dir = projected5 < 0 ? "📉 FALLING" : "📈 RISING";
  return `⚡ PHANTOM ${severity.toUpperCase()}: ${ticker} ${dir} FAST | Proj 5min: ${projected5.toFixed(1)}% | Consider partial exit`;
}
