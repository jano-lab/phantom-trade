#!/usr/bin/env npx tsx
/**
 * Local background cron — run with: npm run cron
 * Works even if the web UI is closed (just keep this terminal running)
 * For true "off computer" monitoring, deploy to Vercel/Cloud (see README)
 */
import cron from "node-cron";
import { runAlertEngine } from "../lib/alerts/engine";

console.log(`
  ██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗
  ██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║
  ██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
  ██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
  ██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
  TRADE INTELLIGENCE — Signal Over Noise
  Background Alert Monitor | ${new Date().toLocaleString()}
`);

// Run alert engine every 60 seconds
cron.schedule("* * * * *", async () => {
  const ts = new Date().toLocaleTimeString();
  try {
    process.stdout.write(`[${ts}] Running alert check... `);
    await runAlertEngine();
    process.stdout.write("✓\n");
  } catch (err) {
    console.error(`[${ts}] Alert engine error:`, err);
  }
});

// Cache current prices every 5 minutes (for acceleration tracking)
cron.schedule("*/5 * * * *", async () => {
  try {
    const { getAllHoldings, getWatchlist, cachePrice } = await import("../lib/db/schema");
    const { getMultiQuote } = await import("../lib/api/yahoo");
    const holdings  = getAllHoldings().map(h => h.ticker);
    const watchlist = getWatchlist().map(w => w.ticker);
    const tickers   = [...new Set([...holdings, ...watchlist])];
    if (tickers.length === 0) return;
    const quotes = await getMultiQuote(tickers);
    for (const q of Object.values(quotes)) {
      cachePrice(q.ticker, q.price, q.change_pct, q.volume);
    }
    console.log(`[${new Date().toLocaleTimeString()}] Cached ${Object.keys(quotes).length} prices`);
  } catch (err) {
    console.error("Price cache error:", err);
  }
});

// Generate insights daily at 9:00 AM
cron.schedule("0 9 * * 1-5", async () => {
  console.log(`[${new Date().toLocaleTimeString()}] Generating daily insights...`);
  try {
    await fetch("http://localhost:3000/api/insights?refresh=1");
    console.log("Insights generated.");
  } catch (err) {
    console.error("Insights error:", err);
  }
});

console.log("⚡ Phantom Trade cron started. Checking alerts every minute.");
console.log("   Press Ctrl+C to stop.");
console.log("   For cloud deployment (works when computer is off):");
console.log("   → npx vercel --prod\n");
