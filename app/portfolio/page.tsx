"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Trash2, Edit3, TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import StockChart from "@/components/charts/StockChart";
import MomentumGauge from "@/components/charts/MomentumGauge";
import TickerSearch from "@/components/ui/TickerSearch";
import { showToast } from "@/components/ui/Toaster";
import type { Holding, Trade } from "@/lib/db/schema";
import type { QuoteData } from "@/lib/api/yahoo";
import Papa from "papaparse";

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

interface Position extends Holding {
  price:    number;
  value:    number;
  pnl:      number;
  pnlPct:   number;
  changePct: number;
  quote?:   QuoteData;
}

export default function Portfolio() {
  const qc = useQueryClient();
  const [selected, setSelected]     = useState<string | null>(null);
  const [addOpen, setAddOpen]        = useState(false);
  const [importOpen, setImportOpen]  = useState(false);
  const [newForm, setNewForm]        = useState({ ticker: "", shares: "", avg_cost: "", account: "brokerage", name: "" });
  const [tradeForm, setTradeForm]    = useState({ action: "buy", shares: "", price: "", fees: "0", date: new Date().toISOString().split("T")[0], notes: "" });
  const [activeTab, setActiveTab]    = useState<"overview" | "chart" | "targets" | "trades" | "news">("overview");

  const { data: holdings = [] } = useQuery<Holding[]>({
    queryKey: ["portfolio"],
    queryFn:  () => fetch("/api/portfolio").then(r => r.json()),
  });

  const tickers = holdings.map(h => h.ticker);
  const { data: quotes = {} } = useQuery<Record<string, QuoteData>>({
    queryKey: ["quotes", tickers.join(",")],
    queryFn:  () => tickers.length > 0 ? fetch(`/api/prices/quotes?tickers=${tickers.join(",")}`).then(r => r.json()) : {},
    enabled:  tickers.length > 0,
    refetchInterval: 30_000,
  });

  const { data: tickerTrades = [] } = useQuery<Trade[]>({
    queryKey: ["trades", selected],
    queryFn:  () => fetch(`/api/trades?ticker=${selected}`).then(r => r.json()),
    enabled:  !!selected && activeTab === "trades",
  });

  const { data: targets } = useQuery({
    queryKey: ["targets", selected],
    queryFn:  () => fetch(`/api/prices/ohlc?ticker=${selected}&period=1y`)
      .then(r => r.json())
      .then(async (bars: any[]) => {
        const { suggestStopLoss, suggestPriceTargets } = await import("@/lib/indicators");
        const q = quotes[selected!];
        return {
          stops:   suggestStopLoss(bars, q?.price ?? 0),
          targets: suggestPriceTargets(bars, q?.price ?? 0),
        };
      }),
    enabled: !!selected && activeTab === "targets",
  });

  const { data: tickerNews = [] } = useQuery({
    queryKey: ["news", selected],
    queryFn:  () => fetch(`/api/news?ticker=${selected}`).then(r => r.json()),
    enabled:  !!selected && activeTab === "news",
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["portfolio"] }); setAddOpen(false); setNewForm({ ticker: "", shares: "", avg_cost: "", account: "brokerage", name: "" }); showToast({ type: "success", title: "Position added" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch("/api/portfolio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["portfolio"] }); setSelected(null); showToast({ type: "success", title: "Position removed" }); },
  });

  const tradeMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["portfolio", "trades"] }); showToast({ type: "success", title: "Trade recorded" }); },
  });

  const positions: Position[] = holdings.map(h => {
    const q    = quotes[h.ticker];
    const price = q?.price ?? h.avg_cost;
    const value = h.shares * price;
    const cost  = h.shares * h.avg_cost;
    const pnl   = value - cost;
    return { ...h, price, value, pnl, pnlPct: cost > 0 ? (pnl/cost)*100 : 0, changePct: q?.change_pct ?? 0, quote: q };
  }).sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const sel = selected ? positions.find(p => p.ticker === selected) : null;

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>, fmt_: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: async (res) => {
        const resp = await fetch("/api/portfolio/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: fmt_, data: res.data }),
        });
        const data = await resp.json();
        if (data.ok) {
          qc.invalidateQueries({ queryKey: ["portfolio"] });
          setImportOpen(false);
          showToast({ type: "success", title: `Imported ${data.imported} positions` });
        }
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Portfolio</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">
            {positions.length} positions · ${fmt(totalValue)} total value
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-ghost flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Position
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Position list */}
        <div className="lg:col-span-1 phantom-card overflow-hidden">
          <div className="px-4 py-3 border-b border-phantom-border">
            <span className="text-xs font-semibold text-phantom-star uppercase tracking-wider">Positions</span>
          </div>
          <div className="overflow-y-auto max-h-[70vh]">
            {positions.map(p => (
              <button key={p.ticker}
                onClick={() => { setSelected(p.ticker); setActiveTab("overview"); }}
                className={`w-full flex items-center justify-between px-4 py-3 border-b border-phantom-border/40 text-left transition-all
                  ${selected === p.ticker ? "bg-phantom-signal/10 border-l-2 border-l-phantom-signal" : "hover:bg-phantom-surface/50"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-phantom-muted flex items-center justify-center text-[11px] font-mono font-bold text-phantom-silver flex-shrink-0">
                    {p.ticker.slice(0,2)}
                  </div>
                  <div>
                    <div className="ticker-tag text-sm">{p.ticker}</div>
                    <div className="text-[10px] text-phantom-ghost">{p.shares} sh · ${fmt(p.value)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-phantom-star">${fmt(p.price)}</div>
                  <div className={`text-[10px] font-mono ${p.changePct >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}`}>
                    {p.changePct >= 0 ? "+" : ""}{fmt(p.changePct)}%
                  </div>
                </div>
              </button>
            ))}
            {positions.length === 0 && (
              <div className="p-8 text-center text-phantom-ghost text-sm">
                No positions. Add or import.
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {sel ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="phantom-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-mono font-bold text-phantom-star">{sel.ticker}</h2>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${sel.changePct >= 0 ? "nova-badge" : "pulse-badge"}`}>
                        {sel.changePct >= 0 ? "+" : ""}{fmt(sel.changePct)}%
                      </span>
                    </div>
                    <div className="text-phantom-ghost text-sm mt-0.5">{sel.name || sel.quote?.name}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (confirm(`Remove ${sel.ticker} from portfolio?`)) deleteMutation.mutate(sel.id); }}
                      className="btn-danger p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                  {[
                    { label: "Current Price",  value: `$${fmt(sel.price)}`,     color: "text-phantom-star" },
                    { label: "Avg Cost",       value: `$${fmt(sel.avg_cost)}`,  color: "text-phantom-ghost" },
                    { label: "Total Value",    value: `$${fmt(sel.value)}`,     color: "text-phantom-star" },
                    { label: "Total P&L",      value: `${sel.pnl >= 0 ? "+" : ""}$${fmt(sel.pnl)} (${sel.pnlPct >= 0?"+":""}${fmt(sel.pnlPct)}%)`, color: sel.pnl >= 0 ? "text-phantom-nova" : "text-phantom-pulse" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="stat-label">{label}</div>
                      <div className={`font-mono font-semibold mt-1 ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Momentum */}
              <MomentumGauge ticker={sel.ticker} />

              {/* Tabs */}
              <div className="flex gap-1 border-b border-phantom-border overflow-x-auto">
                {(["overview","chart","targets","trades","news"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-xs font-medium capitalize whitespace-nowrap transition-colors
                      ${activeTab === tab ? "text-phantom-signal border-b-2 border-phantom-signal" : "text-phantom-ghost hover:text-phantom-silver"}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "overview" && (
                <div className="phantom-card p-5 grid grid-cols-2 gap-4">
                  {sel.quote && ([
                    { label: "Day High",     value: `$${fmt(sel.quote.high)}` },
                    { label: "Day Low",      value: `$${fmt(sel.quote.low)}` },
                    { label: "Open",         value: `$${fmt(sel.quote.open)}` },
                    { label: "Prev Close",   value: `$${fmt(sel.quote.prev_close)}` },
                    { label: "52W High",     value: `$${fmt(sel.quote.week52_high)}` },
                    { label: "52W Low",      value: `$${fmt(sel.quote.week52_low)}` },
                    { label: "Volume",       value: sel.quote.volume.toLocaleString() },
                    { label: "Avg Volume",   value: sel.quote.avg_volume.toLocaleString() },
                    { label: "Market Cap",   value: sel.quote.mkt_cap >= 1e9 ? `$${(sel.quote.mkt_cap/1e9).toFixed(1)}B` : `$${(sel.quote.mkt_cap/1e6).toFixed(0)}M` },
                    { label: "P/E Ratio",    value: sel.quote.pe_ratio ? fmt(sel.quote.pe_ratio) : "—" },
                    { label: "EPS (TTM)",    value: sel.quote.eps ? `$${fmt(sel.quote.eps)}` : "—" },
                    { label: "Beta",         value: sel.quote.beta ? fmt(sel.quote.beta) : "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="stat-label">{label}</div>
                      <div className="font-mono text-sm text-phantom-star mt-0.5">{value}</div>
                    </div>
                  )))}

                  {/* Quick trade */}
                  <div className="col-span-2 phantom-divider pt-4 mt-2">
                    <div className="text-xs font-semibold text-phantom-star uppercase tracking-wider mb-3">Log Trade</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <select value={tradeForm.action} onChange={e => setTradeForm(f => ({...f, action: e.target.value}))}
                        className="input-phantom text-xs">
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                        <option value="dividend">Dividend</option>
                      </select>
                      <input className="input-phantom text-xs" placeholder="Shares" type="number" value={tradeForm.shares}
                        onChange={e => setTradeForm(f => ({...f, shares: e.target.value}))} />
                      <input className="input-phantom text-xs" placeholder="Price" type="number" value={tradeForm.price}
                        onChange={e => setTradeForm(f => ({...f, price: e.target.value}))} />
                      <input className="input-phantom text-xs" placeholder="Fees" type="number" value={tradeForm.fees}
                        onChange={e => setTradeForm(f => ({...f, fees: e.target.value}))} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input type="date" className="input-phantom text-xs flex-1" value={tradeForm.date}
                        onChange={e => setTradeForm(f => ({...f, date: e.target.value}))} />
                      <button className="btn-primary text-xs px-4"
                        onClick={() => tradeMutation.mutate({ ticker: sel.ticker, ...tradeForm })}>
                        Record
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chart" && (
                <div className="phantom-card p-5">
                  <StockChart ticker={sel.ticker} height={350} showAVWAP showMA />
                </div>
              )}

              {activeTab === "targets" && (
                <div className="space-y-4">
                  {/* Stop losses */}
                  <div className="phantom-card p-5">
                    <h3 className="text-xs font-semibold text-phantom-star uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-phantom-pulse" /> Stop Loss Suggestions
                    </h3>
                    <div className="space-y-2">
                      {targets?.stops?.map((s: any) => (
                        <div key={s.method} className="flex items-center justify-between py-2 border-b border-phantom-border/40">
                          <div>
                            <div className="text-xs font-semibold text-phantom-star">{s.method}</div>
                            <div className="text-[10px] text-phantom-ghost mt-0.5">{s.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm text-phantom-pulse">${fmt(s.price)}</div>
                            <div className="text-[10px] text-phantom-ghost">{fmt(s.pct_below)}% below</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price targets */}
                  <div className="phantom-card p-5">
                    <h3 className="text-xs font-semibold text-phantom-star uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-phantom-nova" /> Price Targets
                    </h3>
                    <div className="space-y-2">
                      {targets?.targets?.map((t: any) => (
                        <div key={t.method} className="flex items-center justify-between py-2 border-b border-phantom-border/40">
                          <div>
                            <div className="text-xs font-semibold text-phantom-star">{t.method}</div>
                            <div className="text-[10px] text-phantom-ghost mt-0.5">{t.timeframe} · {t.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm text-phantom-nova">${fmt(t.price)}</div>
                            <div className="text-[10px] text-phantom-ghost">+{fmt(t.pct_upside)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "trades" && (
                <div className="phantom-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-phantom-border">
                    <span className="text-xs font-semibold text-phantom-star uppercase tracking-wider">{sel.ticker} Trade History</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-phantom-border text-[10px] text-phantom-ghost uppercase tracking-widest">
                          <th className="text-left px-4 py-2 font-medium">Date</th>
                          <th className="text-left px-4 py-2 font-medium">Action</th>
                          <th className="text-right px-4 py-2 font-medium">Shares</th>
                          <th className="text-right px-4 py-2 font-medium">Price</th>
                          <th className="text-right px-4 py-2 font-medium">Total</th>
                          <th className="text-left px-4 py-2 font-medium">Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickerTrades.map(t => (
                          <tr key={t.id} className="border-b border-phantom-border/40 hover:bg-phantom-surface/40">
                            <td className="px-4 py-2.5 font-mono text-phantom-ghost">{t.trade_date}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${t.action === "buy" ? "nova-badge" : t.action === "sell" ? "pulse-badge" : "amber-badge"}`}>
                                {t.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-phantom-star">{t.shares}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-phantom-star">${fmt(t.price)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-phantom-star">${fmt(t.total)}</td>
                            <td className="px-4 py-2.5 text-phantom-ghost">{t.account}</td>
                          </tr>
                        ))}
                        {tickerTrades.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-6 text-center text-phantom-ghost">No trade history</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "news" && (
                <div className="phantom-card overflow-hidden">
                  <div className="divide-y divide-phantom-border/40">
                    {(tickerNews as any[]).map((n: any, i: number) => (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                        className="block p-4 hover:bg-phantom-surface/40 group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                            ${n.sentiment === "positive" ? "text-phantom-nova bg-phantom-nova/10" : n.sentiment === "negative" ? "text-phantom-pulse bg-phantom-pulse/10" : "text-phantom-ghost bg-phantom-ghost/10"}`}>
                            {n.sentiment}
                          </span>
                          <span className="text-[10px] text-phantom-ghost">{n.source} · {new Date(n.published).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-phantom-star group-hover:text-phantom-signal transition-colors">{n.headline}</div>
                        {n.summary && <div className="text-[10px] text-phantom-ghost mt-1 line-clamp-2">{n.summary}</div>}
                      </a>
                    ))}
                    {tickerNews.length === 0 && <div className="p-6 text-center text-phantom-ghost text-sm">No news. Configure Finnhub API key in Settings.</div>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 phantom-card">
              <div className="text-center text-phantom-ghost">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="text-sm">Select a position to view details</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add position modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="phantom-card-elevated w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-phantom-star mb-5">Add Position</h2>
            <div className="space-y-3">
              <TickerSearch
                placeholder="Search ticker..."
                onSelect={(ticker, name) => setNewForm(f => ({...f, ticker, name}))}
              />
              {newForm.ticker && <div className="nova-badge w-fit">{newForm.ticker} — {newForm.name}</div>}
              <div className="grid grid-cols-2 gap-3">
                <input className="input-phantom" placeholder="Shares" type="number" value={newForm.shares}
                  onChange={e => setNewForm(f => ({...f, shares: e.target.value}))} />
                <input className="input-phantom" placeholder="Avg Cost $" type="number" value={newForm.avg_cost}
                  onChange={e => setNewForm(f => ({...f, avg_cost: e.target.value}))} />
              </div>
              <select className="input-phantom w-full" value={newForm.account}
                onChange={e => setNewForm(f => ({...f, account: e.target.value}))}>
                <option value="brokerage">Brokerage</option>
                <option value="roth_ira">Roth IRA</option>
                <option value="traditional_ira">Traditional IRA</option>
                <option value="robinhood">Robinhood</option>
                <option value="fidelity">Fidelity</option>
                <option value="coinbase">Coinbase</option>
                <option value="ledger">Ledger (BTC)</option>
              </select>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={() => addMutation.mutate({ ticker: newForm.ticker.toUpperCase(), name: newForm.name, shares: parseFloat(newForm.shares), avg_cost: parseFloat(newForm.avg_cost), account: newForm.account, asset_type: "stock", notes: null })}
                  className="btn-primary flex-1" disabled={!newForm.ticker || !newForm.shares || !newForm.avg_cost}>
                  Add Position
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="phantom-card-elevated w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-phantom-star mb-2">Import Portfolio</h2>
            <p className="text-xs text-phantom-ghost mb-5">Upload a CSV file from your broker. Cost basis is preserved.</p>
            <div className="space-y-3">
              {[
                { label: "Fidelity CSV", fmt: "fidelity", desc: "Export from Fidelity Positions page" },
                { label: "Robinhood CSV", fmt: "robinhood", desc: "Export from Robinhood account" },
                { label: "Coinbase CSV", fmt: "coinbase", desc: "Export from Coinbase transaction history" },
                { label: "Generic CSV", fmt: "generic", desc: "Columns: ticker, shares, avg_cost, account" },
                { label: "Trade History", fmt: "trades", desc: "Columns: ticker, action, shares, price, date" },
              ].map(({ label, fmt: f, desc }) => (
                <label key={f} className="flex items-center justify-between p-3 phantom-card cursor-pointer hover:bg-phantom-surface/50 transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-phantom-star">{label}</div>
                    <div className="text-[10px] text-phantom-ghost">{desc}</div>
                  </div>
                  <div className="relative">
                    <input type="file" accept=".csv" className="sr-only" onChange={e => handleImportCSV(e, f)} />
                    <span className="text-xs text-phantom-signal border border-phantom-signal/30 px-3 py-1 rounded-lg hover:bg-phantom-signal/10 transition-colors">Upload</span>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={() => setImportOpen(false)} className="btn-ghost w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
