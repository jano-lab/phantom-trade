"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OHLCBar } from "@/lib/api/yahoo";
import { calculateAVWAP, sma } from "@/lib/indicators";

interface Props {
  ticker:  string;
  period?: "1d" | "1mo" | "3mo" | "6mo" | "1y" | "2y";
  height?: number;
  showAVWAP?: boolean;
  showMA?:    boolean;
}

const PERIODS = ["1d","1mo","3mo","6mo","1y","2y"] as const;

export default function StockChart({ ticker, period: initPeriod = "6mo", height = 300, showAVWAP = true, showMA = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const [period, setPeriod] = useState(initPeriod);

  const { data: bars = [], isLoading } = useQuery<OHLCBar[]>({
    queryKey:  ["ohlc", ticker, period],
    queryFn:   () => fetch(`/api/prices/ohlc?ticker=${ticker}&period=${period}`).then(r => r.json()),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    let chart: any;

    const init = async () => {
      const { createChart, CrosshairMode, LineStyle } = await import("lightweight-charts");

      // Cleanup previous
      if (chartRef.current) { chartRef.current.remove(); }

      chart = createChart(containerRef.current!, {
        width:  containerRef.current!.clientWidth,
        height,
        layout: {
          background:    { color: "transparent" },
          textColor:     "#7C8B9E",
          fontFamily:    "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines:   { color: "rgba(28,35,51,0.4)" },
          horzLines:   { color: "rgba(28,35,51,0.4)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine:   { color: "#3B82F640", width: 1, style: LineStyle.Dashed },
          horzLine:   { color: "#3B82F640", width: 1, style: LineStyle.Dashed },
        },
        rightPriceScale: { borderColor: "rgba(28,35,51,0.6)" },
        timeScale:       { borderColor: "rgba(28,35,51,0.6)", timeVisible: true },
      });
      chartRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor:          "#00FF88",
        downColor:        "#FF3B5C",
        borderUpColor:    "#00FF88",
        borderDownColor:  "#FF3B5C",
        wickUpColor:      "#00FF8880",
        wickDownColor:    "#FF3B5C80",
      });

      const candleData = bars.map(b => ({
        time:  Math.floor(new Date(b.date).getTime() / 1000) as any,
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      }));
      candleSeries.setData(candleData);

      // Volume histogram
      const volSeries = chart.addHistogramSeries({
        color:    "#3B82F630",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volSeries.setData(bars.map(b => ({
        time:  Math.floor(new Date(b.date).getTime() / 1000) as any,
        value: b.volume,
        color: b.close >= b.open ? "#00FF8825" : "#FF3B5C25",
      })));

      const closes = bars.map(b => b.close);
      const times  = bars.map(b => Math.floor(new Date(b.date).getTime() / 1000) as any);

      // MA lines
      if (showMA && bars.length >= 50) {
        const ma50 = sma(closes, 50);
        const ma200 = sma(closes, 200);

        const ma50Series = chart.addLineSeries({ color: "#3B82F6", lineWidth: 1.5, title: "50MA" });
        ma50Series.setData(ma50.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean));

        if (bars.length >= 200) {
          const ma200Series = chart.addLineSeries({ color: "#8B5CF6", lineWidth: 1.5, title: "200MA", lineStyle: 2 });
          ma200Series.setData(ma200.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean));
        }
      }

      // AVWAP
      if (showAVWAP && bars.length >= 5) {
        const anchorIdx = Math.max(0, bars.length - Math.min(bars.length, 200));
        const avwapData = calculateAVWAP(bars, anchorIdx);
        const avwapSeries = chart.addLineSeries({ color: "#F59E0B", lineWidth: 1.5, title: "AVWAP", lineStyle: 1 });
        avwapSeries.setData(avwapData.map((v, i) => ({
          time:  times[anchorIdx + i],
          value: v.avwap,
        })));

        // AVWAP upper/lower bands
        const band1U = chart.addLineSeries({ color: "#F59E0B40", lineWidth: 1, title: "AVWAP+1σ", lineStyle: 2 });
        const band1L = chart.addLineSeries({ color: "#F59E0B40", lineWidth: 1, title: "AVWAP-1σ", lineStyle: 2 });
        band1U.setData(avwapData.map((v, i) => ({ time: times[anchorIdx + i], value: v.upper1 })));
        band1L.setData(avwapData.map((v, i) => ({ time: times[anchorIdx + i], value: v.lower1 })));
      }

      chart.timeScale().fitContent();

      const handleResize = () => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    };

    init();
    return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [bars, height, showAVWAP, showMA]);

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex items-center gap-1">
        {PERIODS.map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors
              ${period === p ? "bg-phantom-signal/20 text-phantom-signal border border-phantom-signal/30" : "text-phantom-ghost hover:text-phantom-silver"}`}>
            {p.toUpperCase()}
          </button>
        ))}
        {showAVWAP && <span className="ml-2 text-xs text-phantom-amber font-mono">─ AVWAP</span>}
        {showMA    && <span className="ml-2 text-xs text-phantom-signal font-mono">─ 50MA</span>}
        {showMA    && <span className="ml-2 text-xs text-phantom-violet font-mono">─ 200MA</span>}
      </div>

      <div ref={containerRef} className="w-full rounded-lg overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-phantom-deep/50 z-10">
            <div className="text-phantom-ghost text-sm font-mono animate-pulse">Loading chart...</div>
          </div>
        )}
        {!isLoading && bars.length === 0 && (
          <div className="flex items-center justify-center text-phantom-ghost text-sm" style={{ height }}>
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
