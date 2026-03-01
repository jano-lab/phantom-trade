import { NextRequest, NextResponse } from "next/server";
import { getInsights, dismissInsight, insertInsight, getAllHoldings, getAllTrades } from "@/lib/db/schema";
import { getMultiQuote } from "@/lib/api/yahoo";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (refresh) await generateInsights();
  return NextResponse.json(await getInsights(30));
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await dismissInsight(id);
  return NextResponse.json({ ok: true });
}

async function generateInsights() {
  const holdings = await getAllHoldings();
  const trades   = await getAllTrades();
  if (holdings.length === 0) return;

  const tickers = holdings.map(h => h.ticker);
  const quotes  = await getMultiQuote(tickers);

  const totalValue = holdings.reduce((sum, h) => sum + h.shares * (quotes[h.ticker]?.price ?? h.avg_cost), 0);
  const positions  = holdings.map(h => {
    const price = quotes[h.ticker]?.price ?? h.avg_cost;
    const value = h.shares * price;
    const pnl   = (price - h.avg_cost) / h.avg_cost * 100;
    return { ...h, price, value, pnl, weight: totalValue > 0 ? value / totalValue * 100 : 0 };
  }).sort((a, b) => b.value - a.value);

  const top1Weight = positions[0]?.weight ?? 0;
  if (top1Weight > 30) {
    await insertInsight({
      category: "risk",
      title:    `High Concentration: ${positions[0]?.ticker}`,
      body:     `${positions[0]?.ticker} represents ${top1Weight.toFixed(1)}% of your portfolio. Consider sizing down below 20% for better risk management.`,
      severity: "warning",
      ticker:   positions[0]?.ticker,
    });
  }

  const bigLosers = positions.filter(p => p.pnl < -15);
  for (const loser of bigLosers.slice(0, 3)) {
    await insertInsight({
      category: "risk",
      title:    `Significant Loss: ${loser.ticker} (${loser.pnl.toFixed(1)}%)`,
      body:     `${loser.ticker} is down ${Math.abs(loser.pnl).toFixed(1)}% from your average cost of $${loser.avg_cost.toFixed(2)}. Evaluate if the original thesis still holds.`,
      severity: "warning",
      ticker:   loser.ticker,
    });
  }

  const bigWinners = positions.filter(p => p.pnl > 50);
  for (const winner of bigWinners.slice(0, 2)) {
    await insertInsight({
      category: "opportunity",
      title:    `Strong Winner: ${winner.ticker} (+${winner.pnl.toFixed(1)}%)`,
      body:     `${winner.ticker} is up ${winner.pnl.toFixed(1)}% from your cost basis. Consider trimming 20-30% to lock in gains.`,
      severity: "info",
      ticker:   winner.ticker,
    });
  }

  const tickerTrades: Record<string, typeof trades> = {};
  for (const t of trades) {
    if (!tickerTrades[t.ticker]) tickerTrades[t.ticker] = [];
    tickerTrades[t.ticker].push(t);
  }

  for (const [ticker, ts] of Object.entries(tickerTrades)) {
    const buys  = ts.filter(t => t.action === "buy");
    const sells = ts.filter(t => t.action === "sell");
    if (buys.length === 0 || sells.length === 0) continue;
    const avgSellPrice = sells.reduce((s, t) => s + t.price, 0) / sells.length;
    const currentPrice = quotes[ticker]?.price ?? 0;
    if (avgSellPrice > 0 && currentPrice > avgSellPrice * 1.2) {
      await insertInsight({
        category: "trade",
        title:    `Sold Too Early: ${ticker}`,
        body:     `You sold ${ticker} at avg $${avgSellPrice.toFixed(2)}, now at $${currentPrice.toFixed(2)} (+${((currentPrice/avgSellPrice-1)*100).toFixed(1)}%).`,
        severity: "info",
        ticker,
      });
    }
  }

  const sectors = new Set(holdings.map(h => h.asset_type));
  if (holdings.length > 5 && sectors.size < 3) {
    await insertInsight({
      category: "portfolio",
      title:    "Low Sector Diversification",
      body:     `Your portfolio has ${holdings.length} positions but limited sector diversity. Consider adding exposure to uncorrelated sectors.`,
      severity: "info",
      ticker:   null,
    });
  }
}
