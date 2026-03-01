"use client";
import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/lib/api/yahoo";

interface Props {
  onSelect: (ticker: string, name: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TickerSearch({ onSelect, placeholder = "Search ticker...", className = "" }: Props) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref   = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q: string) => {
    clearTimeout(timer.current);
    setQuery(q);
    if (q.length < 1) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 250);
  };

  const select = (r: SearchResult) => {
    onSelect(r.ticker, r.name);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-phantom-ghost" />
        <input
          className="input-phantom pl-9 pr-9 w-full"
          placeholder={placeholder}
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-phantom-ghost animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 phantom-card-elevated overflow-hidden">
          {results.map(r => (
            <button key={r.ticker}
              onClick={() => select(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-phantom-muted text-left transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm text-phantom-star">{r.ticker}</span>
                  <span className="text-[10px] text-phantom-ghost border border-phantom-border rounded px-1.5">{r.type}</span>
                  <span className="text-[10px] text-phantom-ghost">{r.exch}</span>
                </div>
                <div className="text-xs text-phantom-ghost truncate max-w-[280px]">{r.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
