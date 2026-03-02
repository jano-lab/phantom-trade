/**
 * Yahoo Finance data wrapper — yahoo-finance2 v3
 * validateResult: false suppresses schema-validation errors that silently
 * return null for many tickers in v3's strict validation mode.
 */
import yahooFinance from "yahoo-finance2";

export interface QuoteData {
  ticker:              string;
  name:                string;
  price:               number;
  open:                number;
  high:                number;
  low:                 number;
  prev_close:          number;
  change:              number;
  change_pct:          number;
  volume:              number;
  avg_volume:          number;
  mkt_cap:             number;
  pe_ratio:            number | null;
  eps:                 number | null;
  week52_high:         number;
  week52_low:          number;
  beta:                number | null;
  timestamp:           number;
  // Extended-hours
  marketState:         string;          // PRE | REGULAR | POST | CLOSED
  preMarketPrice:      number | null;
  preMarketChangePct:  number | null;   // % change from prev close
  postMarketPrice:     number | null;
  postMarketChangePct: number | null;   // % change from regular close
}

export interface OHLCBar {
  date:   Date;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

/** Session timestamps (Unix seconds) returned alongside intraday bars */
export interface IntradayMeta {
  preStart:     number;
  preEnd:       number;
  regularStart: number;
  regularEnd:   number;
  postStart:    number;
  postEnd:      number;
  prevClose:    number;
}

export interface IntradayData {
  bars: OHLCBar[];
  meta: IntradayMeta;
}

export interface SearchResult {
  ticker: string;
  name:   string;
  type:   string;
  exch:   string;
}

// Passed as third argument to every yahoo-finance2 call to skip schema validation
const OPTS = { validateResult: false } as const;

export async function getQuote(ticker: string): Promise<QuoteData | null> {
  try {
    const q = await yahooFinance.quote(ticker.toUpperCase(), {}, OPTS) as any;
    if (!q) return null;
    const price = q.regularMarketPrice ?? 0;
    if (!price) return null;
    return {
      ticker:              ticker.toUpperCase(),
      name:                q.shortName ?? q.longName ?? ticker,
      price,
      open:                q.regularMarketOpen             ?? 0,
      high:                q.regularMarketDayHigh          ?? 0,
      low:                 q.regularMarketDayLow           ?? 0,
      prev_close:          q.regularMarketPreviousClose    ?? 0,
      change:              q.regularMarketChange           ?? 0,
      change_pct:          q.regularMarketChangePercent    ?? 0,
      volume:              q.regularMarketVolume           ?? 0,
      avg_volume:          q.averageDailyVolume3Month      ?? 0,
      mkt_cap:             q.marketCap                     ?? 0,
      pe_ratio:            q.trailingPE                    ?? null,
      eps:                 q.epsTrailingTwelveMonths       ?? null,
      week52_high:         q.fiftyTwoWeekHigh              ?? 0,
      week52_low:          q.fiftyTwoWeekLow               ?? 0,
      beta:                q.beta                          ?? null,
      timestamp:           Date.now(),
      marketState:         q.marketState                   ?? "REGULAR",
      preMarketPrice:      q.preMarketPrice                ?? null,
      preMarketChangePct:  q.preMarketChangePercent        ?? null,
      postMarketPrice:     q.postMarketPrice               ?? null,
      postMarketChangePct: q.postMarketChangePercent       ?? null,
    };
  } catch {
    return null;
  }
}

export async function getMultiQuote(tickers: string[]): Promise<Record<string, QuoteData>> {
  const results: Record<string, QuoteData> = {};
  await Promise.allSettled(
    tickers.map(async t => {
      const q = await getQuote(t);
      if (q) results[t.toUpperCase()] = q;
    })
  );
  return results;
}

export async function getHistoricalOHLC(
  ticker: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max" = "1y"
): Promise<OHLCBar[]> {
  try {
    // yahooFinance.historical() is more reliable than chart() for daily OHLCV
    const result = await (yahooFinance.historical as any)(
      ticker.toUpperCase(),
      { period1: periodToDate(period), period2: new Date(), interval: "1d" },
      OPTS
    ) as any[];
    return result
      .map((q: any) => ({
        date:   new Date(q.date),
        open:   q.open     ?? 0,
        high:   q.high     ?? 0,
        low:    q.low      ?? 0,
        close:  q.adjclose ?? q.close ?? 0,
        volume: q.volume   ?? 0,
      }))
      .filter((b: OHLCBar) => b.close > 0);
  } catch {
    return [];
  }
}

export async function getIntradayOHLC(ticker: string): Promise<IntradayData> {
  const empty: IntradayData = {
    bars: [],
    meta: { preStart: 0, preEnd: 0, regularStart: 0, regularEnd: 0, postStart: 0, postEnd: 0, prevClose: 0 },
  };
  try {
    // Go back 28 h to capture today's 4 AM ET premarket regardless of server timezone
    const period1 = new Date(Date.now() - 28 * 60 * 60 * 1000);
    const result  = await (yahooFinance.chart as any)(
      ticker.toUpperCase(),
      { period1, period2: new Date(), interval: "5m", includePrePost: true },
      OPTS
    ) as any;

    if (!result) return empty;

    const bars: OHLCBar[] = ((result.quotes ?? []) as any[])
      .map((q: any) => ({
        date:   new Date(q.date),
        open:   q.open   ?? 0,
        high:   q.high   ?? 0,
        low:    q.low    ?? 0,
        close:  q.close  ?? 0,
        volume: q.volume ?? 0,
      }))
      .filter((b: OHLCBar) => b.close > 0);

    const ctp  = result.meta?.currentTradingPeriod;
    const meta: IntradayMeta = {
      preStart:     ctp?.pre?.start     ?? 0,
      preEnd:       ctp?.pre?.end       ?? 0,
      regularStart: ctp?.regular?.start ?? 0,
      regularEnd:   ctp?.regular?.end   ?? 0,
      postStart:    ctp?.post?.start    ?? 0,
      postEnd:      ctp?.post?.end      ?? 0,
      prevClose:    result.meta?.chartPreviousClose ?? 0,
    };

    return { bars, meta };
  } catch {
    return empty;
  }
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  try {
    if (query.length < 1) return [];
    const res = await (yahooFinance.search as any)(query, { quotesCount: 10, newsCount: 0 }, OPTS);
    return (res.quotes ?? [])
      .filter((r: any) => r.quoteType === "EQUITY" || r.quoteType === "ETF" || r.quoteType === "CRYPTOCURRENCY")
      .slice(0, 8)
      .map((r: any) => ({
        ticker: r.symbol    ?? "",
        name:   r.longname  ?? r.shortname ?? "",
        type:   r.quoteType ?? "",
        exch:   r.exchDisp  ?? "",
      }));
  } catch {
    return [];
  }
}

export async function getEarningsCalendar(tickers: string[]): Promise<any[]> {
  const out: any[] = [];
  await Promise.allSettled(tickers.map(async t => {
    try {
      const q = await yahooFinance.quote(t, {}, OPTS) as any;
      if (q?.earningsTimestamp) {
        out.push({ ticker: t, date: new Date(q.earningsTimestamp * 1000) });
      }
    } catch {}
  }));
  return out.sort((a, b) => a.date - b.date);
}

function periodToDate(period: string): Date {
  const d = new Date();
  const map: Record<string, number> = {
    "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825, "max": 3650,
  };
  d.setDate(d.getDate() - (map[period] ?? 365));
  return d;
}
