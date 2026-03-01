"use client";
import { useQuery } from "@tanstack/react-query";

interface TapeItem { ticker: string; price: number; change_pct: number; }

const DEFAULT_TICKERS = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN","GOOGL","AMD","OKLO","PLTR","SMCI","MSTR","BTC-USD"];

export default function TickerTape() {
  const { data = [] } = useQuery<TapeItem[]>({
    queryKey: ["tape"],
    queryFn:  () => fetch("/api/prices/tape").then(r => r.json()),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const items = data.length > 0 ? data : DEFAULT_TICKERS.map(t => ({ ticker: t, price: 0, change_pct: 0 }));
  const doubled = [...items, ...items]; // for seamless loop

  return (
    <div className="flex items-center h-full overflow-hidden">
      <div className="ticker-tape-inner">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-1 px-4 text-xs font-mono whitespace-nowrap">
            <span className="text-phantom-silver font-semibold tracking-wider">{item.ticker}</span>
            {item.price > 0 && (
              <>
                <span className="text-phantom-ghost">${item.price.toFixed(2)}</span>
                <span className={item.change_pct >= 0 ? "text-phantom-nova" : "text-phantom-pulse"}>
                  {item.change_pct >= 0 ? "+" : ""}{item.change_pct.toFixed(2)}%
                </span>
              </>
            )}
            <span className="text-phantom-border ml-2">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
