/**
 * News aggregation - combines Finnhub company news + NewsAPI
 */

export interface NewsItem {
  id:         string;
  ticker?:    string;
  headline:   string;
  summary:    string;
  source:     string;
  url:        string;
  published:  string;  // ISO string
  sentiment?: "positive" | "negative" | "neutral";
  image?:     string;
}

// Finnhub company news (free tier: 60 req/min)
export async function getFinnhubNews(ticker: string, apiKey: string): Promise<NewsItem[]> {
  if (!apiKey) return [];
  try {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.slice(0, 15).map(item => ({
      id:        String(item.id),
      ticker,
      headline:  item.headline ?? "",
      summary:   item.summary ?? "",
      source:    item.source ?? "",
      url:       item.url ?? "",
      published: new Date(item.datetime * 1000).toISOString(),
      image:     item.image ?? undefined,
      sentiment: guessSentiment(item.headline + " " + item.summary),
    }));
  } catch {
    return [];
  }
}

// NewsAPI general market news
export async function getMarketNews(query: string, apiKey: string): Promise<NewsItem[]> {
  if (!apiKey) return [];
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=15&language=en&apiKey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles ?? []).map((a: any, i: number) => ({
      id:        `na-${i}-${Date.now()}`,
      headline:  a.title ?? "",
      summary:   a.description ?? "",
      source:    a.source?.name ?? "",
      url:       a.url ?? "",
      published: a.publishedAt ?? new Date().toISOString(),
      image:     a.urlToImage ?? undefined,
      sentiment: guessSentiment(a.title + " " + a.description),
    }));
  } catch {
    return [];
  }
}

// SEC RSS feed - free, no API key
export async function getSECFilings(ticker: string): Promise<NewsItem[]> {
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${sevenDaysAgo()}&forms=8-K,4,13D,13G`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits?.hits ?? []).slice(0, 10).map((h: any, i: number) => ({
      id:        `sec-${i}`,
      ticker,
      headline:  `SEC Filing: ${h._source?.form_type ?? "Form"} — ${h._source?.display_names?.[0] ?? ticker}`,
      summary:   h._source?.period_of_report ? `Period: ${h._source.period_of_report}` : "",
      source:    "SEC EDGAR",
      url:       `https://www.sec.gov/Archives/edgar/${h._source?.file_date ?? ""}`,
      published: h._source?.period_of_report ?? new Date().toISOString(),
      sentiment: "neutral" as const,
    }));
  } catch {
    return [];
  }
}

// Finnhub sentiment analysis
export async function getSentimentAnalysis(ticker: string, apiKey: string): Promise<{
  bullish: number; bearish: number; total: number;
} | null> {
  if (!apiKey) return null;
  try {
    const url = `https://finnhub.io/api/v1/news-sentiment?symbol=${ticker}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      bullish: d.buzz?.bullishPercent ?? 0,
      bearish: d.buzz?.bearishPercent ?? 0,
      total:   d.buzz?.articlesInLastWeek ?? 0,
    };
  } catch {
    return null;
  }
}

// Simple keyword-based sentiment
function guessSentiment(text: string): "positive" | "negative" | "neutral" {
  const t    = text.toLowerCase();
  const bull = ["surge","soar","rally","gain","rise","beat","exceed","strong","bullish","upgrade","buy","growth","revenue beat","profit","record","expand"];
  const bear = ["fall","drop","crash","plunge","miss","weak","bearish","downgrade","sell","loss","decline","layoff","cut","risk","warning","below","struggle"];
  const bs   = bull.filter(w => t.includes(w)).length;
  const brs  = bear.filter(w => t.includes(w)).length;
  if (bs > brs)  return "positive";
  if (brs > bs)  return "negative";
  return "neutral";
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}
