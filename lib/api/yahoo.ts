/**
 * Yahoo Finance data wrapper
 * Free, no API key required
 */
import yahooFinance from "yahoo-finance2";

export interface QuoteData {
  ticker:      string;
  name:        string;
  price:       number;
  open:        number;
  high:        number;
  low:         number;
  prev_close:  number;
  change:      number;
  change_pct:  number;
  volume:      number;
  avg_volume:  number;
  mkt_cap:     number;
  pe_ratio:    number | null;
  eps:         number | null;
  week52_high: number;
  week52_low:  number;
  beta:        number | null;
  timestamp:   number;
}

export interface OHLCBar {
  date:   Date;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface SearchResult {
  ticker: string;
  name:   string;
  type:   string;
  exch:   string;
}

export async function getQuote(ticker: string): Promise<QuoteData | null> {
  try {
    const q = await yahooFinance.quote(ticker.toUpperCase()) as any;
    if (!q || !q.regularMarketPrice) return null;
    return {
      ticker:      ticker.toUpperCase(),
      name:        q.shortName ?? q.longName ?? ticker,
      price:       q.regularMarketPrice ?? 0,
      open:        q.regularMarketOpen ?? 0,
      high:        q.regularMarketDayHigh ?? 0,
      low:         q.regularMarketDayLow ?? 0,
      prev_close:  q.regularMarketPreviousClose ?? 0,
      change:      q.regularMarketChange ?? 0,
      change_pct:  q.regularMarketChangePercent ?? 0,
      volume:      q.regularMarketVolume ?? 0,
      avg_volume:  q.averageDailyVolume3Month ?? 0,
      mkt_cap:     q.marketCap ?? 0,
      pe_ratio:    q.trailingPE ?? null,
      eps:         q.epsTrailingTwelveMonths ?? null,
      week52_high: q.fiftyTwoWeekHigh ?? 0,
      week52_low:  q.fiftyTwoWeekLow ?? 0,
      beta:        q.beta ?? null,
      timestamp:   Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getMultiQuote(tickers: string[]): Promise<Record<string, QuoteData>> {
  const results: Record<string, QuoteData> = {};
  // Yahoo supports batched quotes
  await Promise.allSettled(
    tickers.map(async t => {
      const q = await getQuote(t);
      if (q) results[t.toUpperCase()] = q;
    })
  );
  return results;
}

export async function getHistoricalOHLC(ticker: string, period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max" = "1y"): Promise<OHLCBar[]> {
  try {
    const result = await (yahooFinance.chart as any)(ticker.toUpperCase(), {
      period1:  periodToDate(period),
      period2:  new Date(),
      interval: "1d",
    });
    return (result.quotes ?? []).map((q: any) => ({
      date:   new Date(q.date),
      open:   q.open   ?? 0,
      high:   q.high   ?? 0,
      low:    q.low    ?? 0,
      close:  q.close  ?? 0,
      volume: q.volume ?? 0,
    })).filter((b: OHLCBar) => b.close > 0);
  } catch {
    return [];
  }
}

export async function getIntradayOHLC(ticker: string): Promise<OHLCBar[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await (yahooFinance.chart as any)(ticker.toUpperCase(), {
      period1:  today,
      period2:  new Date(),
      interval: "5m",
    });
    return (result.quotes ?? []).map((q: any) => ({
      date:   new Date(q.date),
      open:   q.open   ?? 0,
      high:   q.high   ?? 0,
      low:    q.low    ?? 0,
      close:  q.close  ?? 0,
      volume: q.volume ?? 0,
    })).filter((b: OHLCBar) => b.close > 0);
  } catch {
    return [];
  }
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  try {
    if (query.length < 1) return [];
    const res = await (yahooFinance.search as any)(query, { quotesCount: 10, newsCount: 0 });
    return (res.quotes ?? [])
      .filter((r: any) => r.quoteType === "EQUITY" || r.quoteType === "ETF" || r.quoteType === "CRYPTOCURRENCY")
      .slice(0, 8)
      .map((r: any) => ({
        ticker: r.symbol ?? "",
        name:   r.longname ?? r.shortname ?? "",
        type:   r.quoteType ?? "",
        exch:   r.exchDisp ?? "",
      }));
  } catch {
    return [];
  }
}

export async function getEarningsCalendar(tickers: string[]): Promise<any[]> {
  const out: any[] = [];
  await Promise.allSettled(tickers.map(async t => {
    try {
      const q = await yahooFinance.quote(t) as any;
      if (q?.earningsTimestamp) {
        out.push({ ticker: t, date: new Date(q.earningsTimestamp * 1000) });
      }
    } catch {}
  }));
  return out.sort((a, b) => a.date - b.date);
}

function periodToDate(period: string): Date {
  const d = new Date();
  const map: Record<string, number> = { "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825, "max": 3650 };
  d.setDate(d.getDate() - (map[period] ?? 365));
  return d;
}
