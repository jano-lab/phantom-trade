"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, X, RefreshCw, TrendingUp, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";

const categoryConfig: Record<string, { icon: typeof Brain; color: string; bg: string }> = {
  portfolio:   { icon: Brain,         color: "text-phantom-violet", bg: "bg-phantom-violet/10" },
  risk:        { icon: AlertTriangle, color: "text-phantom-pulse",  bg: "bg-phantom-pulse/10" },
  trade:       { icon: TrendingUp,    color: "text-phantom-signal", bg: "bg-phantom-signal/10" },
  opportunity: { icon: Lightbulb,     color: "text-phantom-amber",  bg: "bg-phantom-amber/10" },
};

const severityBadge: Record<string, string> = {
  info:    "signal-badge",
  warning: "amber-badge",
  error:   "pulse-badge",
};

export default function Insights() {
  const qc = useQueryClient();

  const { data: insights = [], isLoading } = useQuery<any[]>({
    queryKey: ["insights"],
    queryFn:  () => fetch("/api/insights").then(r => r.json()),
    staleTime: 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch("/api/insights?refresh=1").then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(["insights"], data);
      showToast({ type: "success", title: "Insights refreshed", message: `${data.length} insights generated` });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => fetch("/api/insights", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });

  const grouped = insights.reduce((acc: Record<string, any[]>, ins: any) => {
    const cat = ins.category ?? "portfolio";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ins);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-phantom-star">Portfolio Insights</h1>
          <p className="text-sm text-phantom-ghost mt-0.5">AI-driven analysis of your holdings and trades</p>
        </div>
        <button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}
          className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh Insights
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-phantom-ghost text-sm animate-pulse">Analyzing portfolio...</div>
        </div>
      )}

      {!isLoading && insights.length === 0 && (
        <div className="phantom-card p-12 text-center">
          <Brain className="w-12 h-12 text-phantom-ghost mx-auto mb-4 opacity-30" />
          <h3 className="text-sm font-semibold text-phantom-star">No insights yet</h3>
          <p className="text-xs text-phantom-ghost mt-2">Add positions to your portfolio and click "Refresh Insights" to generate analysis.</p>
          <button onClick={() => refreshMutation.mutate()} className="mt-4 btn-primary text-sm">Generate Insights</button>
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => {
        const cfg = categoryConfig[category] ?? categoryConfig.portfolio;
        const Icon = cfg.icon;
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <h2 className="text-xs font-semibold text-phantom-star uppercase tracking-wider capitalize">{category}</h2>
              <span className="text-xs text-phantom-ghost">({items.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((ins: any) => {
                const cfg2 = categoryConfig[ins.category] ?? categoryConfig.portfolio;
                const Icon2 = cfg2.icon;
                return (
                  <div key={ins.id}
                    className={`phantom-card p-5 border-l-2 ${ins.severity === "warning" ? "border-l-phantom-amber" : ins.severity === "error" ? "border-l-phantom-pulse" : "border-l-phantom-signal"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${cfg2.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon2 className={`w-4 h-4 ${cfg2.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-phantom-star">{ins.title}</h3>
                            <span className={`text-[10px] ${severityBadge[ins.severity] ?? "signal-badge"}`}>{ins.severity}</span>
                            {ins.ticker && <span className="ticker-tag text-xs">{ins.ticker}</span>}
                          </div>
                          <p className="text-xs text-phantom-ghost leading-relaxed">{ins.body}</p>
                          <div className="text-[10px] text-phantom-ghost/50 mt-2">
                            {new Date(ins.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => dismissMutation.mutate(ins.id)}
                        className="p-1.5 text-phantom-ghost hover:text-phantom-star flex-shrink-0 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Framework info */}
      <div className="phantom-card p-5 border border-phantom-signal/20">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-phantom-signal" />
          <h3 className="text-xs font-semibold text-phantom-star uppercase tracking-wider">Analysis Framework</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-phantom-ghost">
          {[
            "Concentration risk: flags positions >20% of portfolio",
            "Loser review: flags positions down >15% from cost",
            "Winner trim: suggests locking gains at >50% up",
            "Trade timing: compares exit prices vs. subsequent performance",
            "Diversification: checks sector/asset-type spread",
            "AVWAP signals: identifies reclaim/loss events from indicator engine",
            "Momentum: uses acceleration derivative to flag fast-moving stocks",
            "Insider activity: integrates SEC Form 4 data in Insiders tab",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-phantom-signal mt-0.5">·</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
