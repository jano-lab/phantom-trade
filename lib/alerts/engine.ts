/**
 * Alert Engine — evaluates all active alerts against live prices
 */
import { getActiveAlerts, logAlertTrigger, getAllSettings, type Alert } from "@/lib/db/schema";
import { getMultiQuote, getHistoricalOHLC } from "@/lib/api/yahoo";
import { getFinnhubNews }    from "@/lib/api/news";
import { analyzeMAs, detectAcceleration } from "@/lib/indicators";
import { sendEmail, sendSMS, buildPriceAlertEmail, buildSMSAlert, buildAccelerationSMS } from "@/lib/notifications";

const priceHistory: Map<string, { price: number; timestamp: number }[]> = new Map();
const ACCEL_HISTORY_MAX = 30;

export async function runAlertEngine() {
  const alerts   = await getActiveAlerts();
  if (alerts.length === 0) return;

  const tickers  = [...new Set(alerts.map(a => a.ticker))];
  const quotes   = await getMultiQuote(tickers);
  const settings = await getAllSettings() as Record<string, string>;

  for (const ticker of tickers) {
    const q = quotes[ticker];
    if (!q) continue;
    if (!priceHistory.has(ticker)) priceHistory.set(ticker, []);
    const hist = priceHistory.get(ticker)!;
    hist.push({ price: q.price, timestamp: Date.now() });
    if (hist.length > ACCEL_HISTORY_MAX) hist.shift();
  }

  for (const alert of alerts) {
    const q = quotes[alert.ticker];
    if (!q) continue;

    const condition = JSON.parse(alert.condition) as Record<string, any>;
    let triggered  = false;
    let message    = "";

    switch (alert.type) {
      case "price_above":
        if (q.price >= condition.target) { triggered = true; message = `${alert.ticker} hit $${q.price.toFixed(2)} — above target $${condition.target}`; }
        break;

      case "price_below":
        if (q.price <= condition.target) { triggered = true; message = `${alert.ticker} hit $${q.price.toFixed(2)} — below target $${condition.target}`; }
        break;

      case "pct_change": {
        const threshold = condition.pct ?? 5;
        if (Math.abs(q.change_pct) >= threshold) { triggered = true; message = `${alert.ticker} moved ${q.change_pct > 0 ? "+" : ""}${q.change_pct.toFixed(2)}% — threshold ±${threshold}%`; }
        break;
      }

      case "pct_drop": {
        const threshold = condition.pct ?? 5;
        if (q.change_pct <= -threshold) { triggered = true; message = `${alert.ticker} DROPPED ${q.change_pct.toFixed(2)}% — below -${threshold}%`; }
        break;
      }

      case "avwap_reclaim":
      case "avwap_loss": {
        const bars = await getHistoricalOHLC(alert.ticker, "1y");
        if (bars.length > 10) {
          const maStatus = analyzeMAs(bars, q.price);
          if (alert.type === "avwap_reclaim" && maStatus.avwapReclaim) { triggered = true; message = `${alert.ticker} RECLAIMED 200 AVWAP at $${q.price.toFixed(2)}`; }
          if (alert.type === "avwap_loss"    && maStatus.avwapLoss)    { triggered = true; message = `${alert.ticker} LOST 200 AVWAP at $${q.price.toFixed(2)}`; }
        }
        break;
      }

      case "ma_cross": {
        const bars = await getHistoricalOHLC(alert.ticker, "1y");
        if (bars.length > 50) {
          const maStatus = analyzeMAs(bars, q.price);
          if (condition.crossType === "golden" && maStatus.goldenCross) { triggered = true; message = `${alert.ticker} GOLDEN CROSS — 50MA crossed above 200MA`; }
          if (condition.crossType === "death"  && maStatus.deathCross)  { triggered = true; message = `${alert.ticker} DEATH CROSS — 50MA crossed below 200MA`; }
          if (maStatus.ma50 && condition.ma50dir && maStatus.ma50Trending === condition.ma50dir) { triggered = true; message = `${alert.ticker} 50MA now trending ${maStatus.ma50Trending}`; }
        }
        break;
      }

      case "acceleration": {
        const hist = priceHistory.get(alert.ticker) ?? [];
        if (hist.length >= 4) {
          const sig = detectAcceleration(hist, alert.ticker);
          if (sig && sig.severity !== "none") {
            const minSeverity = condition.minSeverity ?? "warning";
            const sevOrder    = { none: 0, warning: 1, danger: 2, critical: 3 };
            if ((sevOrder[sig.severity] ?? 0) >= (sevOrder[minSeverity as keyof typeof sevOrder] ?? 1)) {
              triggered = true;
              message   = `${alert.ticker} RAPID ${sig.direction.toUpperCase()} DETECTED [${sig.severity}] — Proj 5min: ${sig.projected5.toFixed(1)}%`;
              if (alert.notify_sms) await sendSMS(buildAccelerationSMS(alert.ticker, sig.projected5, sig.severity), settings);
            }
          }
        }
        break;
      }

      case "volume_spike": {
        const ratio    = q.volume / (q.avg_volume || 1);
        const minRatio = condition.ratio ?? 2;
        if (ratio >= minRatio) { triggered = true; message = `${alert.ticker} VOLUME SPIKE — ${ratio.toFixed(1)}x average volume`; }
        break;
      }
    }

    if (!triggered) continue;

    await logAlertTrigger(alert.id, alert.ticker, alert.type, message, q.price);

    const newsItems = settings.finnhub_key ? await getFinnhubNews(alert.ticker, settings.finnhub_key) : [];
    const payload   = buildPriceAlertEmail({
      ticker: alert.ticker, name: q.name, alertType: alert.type,
      price: q.price, target: condition.target ?? q.price, changePct: q.change_pct,
      news: newsItems.slice(0, 3).map(n => ({ headline: n.headline, url: n.url })),
    });

    const notifyPs: Promise<boolean>[] = [];
    if (alert.notify_email) notifyPs.push(sendEmail(payload, settings));
    if (alert.notify_sms)   notifyPs.push(sendSMS(buildSMSAlert(alert.ticker, alert.type, q.price, q.change_pct), settings));
    await Promise.allSettled(notifyPs);
  }
}
