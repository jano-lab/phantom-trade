/**
 * Technical Indicators Library
 * AVWAP, Moving Averages, Momentum Acceleration, RSI, MACD, Bollinger Bands
 */

import type { OHLCBar } from "@/lib/api/yahoo";

// ─────────────────────── Moving Averages ─────────────────────

export function sma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

export function ema(values: number[], period: number): (number | null)[] {
  const k      = 2 / (period + 1);
  const result: (number | null)[] = [];
  let prev: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (prev === null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      result.push(prev);
    }
  }
  return result;
}

// ─────────────────────── AVWAP ───────────────────────────────

export interface AVWAPResult {
  avwap:     number;
  upper1:    number;  // +1 std dev band
  lower1:    number;  // -1 std dev band
  upper2:    number;  // +2 std dev band
  lower2:    number;  // -2 std dev band
  anchored:  string;  // ISO date the AVWAP is anchored from
}

/**
 * Calculate Anchored VWAP from a specific anchor date
 * anchored from the start of the dataset by default (200-day AVWAP)
 */
export function calculateAVWAP(bars: OHLCBar[], anchorIndex = 0): AVWAPResult[] {
  const results: AVWAPResult[] = [];
  let cumTPV    = 0;
  let cumVol    = 0;
  let cumTPV2   = 0; // for variance
  const anchored = bars[anchorIndex]?.date?.toISOString() ?? "";

  for (let i = anchorIndex; i < bars.length; i++) {
    const bar = bars[i];
    const tp  = (bar.high + bar.low + bar.close) / 3;
    cumTPV  += tp * bar.volume;
    cumVol  += bar.volume;
    cumTPV2 += tp * tp * bar.volume;

    if (cumVol === 0) { results.push({ avwap: 0, upper1: 0, lower1: 0, upper2: 0, lower2: 0, anchored }); continue; }

    const avwap    = cumTPV / cumVol;
    const variance = cumTPV2 / cumVol - avwap * avwap;
    const stddev   = Math.sqrt(Math.max(0, variance));

    results.push({
      avwap,
      upper1:   avwap + stddev,
      lower1:   avwap - stddev,
      upper2:   avwap + 2 * stddev,
      lower2:   avwap - 2 * stddev,
      anchored,
    });
  }
  return results;
}

/**
 * Find AVWAP anchor points: 52-week high, 52-week low, IPO date, earnings dates
 */
export function findSignificantAnchors(bars: OHLCBar[]): number[] {
  const anchors = new Set<number>([0]); // always include year-start
  if (bars.length < 5) return [0];

  // 52-week high/low
  const slice = bars.slice(-252);
  let maxH = 0, maxI = 0, minL = Infinity, minI = 0;
  slice.forEach((b, i) => {
    if (b.high > maxH) { maxH = b.high; maxI = bars.length - slice.length + i; }
    if (b.low  < minL) { minL = b.low;  minI = bars.length - slice.length + i; }
  });
  anchors.add(maxI);
  anchors.add(minI);

  // Large gap days (potential earnings, news events)
  for (let i = 1; i < bars.length; i++) {
    const pct = Math.abs(bars[i].open - bars[i-1].close) / bars[i-1].close;
    if (pct > 0.07) anchors.add(i);
  }

  return Array.from(anchors).sort((a, b) => a - b);
}

// ─────────────────────── RSI ─────────────────────────────────

export function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(period).fill(null);
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }

  let avgGain = gains  / period;
  let avgLoss = losses / period;
  result.push(100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g    = diff > 0 ? diff : 0;
    const l    = diff < 0 ? -diff : 0;
    avgGain    = (avgGain * (period - 1) + g) / period;
    avgLoss    = (avgLoss * (period - 1) + l) / period;
    result.push(100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss)));
  }
  return result;
}

// ─────────────────────── MACD ────────────────────────────────

export interface MACDResult {
  macd:   number | null;
  signal: number | null;
  hist:   number | null;
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MACDResult[] {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalLine = ema(validMacd, signal);

  let si = 0;
  return macdLine.map((m) => {
    if (m === null) return { macd: null, signal: null, hist: null };
    const sig  = signalLine[si++] ?? null;
    const hist = m !== null && sig !== null ? m - sig : null;
    return { macd: m, signal: sig, hist };
  });
}

// ─────────────────────── Bollinger Bands ─────────────────────

export interface BollingerResult {
  upper:  number | null;
  middle: number | null;
  lower:  number | null;
}

export function bollingerBands(closes: number[], period = 20, stdMult = 2): BollingerResult[] {
  const middles = sma(closes, period);
  return middles.map((mid, i) => {
    if (mid === null || i < period - 1) return { upper: null, middle: null, lower: null };
    const slice  = closes.slice(i - period + 1, i + 1);
    const mean   = mid;
    const stddev = Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period);
    return { upper: mean + stdMult * stddev, middle: mean, lower: mean - stdMult * stddev };
  });
}

// ─────────────────────── Acceleration / Momentum ─────────────

export interface AccelerationSignal {
  ticker:       string;
  timestamp:    number;
  rate1min:     number;  // % change per minute
  rate5min:     number;
  rate15min:    number;
  acceleration: number;  // 2nd derivative - change in rate
  severity:     "none" | "warning" | "danger" | "critical";
  direction:    "up" | "down" | "flat";
  projected5:   number;  // projected % change in 5 min
  projected15:  number;  // projected % change in 15 min
}

/**
 * Detect acceleration in price movement using discrete derivative
 * priceHistory: array of { price, timestamp } oldest-first
 */
export function detectAcceleration(
  priceHistory: { price: number; timestamp: number }[],
  ticker = ""
): AccelerationSignal | null {
  if (priceHistory.length < 4) return null;
  const h = priceHistory;
  const n = h.length - 1;

  // Rate of change in different windows
  const calcRate = (from: number, to: number): number => {
    if (from < 0 || to >= h.length || from >= to) return 0;
    const minutes = (h[to].timestamp - h[from].timestamp) / 60000;
    if (minutes === 0) return 0;
    return ((h[to].price - h[from].price) / h[from].price) * 100 / minutes;
  };

  const rate1  = calcRate(Math.max(0, n - 1), n);
  const rate5  = calcRate(Math.max(0, n - 5), n);
  const rate15 = calcRate(Math.max(0, n - 15), n);

  // Acceleration = change in rate (2nd derivative)
  const prevRate5 = calcRate(Math.max(0, n - 10), Math.max(0, n - 5));
  const acceleration = rate5 - prevRate5;

  // Project forward
  const projected5  = rate5  * 5;
  const projected15 = rate15 * 15;

  const absChange5 = Math.abs(projected5);
  const direction: "up" | "down" | "flat" =
    rate5 > 0.05 ? "up" : rate5 < -0.05 ? "down" : "flat";

  let severity: AccelerationSignal["severity"] = "none";
  if (absChange5 > 3 && Math.abs(acceleration) > 0.05) severity = "warning";
  if (absChange5 > 5 && Math.abs(acceleration) > 0.1)  severity = "danger";
  if (absChange5 > 8 && Math.abs(acceleration) > 0.2)  severity = "critical";

  return { ticker, timestamp: Date.now(), rate1min: rate1, rate5min: rate5, rate15min: rate15, acceleration, severity, direction, projected5, projected15 };
}

// ─────────────────────── MA Analysis ─────────────────────────

export interface MAStatus {
  ma50:          number | null;
  ma200:         number | null;
  avwap200:      number | null;
  price:         number;
  above50ma:     boolean;
  above200ma:    boolean;
  aboveAVWAP:    boolean;
  ma50Trending:  "up" | "down" | "flat";
  goldenCross:   boolean;  // 50MA crossed above 200MA recently
  deathCross:    boolean;  // 50MA crossed below 200MA recently
  avwapReclaim:  boolean;  // just reclaimed AVWAP
  avwapLoss:     boolean;  // just lost AVWAP
}

export function analyzeMAs(bars: OHLCBar[], currentPrice: number): MAStatus {
  const closes  = bars.map(b => b.close);
  const sma50   = sma(closes, 50);
  const sma200  = sma(closes, 200);

  const last50  = sma50[sma50.length - 1];
  const last200 = sma200[sma200.length - 1];

  // 200-day AVWAP
  const avwapResults = calculateAVWAP(bars, Math.max(0, bars.length - 200));
  const avwap200    = avwapResults[avwapResults.length - 1]?.avwap ?? null;

  // MA50 trend
  const prev50  = sma50[sma50.length - 6] ?? null;
  const ma50Dir = last50 !== null && prev50 !== null
    ? (last50 > prev50 ? "up" : last50 < prev50 ? "down" : "flat")
    : "flat";

  // Cross detection (last 10 bars)
  let goldenCross = false, deathCross = false;
  for (let i = Math.max(0, sma50.length - 10); i < sma50.length - 1; i++) {
    const a50  = sma50[i],  a200  = sma200[i];
    const b50  = sma50[i+1], b200 = sma200[i+1];
    if (a50 !== null && b50 !== null && a200 !== null && b200 !== null) {
      if (a50 < a200 && b50 >= b200) goldenCross = true;
      if (a50 > a200 && b50 <= b200) deathCross  = true;
    }
  }

  // AVWAP reclaim/loss (compare last 2 prices vs AVWAP)
  const prevClose   = closes[closes.length - 2] ?? currentPrice;
  const avwapReclaim = avwap200 !== null && prevClose < avwap200 && currentPrice >= avwap200;
  const avwapLoss    = avwap200 !== null && prevClose > avwap200 && currentPrice <= avwap200;

  return {
    ma50:         last50,
    ma200:        last200,
    avwap200,
    price:        currentPrice,
    above50ma:    last50  !== null && currentPrice > last50,
    above200ma:   last200 !== null && currentPrice > last200,
    aboveAVWAP:   avwap200 !== null && currentPrice > avwap200,
    ma50Trending: ma50Dir as "up" | "down" | "flat",
    goldenCross,
    deathCross,
    avwapReclaim,
    avwapLoss,
  };
}

// ─────────────────────── Support / Resistance ─────────────────

export interface SRLevel {
  price:     number;
  type:      "support" | "resistance";
  strength:  number;  // 0-100
  touches:   number;
}

export function findSupportResistance(bars: OHLCBar[], levels = 5): SRLevel[] {
  const allPrices = bars.flatMap(b => [b.high, b.low, b.close]);
  const range     = Math.max(...allPrices) - Math.min(...allPrices);
  const bucket    = range / 50;

  const heatmap: Map<number, number> = new Map();
  allPrices.forEach(p => {
    const key = Math.round(p / bucket) * bucket;
    heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
  });

  const sorted   = Array.from(heatmap.entries()).sort((a, b) => b[1] - a[1]);
  const current  = bars[bars.length - 1]?.close ?? 0;

  return sorted.slice(0, levels * 2).map(([price, count]): SRLevel => ({
    price,
    type:    (price < current ? "support" : "resistance") as "support" | "resistance",
    strength: Math.min(100, Math.round((count / allPrices.length) * 1000)),
    touches: count,
  })).sort((a, b) => Math.abs(a.price - current) - Math.abs(b.price - current)).slice(0, levels);
}

// ─────────────────────── Stop Loss Suggestions ───────────────

export interface StopLossSuggestion {
  method:      string;
  price:       number;
  pct_below:   number;
  description: string;
  confidence:  "low" | "medium" | "high";
}

export function suggestStopLoss(bars: OHLCBar[], entryPrice: number, atr_period = 14): StopLossSuggestion[] {
  const closes = bars.map(b => b.close);
  const current = closes[closes.length - 1];

  // ATR-based stop
  const trueRanges = bars.slice(1).map((b, i) =>
    Math.max(b.high - b.low, Math.abs(b.high - bars[i].close), Math.abs(b.low - bars[i].close))
  );
  const atrValues  = sma(trueRanges, atr_period);
  const atr        = atrValues[atrValues.length - 1] ?? (current * 0.02);
  const atrStop    = current - 2 * atr;

  // Recent swing low
  const lookback    = bars.slice(-20);
  const swingLow    = Math.min(...lookback.map(b => b.low));

  // % based
  const pct8Stop    = entryPrice * 0.92;
  const pct5Stop    = entryPrice * 0.95;

  // AVWAP stop
  const avwapData   = calculateAVWAP(bars, Math.max(0, bars.length - 200));
  const avwapPrice  = avwapData[avwapData.length - 1]?.lower1 ?? 0;

  const mkSuggestion = (method: string, price: number, desc: string, conf: "low"|"medium"|"high"): StopLossSuggestion => ({
    method,
    price:       Math.max(0, price),
    pct_below:   current > 0 ? ((current - price) / current) * 100 : 0,
    description: desc,
    confidence:  conf,
  });

  return [
    mkSuggestion("ATR 2x",        atrStop,   "2× Average True Range below current price — adapts to volatility", "high"),
    mkSuggestion("Swing Low",     swingLow,  "Recent 20-day swing low — key technical level", "high"),
    mkSuggestion("AVWAP -1σ",     avwapPrice,"AVWAP minus one standard deviation band", "medium"),
    mkSuggestion("8% Rule",       pct8Stop,  "Classic 8% loss limit from entry — O'Neil method", "medium"),
    mkSuggestion("5% Tight Stop", pct5Stop,  "Tight 5% stop for high-conviction, low-risk trades", "low"),
  ].sort((a, b) => b.price - a.price);
}

// ─────────────────────── Price Targets ───────────────────────

export interface PriceTarget {
  method:      string;
  price:       number;
  pct_upside:  number;
  timeframe:   string;
  description: string;
}

export function suggestPriceTargets(bars: OHLCBar[], currentPrice: number): PriceTarget[] {
  const mk = (method: string, price: number, timeframe: string, desc: string): PriceTarget => ({
    method,
    price,
    pct_upside: ((price - currentPrice) / currentPrice) * 100,
    timeframe,
    description: desc,
  });

  const h52   = Math.max(...bars.slice(-252).map(b => b.high));
  const atr   = sma(bars.slice(1).map((b, i) => Math.max(b.high - b.low, Math.abs(b.high - bars[i].close))), 14);
  const atrV  = (atr[atr.length - 1] ?? currentPrice * 0.02);
  const range = Math.max(...bars.map(b => b.close)) - Math.min(...bars.map(b => b.close));
  const bb    = bollingerBands(bars.map(b => b.close));
  const bbU   = bb[bb.length - 1]?.upper ?? currentPrice * 1.1;

  return [
    mk("52-Week High",      h52,                    "3-6 months",    "Previous year's high — natural resistance & momentum target"),
    mk("BB Upper (2σ)",     bbU,                    "1-2 weeks",     "Bollinger upper band — mean reversion target"),
    mk("ATR Projected 5x",  currentPrice + 5 * atrV, "1-3 months",  "5× ATR extension — measured move"),
    mk("Range Extension",   currentPrice + range * 0.618, "3-6 months", "0.618 Fibonacci of full range added to current"),
    mk("Momentum +15%",     currentPrice * 1.15,    "1-2 months",    "15% momentum target for volatile growth stocks"),
    mk("Momentum +25%",     currentPrice * 1.25,    "2-4 months",    "25% swing target for high-beta positions"),
  ].filter(t => t.pct_upside > 0).sort((a, b) => a.price - b.price);
}
