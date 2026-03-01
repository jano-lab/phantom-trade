"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, StarOff, Plus, ExternalLink, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import Link from "next/link";
import TickerSearch from "@/components/ui/TickerSearch";
import StockChart from "@/components/charts/StockChart";
import MomentumGauge from "@/components/charts/MomentumGauge";
import { showToast } from "@/components/ui/Toaster";

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

export default function Watchlist() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: watchlist = [] } = useQuery<any[]>({
    queryKey: ["watchlist"],
    queryFn:  () => fetch("/api/watchlist").then(r => r.json()),
  });

  const tickers = watchlist.map((w: any) => w.ticker);
  const { data: quotes = {} } = useQuery<Record<string, any>>({
    queryKey: ["quotes-watch", tickers.join(",")],
    queryFn:  () => tickers.length > 0 ? fetch(`/api/prices/quotes?tickers=${tickers.join(",")}`).then(r => r.json()) : {},
    enabled:  tickers.length > 0,
    refetchInterval: 30_000,
  });

  const { data: selQuote } = useQuery<any>({
    queryKey: ["quote-single", selected],
    queryFn:  () => fetch(`/api/prices/quotes?ticker=${selected}`).then(r => r.json()),
    enabled:  !!selected,
    refetchInterval: 30_000,
  });

  const { data: maStatus } = useQuery({
    queryKey: ["ma-status", selected],
    queryFn:  async () => {
      const bars = await fetch(`/api/prices/ohlc?ticker=${selected}&period=1y`).then(r => r.json());
      const { analyzeMAs } = await import("@/lib/indicators");
      const q = selQuote ?? quotes[selected!];
      return bars.length > 0 ? analyzeMAs(bars, q?.price ?? 0) : null;
    },
    enabled: !!selected && !!selQuote,
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess:  (_, vars) => { qc.invalidateQueries({ queryKey: ["watchlist"] }); showToast({ type: "success", title: `${vars.ticker} added to watchlist` }); },
  });

  const removeMutation = useMutation({
    mutationFn: (ticker: string) => fetch("/api/watchlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["watchlist"] }); if (selected) setSelected(null); showToast({ type: "success", title: "Removed from watchlist" }); },
  });

  const sel = selected ? (quotes[selected] ?? selQuote) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Watchlist</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">{watchlist.length} tickers being tracked</p>
        </div>
        <TickerSearch
          className="w-64"
          placeholder="Add ticker..."
          onSelect={(ticker, name) => addMutation.mutate({ ticker, name })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="phantom-card overflow-hidden">
          <div className="px-4 py-3 border-b border-phantom-border">
            <span className="text-xs font-semibold text-phantom-star uppercase tracking-wider">Watching</span>
          </div>
          <div className="overflow-y-auto max-h-[80vh]">
            {watchlist.length === 0 && (
              <div className="p-8 text-center">
                <Star className="w-8 h-8 text-phantom-ghost mx-auto mb-2 opacity-30" />
                <p className="text-sm text-phantom-ghost">No tickers yet</p>
                <p className="text-xs text-phantom-ghost/60 mt-1">Search to add one</p>
              </div>
            )}
            {watchlist.map((w: any) => {
              const q = quotes[w.ticker];
              return (
                <button key={w.ticker}
                  onClick={() => setSelected(w.ticker === selected ? null : w.ticker)}
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-phantom-border/40 text-left transition-all group
                    ${selected === w.ticker ? "bg-phantom-signal/10 border-l-2 border-l-phantom-signal" : "hover:bg-phantom-surface/50"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-phantom-muted flex items-center justify-center text-[11px] font-mono font-bold text-phantom-silver flex-shrink-0">
                      {w.ticker.slice(0,2)}
                    </div>
                    <div>
                      <div className="ticker-tag">{w.ticker}</div>
                      <div className="text-[10px] text-phantom-ghost">{w.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-mono text-sm text-phantom-star">{q ? `$${fmt(q.price)}` : "—"}</div>
                      {q && (
                        <div className={`text-[10px] font-mono ${q.change_pct >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}`}>
                          {q.change_pct >= 0 ? "+" : ""}{fmt(q.change_pct)}%
                        </div>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeMutation.mutate(w.ticker); }}
                      className="p-1 text-phantom-ghost hover:text-phantom-pulse opacity-0 group-hover:opacity-100 transition-opacity">
                      <StarOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {sel && selected ? (
            <div className="space-y-4">
              {/* Quote header */}
              <div className="phantom-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-mono font-bold text-phantom-star">{selected}</h2>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${(sel.change_pct ?? 0) >= 0 ? "nova-badge" : "pulse-badge"}`}>
                        {(sel.change_pct ?? 0) >= 0 ? "+" : ""}{fmt(sel.change_pct ?? 0)}%
                      </span>
                    </div>
                    <div className="text-phantom-ghost text-sm mt-0.5">{sel.name}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/alerts?ticker=${selected}`} className="btn-ghost text-xs flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Alert
                    </Link>
                  </div>
                </div>

                <div className="text-4xl font-mono font-bold text-phantom-star mt-3">${fmt(sel.price ?? 0)}</div>
                <div className="text-sm text-phantom-ghost mt-1">
                  Change: <span className={sel.change >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}>
                    {sel.change >= 0 ? "+" : ""}{fmt(sel.change ?? 0)} ({sel.change_pct >= 0 ? "+" : ""}{fmt(sel.change_pct ?? 0)}%)
                  </span>
                </div>

                {/* MA Status badges */}
                {maStatus && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${maStatus.above50ma ? "nova-badge" : "pulse-badge"}`}>
                      {maStatus.above50ma ? "Above" : "Below"} 50MA
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${maStatus.above200ma ? "nova-badge" : "pulse-badge"}`}>
                      {maStatus.above200ma ? "Above" : "Below"} 200MA
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${maStatus.aboveAVWAP ? "nova-badge" : "pulse-badge"}`}>
                      {maStatus.aboveAVWAP ? "Above" : "Below"} AVWAP
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium signal-badge`}>
                      50MA {maStatus.ma50Trending}
                    </span>
                    {maStatus.goldenCross && <span className="amber-badge text-xs">Golden Cross ✨</span>}
                    {maStatus.deathCross  && <span className="pulse-badge text-xs">Death Cross ☠️</span>}
                    {maStatus.avwapReclaim && <span className="nova-badge text-xs">AVWAP Reclaimed 🚀</span>}
                    {maStatus.avwapLoss   && <span className="pulse-badge text-xs">AVWAP Lost ⚠️</span>}
                  </div>
                )}
              </div>

              <MomentumGauge ticker={selected} />

              <div className="phantom-card p-5">
                <StockChart ticker={selected} height={320} showAVWAP showMA />
              </div>

              {/* Key stats */}
              <div className="phantom-card p-5 grid grid-cols-3 md:grid-cols-6 gap-4">
                {sel && [
                  { label: "52W High",  value: `$${fmt(sel.week52_high ?? 0)}` },
                  { label: "52W Low",   value: `$${fmt(sel.week52_low  ?? 0)}` },
                  { label: "Volume",    value: (sel.volume ?? 0).toLocaleString() },
                  { label: "Avg Vol",   value: (sel.avg_volume ?? 0).toLocaleString() },
                  { label: "Mkt Cap",   value: sel.mkt_cap >= 1e9 ? `$${(sel.mkt_cap/1e9).toFixed(1)}B` : `$${(sel.mkt_cap/1e6).toFixed(0)}M` },
                  { label: "Beta",      value: sel.beta ? fmt(sel.beta) : "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="stat-label">{label}</div>
                    <div className="font-mono text-sm text-phantom-star mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 phantom-card">
              <div className="text-center text-phantom-ghost">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="text-sm">Select a ticker to view</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
