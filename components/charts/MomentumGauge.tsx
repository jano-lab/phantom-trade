"use client";
import { useQuery } from "@tanstack/react-query";
import type { AccelerationSignal } from "@/lib/indicators";
import { TrendingDown, TrendingUp, AlertTriangle, Zap } from "lucide-react";

interface Props { ticker: string; }

const severityConfig = {
  none:     { color: "#7C8B9E", label: "Normal",   bg: "bg-phantom-ghost/10" },
  warning:  { color: "#F59E0B", label: "Warning",  bg: "bg-phantom-amber/10" },
  danger:   { color: "#FF3B5C", label: "Danger",   bg: "bg-phantom-pulse/10" },
  critical: { color: "#FF3B5C", label: "Critical", bg: "bg-phantom-pulse/20" },
};

export default function MomentumGauge({ ticker }: Props) {
  const { data: sig } = useQuery<AccelerationSignal | null>({
    queryKey:       ["acceleration", ticker],
    queryFn:        () => fetch(`/api/prices/acceleration?ticker=${ticker}`).then(r => r.json()),
    staleTime:      10_000,
    refetchInterval: 10_000,
  });

  if (!sig) return null;

  const cfg = severityConfig[sig.severity];
  const gaugeValue = Math.min(100, Math.abs(sig.projected5) * 10); // 0-100
  const gaugeColor = sig.direction === "down" ? "#FF3B5C" : "#00FF88";

  return (
    <div className={`phantom-card p-4 ${sig.severity !== "none" ? cfg.bg + " border-current" : ""}`}
         style={sig.severity !== "none" ? { borderColor: cfg.color + "40" } : {}}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {sig.direction === "down"
            ? <TrendingDown className="w-4 h-4 text-phantom-pulse" />
            : sig.direction === "up"
            ? <TrendingUp className="w-4 h-4 text-phantom-nova" />
            : <Zap className="w-4 h-4 text-phantom-ghost" />}
          <span className="text-xs font-mono font-semibold text-phantom-star">{ticker} MOMENTUM</span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded border"
              style={{ color: cfg.color, borderColor: cfg.color + "40", background: cfg.color + "15" }}>
          {cfg.label.toUpperCase()}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-1.5 bg-phantom-muted rounded-full mb-3 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${gaugeValue}%`, background: gaugeColor, boxShadow: `0 0 8px ${gaugeColor}60` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-phantom-ghost uppercase tracking-wider">1min rate</div>
          <div className="font-mono text-sm font-semibold" style={{ color: sig.rate1min < 0 ? "#FF3B5C" : "#00FF88" }}>
            {sig.rate1min > 0 ? "+" : ""}{sig.rate1min.toFixed(2)}%/m
          </div>
        </div>
        <div>
          <div className="text-[10px] text-phantom-ghost uppercase tracking-wider">Accel</div>
          <div className="font-mono text-sm font-semibold text-phantom-amber">
            {sig.acceleration > 0 ? "+" : ""}{sig.acceleration.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-phantom-ghost uppercase tracking-wider">Proj 5min</div>
          <div className="font-mono text-sm font-semibold" style={{ color: sig.projected5 < 0 ? "#FF3B5C" : "#00FF88" }}>
            {sig.projected5 > 0 ? "+" : ""}{sig.projected5.toFixed(1)}%
          </div>
        </div>
      </div>

      {sig.severity === "danger" || sig.severity === "critical" ? (
        <div className="mt-3 flex items-start gap-2 bg-phantom-pulse/10 border border-phantom-pulse/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-phantom-pulse flex-shrink-0 mt-0.5" />
          <span className="text-xs text-phantom-pulse">
            {sig.direction === "down"
              ? `Rapid deceleration detected. Consider partial exit. Proj move: ${sig.projected5.toFixed(1)}%`
              : `Strong upward acceleration. Monitor for reversal.`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
