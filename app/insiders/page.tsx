"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import TickerSearch from "@/components/ui/TickerSearch";
import type { InsiderTrade } from "@/lib/api/insiders";

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtK(n: number) { if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; return `$${n.toLocaleString()}`; }

export default function Insiders() {
  const [ticker,  setTicker]  = useState("AAPL");
  const [tabMode, setTabMode] = useState<"insider" | "institutional">("insider");

  const { data: insiders = [], isLoading: loadIns } = useQuery<InsiderTrade[]>({
    queryKey:  ["insiders", ticker],
    queryFn:   () => fetch(`/api/insiders?ticker=${ticker}&type=insider`).then(r => r.json()),
    enabled:   !!ticker,
    staleTime: 3600_000,
  });

  const { data: institutional = [], isLoading: loadInst } = useQuery<any[]>({
    queryKey:  ["institutional", ticker],
    queryFn:   () => fetch(`/api/insiders?ticker=${ticker}&type=institutional`).then(r => r.json()),
    enabled:   !!ticker && tabMode === "institutional",
    staleTime: 3600_000,
  });

  const buyVolume  = insiders.filter(t => t.action === "buy").reduce((s, t) => s + t.value, 0);
  const sellVolume = insiders.filter(t => t.action === "sell").reduce((s, t) => s + t.value, 0);
  const netSentiment = buyVolume / (buyVolume + sellVolume + 1) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Insider & Institutional Tracking</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">SEC Form 4, Form 13F, OpenInsider data</p>
        </div>
        <TickerSearch
          className="w-64"
          placeholder="Search ticker..."
          onSelect={(t) => setTicker(t)}
        />
      </div>

      {ticker && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="phantom-card p-4">
              <div className="stat-label mb-1">Ticker</div>
              <div className="text-2xl font-mono font-bold text-phantom-star">{ticker}</div>
            </div>
            <div className="phantom-card p-4">
              <div className="stat-label mb-1">Insider Buys</div>
              <div className="text-xl font-mono font-semibold text-phantom-nova">{insiders.filter(t => t.action === "buy").length}</div>
              <div className="text-xs text-phantom-ghost">{fmtK(buyVolume)}</div>
            </div>
            <div className="phantom-card p-4">
              <div className="stat-label mb-1">Insider Sells</div>
              <div className="text-xl font-mono font-semibold text-phantom-pulse">{insiders.filter(t => t.action === "sell").length}</div>
              <div className="text-xs text-phantom-ghost">{fmtK(sellVolume)}</div>
            </div>
            <div className="phantom-card p-4">
              <div className="stat-label mb-1">Buy Sentiment</div>
              <div className="text-xl font-mono font-semibold" style={{ color: netSentiment > 60 ? "#00FF88" : netSentiment < 40 ? "#FF3B5C" : "#F59E0B" }}>
                {fmt(netSentiment)}%
              </div>
              <div className="text-xs text-phantom-ghost">of insider activity</div>
            </div>
          </div>

          {/* Sentiment bar */}
          <div className="phantom-card p-4">
            <div className="flex items-center justify-between mb-2 text-xs text-phantom-ghost">
              <span>Insider Selling</span>
              <span>Insider Buying</span>
            </div>
            <div className="h-2 bg-phantom-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${netSentiment}%`, background: "linear-gradient(to right, #FF3B5C, #00FF88)" }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-phantom-border">
            {(["insider","institutional"] as const).map(t => (
              <button key={t} onClick={() => setTabMode(t)}
                className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors
                  ${tabMode === t ? "text-phantom-signal border-b-2 border-phantom-signal" : "text-phantom-ghost hover:text-phantom-silver"}`}>
                {t === "insider" ? "Insider Transactions (Form 4)" : "Institutional Holders (13F)"}
              </button>
            ))}
          </div>

          {tabMode === "insider" && (
            <div className="phantom-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-phantom-border text-[10px] text-phantom-ghost uppercase tracking-widest">
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Insider</th>
                      <th className="text-left px-4 py-3 font-medium">Title</th>
                      <th className="text-left px-4 py-3 font-medium">Action</th>
                      <th className="text-right px-4 py-3 font-medium">Shares</th>
                      <th className="text-right px-4 py-3 font-medium">Price</th>
                      <th className="text-right px-4 py-3 font-medium">Value</th>
                      <th className="text-left px-4 py-3 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadIns ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-phantom-ghost animate-pulse">Loading...</td></tr>
                    ) : insiders.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-phantom-ghost">No insider data. Configure Finnhub API key for richer data.</td></tr>
                    ) : insiders.map((t, i) => (
                      <tr key={i} className="border-b border-phantom-border/40 hover:bg-phantom-surface/40">
                        <td className="px-4 py-3 font-mono text-phantom-ghost">{t.trade_date || t.filing_date}</td>
                        <td className="px-4 py-3 font-semibold text-phantom-star">{t.name}</td>
                        <td className="px-4 py-3 text-phantom-ghost truncate max-w-[120px]">{t.title || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${t.action === "buy" ? "nova-badge" : t.action === "sell" ? "pulse-badge" : "amber-badge"}`}>
                            {t.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{(t.shares ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{t.price > 0 ? `$${fmt(t.price)}` : "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{t.value > 0 ? fmtK(t.value) : "—"}</td>
                        <td className="px-4 py-3 text-[10px] text-phantom-ghost">{t.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tabMode === "institutional" && (
            <div className="phantom-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-phantom-border text-[10px] text-phantom-ghost uppercase tracking-widest">
                      <th className="text-left px-4 py-3 font-medium">Institution</th>
                      <th className="text-right px-4 py-3 font-medium">Shares</th>
                      <th className="text-right px-4 py-3 font-medium">% Held</th>
                      <th className="text-right px-4 py-3 font-medium">Value</th>
                      <th className="text-right px-4 py-3 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadInst ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-phantom-ghost animate-pulse">Loading...</td></tr>
                    ) : institutional.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-phantom-ghost">No institutional data available</td></tr>
                    ) : institutional.map((h: any, i: number) => (
                      <tr key={i} className="border-b border-phantom-border/40 hover:bg-phantom-surface/40">
                        <td className="px-4 py-3 font-semibold text-phantom-star flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-phantom-ghost" /> {h.name}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{(h.shares ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{fmt(h.pct_held * 100)}%</td>
                        <td className="px-4 py-3 text-right font-mono text-phantom-star">{fmtK(h.value)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={h.change >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}>
                            {h.change >= 0 ? "+" : ""}{(h.change ?? 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-phantom-ghost/60 text-center">
            Data sourced from SEC EDGAR, OpenInsider, and Finnhub. Configure Finnhub API key in Settings for richer data.
          </div>
        </>
      )}
    </div>
  );
}
