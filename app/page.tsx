"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity, DollarSign, BarChart2, Newspaper } from "lucide-react";
import type { QuoteData } from "@/lib/api/yahoo";
import type { NewsItem } from "@/lib/api/news";
import type { Holding } from "@/lib/db/schema";

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtK(n: number) { if (n >= 1e9) return (n/1e9).toFixed(1)+"B"; if (n >= 1e6) return (n/1e6).toFixed(1)+"M"; return n.toLocaleString(); }

export default function Dashboard() {
  const { data: holdings = [] } = useQuery<Holding[]>({
    queryKey: ["portfolio"],
    queryFn:  () => fetch("/api/portfolio").then(r => r.json()),
  });

  const tickers = holdings.map(h => h.ticker);

  const { data: quotes = {} } = useQuery<Record<string, QuoteData>>({
    queryKey: ["quotes", tickers.join(",")],
    queryFn:  () => holdings.length > 0
      ? fetch(`/api/prices/quotes?tickers=${tickers.join(",")}`).then(r => r.json())
      : Promise.resolve({}),
    enabled: holdings.length > 0,
    refetchInterval: 30_000,
  });

  const { data: news = [] } = useQuery<NewsItem[]>({
    queryKey: ["market-news"],
    queryFn:  () => fetch("/api/news?q=stock+market+today").then(r => r.json()),
    staleTime: 300_000,
  });

  const { data: alertLog = [] } = useQuery<any[]>({
    queryKey: ["alert-log"],
    queryFn:  () => fetch("/api/alerts?log=1").then(r => r.json()),
    staleTime: 30_000,
  });

  // Derive market state from any available quote
  const anyQuote  = Object.values(quotes)[0];
  const marketState = anyQuote?.marketState ?? "REGULAR";
  const isExtended  = marketState === "PRE" || marketState === "POST" || marketState === "CLOSED";

  const positions = holdings.map(h => {
    const q = quotes[h.ticker];
    // Use extended-hours price when applicable
    const extPrice = q?.marketState === "PRE"
      ? (q.preMarketPrice ?? q?.price)
      : (q?.marketState === "POST" || q?.marketState === "CLOSED")
      ? (q.postMarketPrice ?? q?.price)
      : q?.price;
    const price     = extPrice ?? h.avg_cost;
    const value     = h.shares * price;
    const cost      = h.shares * h.avg_cost;
    const pnl       = value - cost;
    const pnlPct    = cost > 0 ? (pnl / cost) * 100 : 0;
    const changePct = q?.marketState === "PRE"
      ? (q.preMarketChangePct ?? q?.change_pct ?? 0)
      : (q?.marketState === "POST" || q?.marketState === "CLOSED")
      ? (q.postMarketChangePct ?? q?.change_pct ?? 0)
      : (q?.change_pct ?? 0);
    return { ...h, price, value, cost, pnl, pnlPct, changePct, change: q?.change ?? 0 };
  });

  const totalValue   = positions.reduce((s, p) => s + p.value, 0);
  const totalCost    = positions.reduce((s, p) => s + p.cost, 0);
  const totalPnL     = totalValue - totalCost;
  const totalPnLPct  = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const dayChange    = positions.reduce((s, p) => s + (p.value - p.value / (1 + p.changePct / 100)), 0);
  const dayChangePct = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;
  const movers       = [...positions].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Dashboard</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">Portfolio intelligence at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {isExtended ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#F59E0B]/30 text-[#F59E0B] bg-[#F59E0B]/10">
              {marketState === "PRE" ? "PRE-MARKET" : marketState === "POST" ? "AFTER-HOURS" : "CLOSED"}
            </span>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-[#00D472] animate-pulse" />
              <span className="text-xs text-[#7A8195] font-mono">Market Open</span>
            </>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Portfolio Value", value: `$${fmt(totalValue)}`, sub: `${holdings.length} positions`, icon: DollarSign, color: "text-phantom-signal" },
          { label: "Total P&L", value: `${totalPnL >= 0 ? "+" : ""}$${fmt(Math.abs(totalPnL))}`, sub: `${totalPnLPct >= 0 ? "+" : ""}${fmt(totalPnLPct)}% all-time`, icon: totalPnL >= 0 ? TrendingUp : TrendingDown, color: totalPnL >= 0 ? "text-phantom-nova" : "text-phantom-pulse" },
          { label: "Today", value: `${dayChange >= 0 ? "+" : ""}$${fmt(Math.abs(dayChange))}`, sub: `${dayChangePct >= 0 ? "+" : ""}${fmt(dayChangePct)}% today`, icon: Activity, color: dayChange >= 0 ? "text-phantom-nova" : "text-phantom-pulse" },
          { label: "Alert Triggers", value: alertLog.length, sub: "All time", icon: AlertTriangle, color: "text-phantom-amber" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="phantom-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="stat-label">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`text-2xl font-mono font-semibold ${color}`}>{value}</div>
            <div className="text-xs text-phantom-ghost mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings table */}
        <div className="lg:col-span-2 phantom-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-phantom-border">
            <h2 className="text-sm font-semibold text-phantom-star flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-phantom-signal" /> Holdings
            </h2>
            <Link href="/portfolio" className="text-xs text-phantom-ghost hover:text-phantom-signal transition-colors">View all →</Link>
          </div>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <BarChart2 className="w-8 h-8 text-phantom-ghost mb-3" />
              <div className="text-sm text-phantom-ghost">No positions yet</div>
              <Link href="/portfolio" className="mt-3 btn-primary text-sm">Import Portfolio</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-phantom-ghost uppercase tracking-widest border-b border-phantom-border">
                    <th className="text-left px-5 py-3 font-medium">Ticker</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-right px-4 py-3 font-medium">Today</th>
                    <th className="text-right px-4 py-3 font-medium">Value</th>
                    <th className="text-right px-5 py-3 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => (
                    <tr key={p.id} className="border-b border-phantom-border/40 hover:bg-phantom-surface/50 transition-colors group">
                      <td className="px-5 py-3">
                        <Link href={`/portfolio?ticker=${p.ticker}`} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-phantom-muted flex items-center justify-center text-[10px] font-mono font-bold text-phantom-silver">
                            {p.ticker.slice(0,2)}
                          </div>
                          <div>
                            <div className="ticker-tag group-hover:text-phantom-signal transition-colors">{p.ticker}</div>
                            <div className="text-[10px] text-phantom-ghost">{p.shares} sh · avg ${fmt(p.avg_cost)}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-phantom-star">${fmt(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`flex items-center justify-end gap-0.5 font-mono text-sm ${p.changePct >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}`}>
                          {p.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(p.changePct).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-phantom-star">${fmtK(p.value)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-mono text-sm ${p.pnl >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}`}>
                          {p.pnl >= 0 ? "+" : ""}${fmt(p.pnl)} ({p.pnlPct >= 0 ? "+" : ""}{fmt(p.pnlPct)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Movers */}
          <div className="phantom-card overflow-hidden">
            <div className="px-4 py-3 border-b border-phantom-border">
              <h2 className="text-xs font-semibold text-phantom-star uppercase tracking-wider">Top Movers</h2>
            </div>
            {movers.length === 0
              ? <div className="p-4 text-xs text-phantom-ghost text-center">Add positions to see movers</div>
              : <div className="divide-y divide-phantom-border/40">
                  {movers.map(m => (
                    <div key={m.ticker} className="flex items-center justify-between px-4 py-2.5 hover:bg-phantom-surface/40">
                      <div>
                        <div className="ticker-tag text-xs">{m.ticker}</div>
                        <div className="text-[10px] text-phantom-ghost font-mono">${fmt(m.price)}</div>
                      </div>
                      <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${m.changePct >= 0 ? "bg-phantom-nova/10 text-phantom-nova" : "bg-phantom-pulse/10 text-phantom-pulse"}`}>
                        {m.changePct >= 0 ? "+" : ""}{fmt(m.changePct)}%
                      </span>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Alert log */}
          <div className="phantom-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-phantom-border">
              <h2 className="text-xs font-semibold text-phantom-star uppercase tracking-wider">Recent Alerts</h2>
              <Link href="/alerts" className="text-xs text-phantom-ghost hover:text-phantom-signal">View →</Link>
            </div>
            {alertLog.length === 0
              ? <div className="p-4 text-xs text-phantom-ghost text-center">No alerts triggered</div>
              : <div className="divide-y divide-phantom-border/40">
                  {(alertLog as any[]).slice(0,4).map((a: any) => (
                    <div key={a.id} className="px-4 py-2.5 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-phantom-amber mt-1.5 flex-shrink-0 animate-pulse" />
                      <div>
                        <div className="text-xs text-phantom-star font-mono">{a.ticker} · {a.alert_type?.replace(/_/g," ")}</div>
                        <div className="text-[10px] text-phantom-ghost mt-0.5 line-clamp-1">{a.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

      {/* News */}
      <div className="phantom-card overflow-hidden">
        <div className="px-5 py-4 border-b border-phantom-border">
          <h2 className="text-sm font-semibold text-phantom-star flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-phantom-signal" /> Market News
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {news.slice(0, 6).map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
              className={`block p-4 hover:bg-phantom-surface/40 transition-colors group ${i < 5 ? "border-b md:border-b-0 md:border-r border-phantom-border/40" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide
                  ${n.sentiment === "positive" ? "bg-phantom-nova/10 text-phantom-nova"
                    : n.sentiment === "negative" ? "bg-phantom-pulse/10 text-phantom-pulse"
                    : "bg-phantom-ghost/10 text-phantom-ghost"}`}>
                  {n.sentiment}
                </span>
                <span className="text-[10px] text-phantom-ghost truncate">{n.source}</span>
              </div>
              <h3 className="text-xs font-medium text-phantom-star group-hover:text-phantom-signal transition-colors line-clamp-3 leading-relaxed">
                {n.headline}
              </h3>
              <div className="text-[10px] text-phantom-ghost/60 mt-2">{new Date(n.published).toLocaleDateString()}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
