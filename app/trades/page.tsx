"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, TrendingUp, TrendingDown, Search, Filter } from "lucide-react";

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

export default function Trades() {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all"|"buy"|"sell">("all");
  const [ticker, setTicker]     = useState<string | null>(null);

  const { data: trades = [] } = useQuery<any[]>({
    queryKey: ["all-trades", ticker],
    queryFn:  () => fetch(ticker ? `/api/trades?ticker=${ticker}` : "/api/trades").then(r => r.json()),
  });

  const filtered = trades.filter(t => {
    const matchSearch = !search || t.ticker.includes(search.toUpperCase()) || (t.notes ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.action === filter;
    return matchSearch && matchFilter;
  });

  // Stats
  const totalBuys   = trades.filter(t => t.action === "buy").reduce((s, t) => s + t.total, 0);
  const totalSells  = trades.filter(t => t.action === "sell").reduce((s, t) => s + t.total, 0);
  const realizedPnL = totalSells - trades.filter(t => t.action === "sell").reduce((s, t) => s + t.shares * (trades.find(b => b.ticker === t.ticker && b.action === "buy")?.price ?? t.price), 0);

  // Unique tickers
  const uniqueTickers = [...new Set(trades.map(t => t.ticker))].sort();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Trade History</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">{trades.length} trades · {uniqueTickers.length} tickers</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Deployed",   value: `$${fmt(totalBuys)}`,            icon: TrendingUp,    color: "text-phantom-signal" },
          { label: "Total Sold",       value: `$${fmt(totalSells)}`,           icon: TrendingDown,  color: "text-phantom-ghost" },
          { label: "Total Trades",     value: trades.length,                   icon: History,       color: "text-phantom-amber" },
          { label: "Unique Tickers",   value: uniqueTickers.length,            icon: Filter,        color: "text-phantom-violet" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="phantom-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`font-mono text-xl font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Ticker filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTicker(null)}
          className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors ${!ticker ? "bg-phantom-signal text-white" : "text-phantom-ghost border border-phantom-border hover:border-phantom-signal/30"}`}>
          All
        </button>
        {uniqueTickers.map(t => (
          <button key={t} onClick={() => setTicker(ticker === t ? null : t)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors ${ticker === t ? "bg-phantom-signal/20 text-phantom-signal border border-phantom-signal/30" : "text-phantom-ghost border border-phantom-border hover:border-phantom-signal/30"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Search & filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-phantom-ghost" />
          <input className="input-phantom pl-9 w-full" placeholder="Search ticker or notes..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all","buy","sell"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors
                ${filter === f ? "bg-phantom-signal/20 text-phantom-signal border border-phantom-signal/30" : "btn-ghost"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Trades table */}
      <div className="phantom-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-phantom-border text-[10px] text-phantom-ghost uppercase tracking-widest">
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Ticker</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-right px-4 py-3 font-medium">Shares</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Fees</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-phantom-border/40 hover:bg-phantom-surface/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-phantom-ghost">{t.trade_date}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setTicker(ticker === t.ticker ? null : t.ticker)}
                      className="ticker-tag text-sm hover:text-phantom-signal transition-colors">
                      {t.ticker}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase
                      ${t.action === "buy" ? "nova-badge" : t.action === "sell" ? "pulse-badge" : "amber-badge"}`}>
                      {t.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-phantom-star">{t.shares}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-phantom-star">${fmt(t.price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-phantom-ghost">{t.fees > 0 ? `$${fmt(t.fees)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-phantom-star">${fmt(t.total)}</td>
                  <td className="px-5 py-3 text-xs text-phantom-ghost">{t.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-phantom-ghost text-sm">
              <History className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No trades found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
