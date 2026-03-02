"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IntradayMeta, OHLCBar } from "@/lib/api/yahoo";

type Period = "1d" | "1mo" | "3mo" | "6mo" | "1y" | "2y";
const PERIODS: Period[] = ["1d", "1mo", "3mo", "6mo", "1y", "2y"];

interface Props {
  ticker:    string;
  period?:   Period;
  height?:   number;
  showAVWAP?: boolean;
  showMA?:    boolean;
}

function sma(arr: number[], n: number): (number | null)[] {
  return arr.map((_, i) =>
    i >= n - 1 ? arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n : null
  );
}

export default function StockChart({
  ticker,
  period: initPeriod = "6mo",
  height = 300,
  showAVWAP = true,
  showMA    = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const [period, setPeriod] = useState<Period>(initPeriod);

  const { data: raw, isLoading } = useQuery<any>({
    queryKey:  ["ohlc", ticker, period],
    queryFn:   () => fetch(`/api/prices/ohlc?ticker=${ticker}&period=${period}`).then(r => r.json()),
    staleTime: 60_000,
  });

  // 1D → { bars, meta }; multi-day → OHLCBar[]
  const bars: OHLCBar[]      = Array.isArray(raw) ? raw : (raw?.bars ?? []);
  const meta: IntradayMeta | null = !Array.isArray(raw) ? (raw?.meta ?? null) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) return;

    let destroyed = false;

    const init = async () => {
      // lightweight-charts v5: series must be created with chart.addSeries(Constructor, opts)
      // The old chart.addCandlestickSeries() etc. are gone in v5 — that's why charts were blank.
      const {
        createChart,
        ColorType,
        CrosshairMode,
        LineStyle,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
        AreaSeries,
      } = await import("lightweight-charts");

      if (destroyed) return;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const chart = createChart(container, {
        width:  container.clientWidth || 600,
        height,
        layout: {
          background:  { type: ColorType.Solid, color: "transparent" },
          textColor:   "#7A8195",
          fontFamily:  "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: "rgba(30,30,46,0.5)" },
          horzLines: { color: "rgba(30,30,46,0.5)" },
        },
        crosshair: {
          mode:     CrosshairMode.Normal,
          vertLine: { color: "#4F7FFF50", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#4F7FFF50", width: 1, style: LineStyle.Dashed },
        },
        rightPriceScale: { borderColor: "rgba(30,30,46,0.6)" },
        timeScale: {
          borderColor:    "rgba(30,30,46,0.6)",
          timeVisible:    true,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      const toTime = (d: Date | string) => Math.floor(new Date(d).getTime() / 1000) as any;

      // ── 1D: area chart with pre / regular / after-hours splits ──────────────
      if (period === "1d") {
        const regStart = meta?.regularStart ?? 0;
        const regEnd   = meta?.regularEnd   ?? Infinity;

        const preBars  = bars.filter(b => toTime(b.date) <  regStart);
        const regBars  = bars.filter(b => toTime(b.date) >= regStart && toTime(b.date) <= regEnd);
        const postBars = bars.filter(b => toTime(b.date) >  regEnd);

        const toArea = (arr: OHLCBar[]) =>
          arr.map(b => ({ time: toTime(b.date), value: b.close })).filter(d => d.value > 0);

        // Pre-market — dimmed grey
        if (preBars.length > 0) {
          const s = chart.addSeries(AreaSeries, {
            lineColor: "#ffffff30", topColor: "#ffffff08", bottomColor: "#ffffff00",
            lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          });
          s.setData(toArea(preBars));
        }

        // Regular session — electric blue
        const regData = toArea(regBars.length > 0 ? regBars : bars);
        if (regData.length > 0) {
          const s = chart.addSeries(AreaSeries, {
            lineColor: "#4F7FFF", topColor: "#4F7FFF28", bottomColor: "#4F7FFF00",
            lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
          });
          s.setData(regData);

          if (meta?.prevClose && meta.prevClose > 0) {
            s.createPriceLine({
              price: meta.prevClose, color: "#ffffff18",
              lineWidth: 1, lineStyle: LineStyle.Dashed, title: "Prev Close",
            });
          }
        }

        // After-hours — dimmed grey
        if (postBars.length > 0) {
          const s = chart.addSeries(AreaSeries, {
            lineColor: "#ffffff30", topColor: "#ffffff08", bottomColor: "#ffffff00",
            lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
          });
          s.setData(toArea(postBars));
        }

      // ── Multi-day: candlestick + volume + MA + AVWAP ────────────────────────
      } else {
        const candleData = bars
          .map(b => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close }))
          .filter(d => d.close > 0);

        const cs = chart.addSeries(CandlestickSeries, {
          upColor: "#00D472", downColor: "#FF3151",
          borderUpColor: "#00D472", borderDownColor: "#FF3151",
          wickUpColor: "#00D47280", wickDownColor: "#FF315180",
        });
        cs.setData(candleData);

        // Volume
        const vs = chart.addSeries(HistogramSeries, {
          color: "#3B82F630", priceFormat: { type: "volume" }, priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        vs.setData(bars.map(b => ({
          time: toTime(b.date), value: b.volume,
          color: b.close >= b.open ? "#00D47220" : "#FF315120",
        })).filter(d => d.value > 0));

        const closes = bars.map(b => b.close);
        const times  = bars.map(b => toTime(b.date));

        if (showMA && bars.length >= 50) {
          const ma50data = sma(closes, 50)
            .map((v, i) => v != null ? { time: times[i], value: v } : null)
            .filter(Boolean) as any[];
          const m50 = chart.addSeries(LineSeries, {
            color: "#4F7FFF", lineWidth: 1, title: "50MA",
            priceLineVisible: false, lastValueVisible: false,
          });
          m50.setData(ma50data);

          if (bars.length >= 200) {
            const ma200data = sma(closes, 200)
              .map((v, i) => v != null ? { time: times[i], value: v } : null)
              .filter(Boolean) as any[];
            const m200 = chart.addSeries(LineSeries, {
              color: "#8B5CF6", lineWidth: 1, title: "200MA", lineStyle: LineStyle.Dashed,
              priceLineVisible: false, lastValueVisible: false,
            });
            m200.setData(ma200data);
          }
        }

        if (showAVWAP && bars.length >= 5) {
          const anchor = Math.max(0, bars.length - Math.min(bars.length, 200));
          let cumVP = 0, cumV = 0;
          const avwapPts: { time: any; value: number }[] = [];
          for (let i = anchor; i < bars.length; i++) {
            const b = bars[i];
            const tp = (b.high + b.low + b.close) / 3;
            cumVP += tp * b.volume;
            cumV  += b.volume;
            avwapPts.push({ time: times[i], value: cumV > 0 ? cumVP / cumV : b.close });
          }
          const avs = chart.addSeries(LineSeries, {
            color: "#F59E0B", lineWidth: 1, title: "AVWAP", lineStyle: LineStyle.Dashed,
            priceLineVisible: false, lastValueVisible: false,
          });
          avs.setData(avwapPts);
        }
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (container && chartRef.current) {
          chartRef.current.applyOptions({ width: container.clientWidth });
        }
      });
      ro.observe(container);
      return () => ro.disconnect();
    };

    let roCleanup: (() => void) | undefined;
    init().then(fn => { roCleanup = fn; }).catch(console.error);

    return () => {
      destroyed = true;
      roCleanup?.();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [bars, meta, period, height, showAVWAP, showMA]);

  const hasPremarket  = meta && meta.regularStart > 0 &&
    bars.some(b => Math.floor(new Date(b.date).getTime() / 1000) < meta.regularStart);
  const hasAfterHours = meta && meta.regularEnd > 0 &&
    bars.some(b => Math.floor(new Date(b.date).getTime() / 1000) > meta.regularEnd);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors
              ${period === p
                ? "bg-[#4F7FFF]/15 text-[#4F7FFF] border border-[#4F7FFF]/30"
                : "text-[#7A8195] hover:text-white"}`}>
            {p.toUpperCase()}
          </button>
        ))}
        {period === "1d" && (
          <div className="ml-2 flex items-center gap-3 text-[10px] font-mono">
            {hasPremarket  && <span className="text-[#7A8195]">◾ Pre-market</span>}
            <span className="text-[#4F7FFF]">◾ Regular</span>
            {hasAfterHours && <span className="text-[#7A8195]">◾ After-hours</span>}
          </div>
        )}
        {period !== "1d" && showAVWAP && <span className="ml-2 text-[10px] text-[#F59E0B] font-mono">— AVWAP</span>}
        {period !== "1d" && showMA    && <span className="ml-1 text-[10px] text-[#4F7FFF] font-mono">— 50</span>}
        {period !== "1d" && showMA    && <span className="ml-1 text-[10px] text-[#8B5CF6] font-mono">— 200</span>}
      </div>

      {/* Explicit height prevents the div from collapsing to 0px */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height }}>
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center text-[#7A8195] text-sm font-mono animate-pulse">
            Loading chart…
          </div>
        )}
        {!isLoading && bars.length === 0 && (
          <div className="w-full h-full flex items-center justify-center text-[#7A8195] text-sm">
            No chart data available
          </div>
        )}
      </div>
    </div>
  );
}
