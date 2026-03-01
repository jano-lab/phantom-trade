"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings, Mail, Phone, Bell, Key, Clock, TestTube } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";

const GROUPS = [
  {
    label: "Notifications",
    icon: Bell,
    fields: [
      { key: "notification_email", label: "Your Email", type: "email", placeholder: "you@example.com", desc: "Receives alert emails" },
      { key: "notification_phone", label: "Your Phone (E.164)", type: "tel", placeholder: "+12125551234", desc: "Receives SMS alerts via Twilio" },
    ],
  },
  {
    label: "Email / SMTP",
    icon: Mail,
    fields: [
      { key: "smtp_host", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com", desc: "" },
      { key: "smtp_port", label: "SMTP Port", type: "text", placeholder: "587", desc: "" },
      { key: "smtp_user", label: "SMTP Username", type: "email", placeholder: "sender@gmail.com", desc: "" },
      { key: "smtp_pass", label: "SMTP Password / App Password", type: "password", placeholder: "••••••••", desc: "For Gmail, use an App Password" },
    ],
  },
  {
    label: "Twilio SMS",
    icon: Phone,
    fields: [
      { key: "twilio_sid",   label: "Twilio Account SID", type: "text", placeholder: "ACxxxxxx", desc: "" },
      { key: "twilio_token", label: "Twilio Auth Token",  type: "password", placeholder: "••••••••", desc: "" },
      { key: "twilio_from",  label: "Twilio Phone Number", type: "tel", placeholder: "+12125551000", desc: "" },
    ],
  },
  {
    label: "Data APIs",
    icon: Key,
    fields: [
      { key: "finnhub_key",       label: "Finnhub API Key",       type: "password", placeholder: "••••••••", desc: "Free at finnhub.io — enables news, insider data, real-time quotes" },
      { key: "newsapi_key",       label: "NewsAPI Key",           type: "password", placeholder: "••••••••", desc: "Free at newsapi.org — enables broader news coverage" },
      { key: "alpha_vantage_key", label: "Alpha Vantage API Key", type: "password", placeholder: "••••••••", desc: "Free at alphavantage.co — backup data source" },
    ],
  },
  {
    label: "Alert Thresholds",
    icon: Clock,
    fields: [
      { key: "alert_pct_threshold",  label: "Default % Move Alert",    type: "number", placeholder: "5", desc: "Alert on ±X% daily move" },
      { key: "accel_window_min",     label: "Acceleration Window (min)", type: "number", placeholder: "30", desc: "Sliding window for momentum detection" },
      { key: "accel_pct_trigger",    label: "Acceleration Trigger (%)", type: "number", placeholder: "3", desc: "Min % move within window to flag acceleration" },
      { key: "auto_stop_loss_pct",   label: "Default Stop Loss (%)",   type: "number", placeholder: "8", desc: "Suggested stop loss depth from cost basis" },
    ],
  },
];

export default function SettingsPage() {
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn:  () => fetch("/api/settings").then(r => r.json()),
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => showToast({ type: "success", title: "Settings saved" }),
    onError:   () => showToast({ type: "error", title: "Failed to save settings" }),
  });

  const testEmailMutation = useMutation({
    mutationFn: () => fetch("/api/settings/test-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()),
    onSuccess: (data) => showToast({ type: data.ok ? "success" : "error", title: data.ok ? "Test email sent!" : "Email test failed", message: data.error }),
  });

  const testSMSMutation = useMutation({
    mutationFn: () => fetch("/api/settings/test-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()),
    onSuccess: (data) => showToast({ type: data.ok ? "success" : "error", title: data.ok ? "Test SMS sent!" : "SMS test failed", message: data.error }),
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-phantom-star">Settings</h1>
        <p className="text-sm text-phantom-ghost mt-0.5">Configure notifications, API keys, and alert thresholds</p>
      </div>

      {GROUPS.map(({ label, icon: Icon, fields }) => (
        <div key={label} className="phantom-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-phantom-border">
            <Icon className="w-4 h-4 text-phantom-signal" />
            <h2 className="text-sm font-semibold text-phantom-star">{label}</h2>
          </div>
          <div className="p-5 space-y-4">
            {fields.map(({ key, label: fieldLabel, type, placeholder, desc }) => (
              <div key={key}>
                <label className="stat-label block mb-1.5">{fieldLabel}</label>
                <input
                  className="input-phantom w-full"
                  type={type}
                  placeholder={placeholder}
                  value={form[key] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  autoComplete="off"
                />
                {desc && <p className="text-[10px] text-phantom-ghost mt-1">{desc}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Cloud deployment info */}
      <div className="phantom-card p-5 border border-phantom-signal/20">
        <h3 className="text-xs font-semibold text-phantom-star uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-phantom-signal" /> Background Monitoring (When Computer is Off)
        </h3>
        <div className="space-y-2 text-xs text-phantom-ghost">
          <p>To receive alerts even when your computer is off, deploy Phantom Trade to the cloud:</p>
          <div className="bg-phantom-deep rounded-lg p-3 mt-2 space-y-1.5 font-mono text-[11px]">
            <div className="text-phantom-signal"># Option 1: Vercel (recommended)</div>
            <div>npx vercel --prod</div>
            <div className="text-phantom-ghost/60 mt-1"># vercel.json cron is auto-configured</div>
            <div className="text-phantom-signal mt-2"># Option 2: Google Cloud Run</div>
            <div>npm run build && npm start</div>
            <div className="text-phantom-signal mt-2"># Option 3: Local background cron</div>
            <div>npm run cron</div>
          </div>
          <p className="mt-2">The cron job at <code className="text-phantom-signal bg-phantom-deep px-1 py-0.5 rounded text-[10px]">/api/cron</code> runs the alert engine every minute. Set <code className="text-phantom-signal bg-phantom-deep px-1 py-0.5 rounded text-[10px]">CRON_SECRET</code> env var to protect it.</p>
        </div>
      </div>

      {/* Test buttons */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => testEmailMutation.mutate()} disabled={testEmailMutation.isPending}
          className="btn-ghost flex items-center gap-2 text-sm">
          <TestTube className="w-4 h-4" /> Test Email
        </button>
        <button onClick={() => testSMSMutation.mutate()} disabled={testSMSMutation.isPending}
          className="btn-ghost flex items-center gap-2 text-sm">
          <TestTube className="w-4 h-4" /> Test SMS
        </button>
      </div>

      {/* Save */}
      <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}
        className="btn-primary w-full flex items-center justify-center gap-2">
        <Settings className="w-4 h-4" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
