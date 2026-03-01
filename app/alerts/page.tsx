"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Zap, TrendingDown, Activity, BarChart3, Volume2 } from "lucide-react";
import TickerSearch from "@/components/ui/TickerSearch";
import { showToast } from "@/components/ui/Toaster";

const ALERT_TYPES = [
  { value: "price_above",  label: "Price Above",      icon: TrendingDown, desc: "Alert when price exceeds target" },
  { value: "price_below",  label: "Price Below",      icon: TrendingDown, desc: "Alert when price drops below target" },
  { value: "pct_change",   label: "% Move Either",    icon: Activity,     desc: "Alert on ±X% move from open" },
  { value: "pct_drop",     label: "% Drop (sell)",    icon: TrendingDown, desc: "Alert on -X% drop — sell signal" },
  { value: "avwap_reclaim",label: "AVWAP Reclaim",    icon: BarChart3,    desc: "Price reclaims 200-day AVWAP" },
  { value: "avwap_loss",   label: "AVWAP Loss",       icon: BarChart3,    desc: "Price loses 200-day AVWAP" },
  { value: "ma_cross",     label: "MA Cross",         icon: BarChart3,    desc: "50MA/200MA cross (golden/death)" },
  { value: "acceleration", label: "Rapid Decel/Accel",icon: Zap,          desc: "Momentum acceleration — crash early warning" },
  { value: "volume_spike", label: "Volume Spike",     icon: Volume2,      desc: "Volume X× above average" },
];

function AlertTypeIcon({ type }: { type: string }) {
  const cfg = ALERT_TYPES.find(a => a.value === type);
  const Icon = cfg?.icon ?? Bell;
  return <Icon className="w-3.5 h-3.5" />;
}

function alertTypeBadge(type: string) {
  if (type.includes("avwap") || type.includes("ma")) return "signal-badge";
  if (type.includes("drop") || type.includes("loss") || type === "acceleration") return "pulse-badge";
  if (type.includes("above") || type.includes("reclaim")) return "nova-badge";
  return "amber-badge";
}

export default function Alerts() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen]   = useState(false);
  const [form, setForm] = useState({
    ticker:       "",
    name:         "",
    type:         "price_above",
    target:       "",
    pct:          "5",
    crossType:    "golden",
    minSeverity:  "warning",
    ratio:        "2",
    notify_email: true,
    notify_sms:   true,
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["alerts"],
    queryFn:  () => fetch("/api/alerts").then(r => r.json()),
    refetchInterval: 10_000,
  });

  const { data: alertLog = [] } = useQuery<any[]>({
    queryKey: ["alert-log"],
    queryFn:  () => fetch("/api/alerts?log=1").then(r => r.json()),
    refetchInterval: 15_000,
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["alerts"] }); setAddOpen(false); showToast({ type: "success", title: "Alert created", message: `Watching ${form.ticker}` }); },
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => fetch("/api/alerts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["alerts"] }); showToast({ type: "success", title: "Alert deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const buildCondition = () => {
    const t = form.type;
    if (t === "price_above" || t === "price_below")  return { target: parseFloat(form.target) };
    if (t === "pct_change")                          return { pct: parseFloat(form.pct) };
    if (t === "pct_drop")                            return { pct: parseFloat(form.pct) };
    if (t === "avwap_reclaim" || t === "avwap_loss") return {};
    if (t === "ma_cross")                            return { crossType: form.crossType };
    if (t === "acceleration")                        return { minSeverity: form.minSeverity, direction: "down" };
    if (t === "volume_spike")                        return { ratio: parseFloat(form.ratio) };
    return {};
  };

  const submit = () => {
    if (!form.ticker) return;
    addMutation.mutate({
      ticker:       form.ticker,
      type:         form.type,
      condition:    buildCondition(),
      notify_email: form.notify_email ? 1 : 0,
      notify_sms:   form.notify_sms   ? 1 : 0,
    });
  };

  const activeCount   = alerts.filter((a: any) => a.active).length;
  const todayTriggers = alertLog.filter((a: any) => new Date(a.triggered_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Alerts</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">{activeCount} active · {todayTriggers} triggered today</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active alerts */}
        <div>
          <h2 className="text-xs font-semibold text-phantom-ghost uppercase tracking-wider mb-3">Active Alerts</h2>
          <div className="space-y-2">
            {alerts.filter((a: any) => a.active).map((a: any) => {
              const cond = JSON.parse(a.condition ?? "{}");
              return (
                <div key={a.id} className={`phantom-card p-4 flex items-start gap-3 ${a.trigger_count > 0 ? "border-phantom-amber/30" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alertTypeBadge(a.type)}`}>
                    <AlertTypeIcon type={a.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="ticker-tag">{a.ticker}</span>
                      <span className={`text-[10px] ${alertTypeBadge(a.type)}`}>{a.type.replace(/_/g," ")}</span>
                      {a.notify_email && <span className="text-[10px] text-phantom-ghost border border-phantom-border/60 rounded px-1">email</span>}
                      {a.notify_sms   && <span className="text-[10px] text-phantom-ghost border border-phantom-border/60 rounded px-1">sms</span>}
                    </div>
                    <div className="text-xs text-phantom-ghost mt-1">
                      {cond.target && `Target: $${cond.target}`}
                      {cond.pct    && `Threshold: ±${cond.pct}%`}
                      {cond.crossType && `Cross: ${cond.crossType}`}
                      {cond.minSeverity && `Min severity: ${cond.minSeverity}`}
                      {cond.ratio && `Volume ratio: ${cond.ratio}x`}
                    </div>
                    {a.trigger_count > 0 && (
                      <div className="text-[10px] text-phantom-amber mt-0.5">
                        Triggered {a.trigger_count}× · Last: {new Date(a.triggered_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleMutation.mutate({ id: a.id, active: false })}
                      className="p-1.5 text-phantom-ghost hover:text-phantom-star">
                      <ToggleRight className="w-4 h-4 text-phantom-nova" />
                    </button>
                    <button onClick={() => delMutation.mutate(a.id)}
                      className="p-1.5 text-phantom-ghost hover:text-phantom-pulse">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {alerts.filter((a: any) => a.active).length === 0 && (
              <div className="phantom-card p-8 text-center text-phantom-ghost text-sm">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No active alerts
              </div>
            )}
          </div>

          {/* Inactive */}
          {alerts.filter((a: any) => !a.active).length > 0 && (
            <>
              <h2 className="text-xs font-semibold text-phantom-ghost uppercase tracking-wider mt-5 mb-3">Inactive</h2>
              <div className="space-y-2 opacity-50">
                {alerts.filter((a: any) => !a.active).map((a: any) => (
                  <div key={a.id} className="phantom-card p-3 flex items-center gap-3">
                    <span className="ticker-tag text-xs">{a.ticker}</span>
                    <span className="text-[10px] text-phantom-ghost">{a.type.replace(/_/g," ")}</span>
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => toggleMutation.mutate({ id: a.id, active: true })} className="p-1 text-phantom-ghost hover:text-phantom-nova">
                        <ToggleLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => delMutation.mutate(a.id)} className="p-1 text-phantom-ghost hover:text-phantom-pulse">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Alert history */}
        <div>
          <h2 className="text-xs font-semibold text-phantom-ghost uppercase tracking-wider mb-3">Trigger History</h2>
          <div className="phantom-card overflow-hidden">
            <div className="overflow-y-auto max-h-[70vh]">
              {alertLog.length === 0 ? (
                <div className="p-8 text-center text-phantom-ghost text-sm">No alerts triggered yet</div>
              ) : (
                <div className="divide-y divide-phantom-border/40">
                  {(alertLog as any[]).map((log: any) => (
                    <div key={log.id} className="px-4 py-3 hover:bg-phantom-surface/40">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-phantom-amber" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="ticker-tag text-xs">{log.ticker}</span>
                            <span className={`text-[10px] ${alertTypeBadge(log.alert_type)}`}>{log.alert_type?.replace(/_/g," ")}</span>
                          </div>
                          <div className="text-xs text-phantom-ghost mt-0.5 line-clamp-2">{log.message}</div>
                          <div className="text-[10px] text-phantom-ghost/60 mt-1">{new Date(log.triggered_at).toLocaleString()}</div>
                        </div>
                        {log.price && <div className="font-mono text-sm text-phantom-star flex-shrink-0">${parseFloat(log.price).toFixed(2)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add alert modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="phantom-card-elevated w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-phantom-star mb-5 flex items-center gap-2">
              <Bell className="w-4 h-4 text-phantom-signal" /> Create Alert
            </h2>
            <div className="space-y-4">
              <div>
                <label className="stat-label block mb-1.5">Ticker</label>
                <TickerSearch placeholder="Search ticker..." onSelect={(ticker, name) => setForm(f => ({...f, ticker, name}))} />
                {form.ticker && <div className="mt-2 nova-badge w-fit">{form.ticker}</div>}
              </div>

              <div>
                <label className="stat-label block mb-1.5">Alert Type</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {ALERT_TYPES.map(at => (
                    <button key={at.value}
                      onClick={() => setForm(f => ({...f, type: at.value}))}
                      className={`flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-all border
                        ${form.type === at.value
                          ? "bg-phantom-signal/10 border-phantom-signal/30 text-phantom-star"
                          : "border-phantom-border hover:border-phantom-signal/20 text-phantom-ghost hover:text-phantom-silver"}`}>
                      <at.icon className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-xs">{at.label}</div>
                        <div className="text-[10px] opacity-70">{at.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition params */}
              {(form.type === "price_above" || form.type === "price_below") && (
                <div>
                  <label className="stat-label block mb-1.5">Target Price ($)</label>
                  <input className="input-phantom w-full" type="number" placeholder="e.g. 85.00" value={form.target}
                    onChange={e => setForm(f => ({...f, target: e.target.value}))} />
                </div>
              )}
              {(form.type === "pct_change" || form.type === "pct_drop") && (
                <div>
                  <label className="stat-label block mb-1.5">Threshold (%)</label>
                  <input className="input-phantom w-full" type="number" placeholder="e.g. 5" value={form.pct}
                    onChange={e => setForm(f => ({...f, pct: e.target.value}))} />
                </div>
              )}
              {form.type === "ma_cross" && (
                <div>
                  <label className="stat-label block mb-1.5">Cross Type</label>
                  <select className="input-phantom w-full" value={form.crossType} onChange={e => setForm(f => ({...f, crossType: e.target.value}))}>
                    <option value="golden">Golden Cross (50MA above 200MA)</option>
                    <option value="death">Death Cross (50MA below 200MA)</option>
                  </select>
                </div>
              )}
              {form.type === "acceleration" && (
                <div>
                  <label className="stat-label block mb-1.5">Minimum Severity</label>
                  <select className="input-phantom w-full" value={form.minSeverity} onChange={e => setForm(f => ({...f, minSeverity: e.target.value}))}>
                    <option value="warning">Warning (proj -3%+ in 5min)</option>
                    <option value="danger">Danger (proj -5%+ in 5min)</option>
                    <option value="critical">Critical (proj -8%+ in 5min)</option>
                  </select>
                </div>
              )}
              {form.type === "volume_spike" && (
                <div>
                  <label className="stat-label block mb-1.5">Volume Ratio (× average)</label>
                  <input className="input-phantom w-full" type="number" placeholder="e.g. 2" value={form.ratio}
                    onChange={e => setForm(f => ({...f, ratio: e.target.value}))} />
                </div>
              )}

              {/* Notification channels */}
              <div>
                <label className="stat-label block mb-2">Notifications</label>
                <div className="flex gap-3">
                  {[
                    { key: "notify_email", label: "Email" },
                    { key: "notify_sms",   label: "SMS" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
                        onChange={e => setForm(f => ({...f, [key]: e.target.checked}))}
                        className="rounded border-phantom-border" />
                      <span className="text-xs text-phantom-silver">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={submit} className="btn-primary flex-1" disabled={!form.ticker}>
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
