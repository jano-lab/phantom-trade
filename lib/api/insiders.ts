/**
 * Insider & Institutional trading data
 * Sources: Finnhub (insider transactions), SEC EDGAR Form 4, OpenInsider
 */

export interface InsiderTrade {
  id:          string;
  ticker:      string;
  name:        string;
  title:       string;
  action:      "buy" | "sell" | "grant" | "other";
  shares:      number;
  price:       number;
  value:       number;
  shares_owned: number;
  filing_date: string;
  trade_date:  string;
  source:      string;
}

export interface InstitutionalHolder {
  name:        string;
  shares:      number;
  pct_held:    number;
  value:       number;
  change:      number;
  change_pct:  number;
  report_date: string;
}

// Finnhub insider transactions
export async function getInsiderTransactions(ticker: string, apiKey: string): Promise<InsiderTrade[]> {
  if (!apiKey) return getOpenInsiderData(ticker);
  try {
    const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return getOpenInsiderData(ticker);
    const data = await res.json();
    return (data.data ?? []).slice(0, 30).map((t: any, i: number) => ({
      id:           `fh-${i}`,
      ticker:       ticker.toUpperCase(),
      name:         t.name ?? "Unknown",
      title:        "",
      action:       parseAction(t.transactionCode),
      shares:       Math.abs(t.share ?? 0),
      price:        t.transactionPrice ?? 0,
      value:        Math.abs((t.share ?? 0) * (t.transactionPrice ?? 0)),
      shares_owned: t.shareOwned ?? 0,
      filing_date:  t.filingDate ?? "",
      trade_date:   t.transactionDate ?? "",
      source:       "Finnhub / SEC",
    }));
  } catch {
    return getOpenInsiderData(ticker);
  }
}

// OpenInsider scrape (public data, no API key)
export async function getOpenInsiderData(ticker: string): Promise<InsiderTrade[]> {
  try {
    const url = `https://openinsider.com/screener?s=${ticker}&o=&pl=&ph=&ll=&lh=&fd=730&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=40&action=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 7200 },
    });
    if (!res.ok) return [];

    // Parse the HTML table – minimal scraping
    const html  = await res.text();
    const rows  = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const trades: InsiderTrade[] = [];

    for (const row of rows.slice(2, 42)) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [];
      if (cells.length < 11) continue;
      const text  = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      const num   = (s: string) => parseFloat(s.replace(/[,$]/g, "")) || 0;

      trades.push({
        id:           `oi-${trades.length}`,
        ticker:       ticker.toUpperCase(),
        name:         text(cells[3] ?? ""),
        title:        text(cells[4] ?? ""),
        action:       text(cells[5] ?? "").toLowerCase().includes("s") ? "sell" : "buy",
        shares:       Math.abs(num(text(cells[7] ?? ""))),
        price:        num(text(cells[8] ?? "")),
        value:        Math.abs(num(text(cells[9] ?? ""))),
        shares_owned: num(text(cells[10] ?? "")),
        filing_date:  text(cells[1] ?? ""),
        trade_date:   text(cells[2] ?? ""),
        source:       "OpenInsider / SEC Form 4",
      });
    }
    return trades;
  } catch {
    return [];
  }
}

// Institutional holders via Yahoo Finance (unofficial)
export async function getInstitutionalHolders(ticker: string): Promise<InstitutionalHolder[]> {
  try {
    const yahooFinance = (await import("yahoo-finance2")).default;
    const data = await (yahooFinance as any).institutionOwnership(ticker);
    const holders = data?.ownershipList ?? [];
    return holders.map((h: any) => ({
      name:        h.organization ?? "",
      shares:      h.position ?? 0,
      pct_held:    h.pctHeld ?? 0,
      value:       h.value ?? 0,
      change:      h.change ?? 0,
      change_pct:  h.pctChange ?? 0,
      report_date: h.reportDate ?? "",
    }));
  } catch {
    return [];
  }
}

// SEC Form 4 via EDGAR full-text search
export async function getRecentForm4(ticker: string): Promise<InsiderTrade[]> {
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&forms=4&dateRange=custom&startdt=${nDaysAgo(90)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits?.hits ?? []).slice(0, 20).map((h: any, i: number) => ({
      id:           `sec4-${i}`,
      ticker:       ticker.toUpperCase(),
      name:         h._source?.display_names?.[0] ?? "Insider",
      title:        "",
      action:       "buy" as const,
      shares:       0,
      price:        0,
      value:        0,
      shares_owned: 0,
      filing_date:  h._source?.file_date ?? "",
      trade_date:   h._source?.period_of_report ?? "",
      source:       "SEC EDGAR Form 4",
    }));
  } catch {
    return [];
  }
}

function parseAction(code: string): "buy" | "sell" | "grant" | "other" {
  const c = (code ?? "").toUpperCase();
  if (c === "P") return "buy";
  if (c === "S" || c === "D") return "sell";
  if (c === "A") return "grant";
  return "other";
}

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
