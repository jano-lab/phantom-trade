# Phantom Trade — Setup Guide

> Signal Over Noise — Advanced portfolio intelligence, technical indicators, and real-time alert engine.

## Quick Start

```bash
cd phantom-trade
npm run dev
# Open http://localhost:3000
```

---

## Configuration (Settings Page)

Open **Settings** in the sidebar and fill in:

### 1. Your Contact Info
| Field | Value |
|-------|-------|
| Email | Where alert emails go |
| Phone | E.164 format: `+12125551234` |

### 2. Email (SMTP)
**Gmail (recommended):**
1. Enable 2FA on Google account
2. Go to Google Account → Security → App Passwords
3. Generate an app password for "Mail"
4. Use:
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - Username: `your@gmail.com`
   - Password: *(the app password)*

### 3. SMS via Twilio (Free tier available)
1. Sign up at [twilio.com](https://www.twilio.com)
2. Get a free phone number
3. Copy Account SID, Auth Token, and your Twilio phone number

### 4. Data APIs (all have free tiers)

| API | URL | Free Tier | Used For |
|-----|-----|-----------|----------|
| **Finnhub** | finnhub.io | 60 req/min | News, insider data, quotes |
| **NewsAPI** | newsapi.org | 100 req/day | Broader news coverage |
| **Alpha Vantage** | alphavantage.co | 25 req/day | Backup data |

> **Note:** Yahoo Finance is used by default with no API key for price data.

---

## Importing Your Portfolio

### From Fidelity
1. Log in to Fidelity → Accounts → Portfolio
2. Positions tab → Export (CSV)
3. Phantom Trade → Portfolio → Import → "Fidelity CSV"

### From Robinhood
1. Robinhood app → Account → Statements & History → Export
2. Phantom Trade → Portfolio → Import → "Robinhood CSV"

### From Coinbase
1. Coinbase → Taxes → Generate Report → Transaction History
2. Phantom Trade → Portfolio → Import → "Coinbase CSV"

### Manual Entry
- Portfolio → "Add Position" — enter ticker, shares, avg cost, and account

### For BTC on Ledger
- Manual entry: ticker `BTC-USD`, shares = BTC amount, account = "ledger"

---

## Alerts You Can Set

| Alert Type | What It Does |
|-----------|--------------|
| **Price Above/Below** | Triggers when price hits your target |
| **% Move (±)** | Triggers on ±X% daily move |
| **% Drop** | One-directional — drop alert only |
| **AVWAP Reclaim** | Price crosses back above 200-day AVWAP |
| **AVWAP Loss** | Price falls below 200-day AVWAP |
| **MA Cross** | Golden cross or death cross on 50/200MA |
| **Acceleration** | Early warning when a stock is falling rapidly |
| **Volume Spike** | Unusual volume (X× above average) |

---

## Momentum / Acceleration Detection

The acceleration engine works like this:
1. Prices are cached every 5 minutes (or every minute in cron mode)
2. A discrete second derivative is calculated: *change in rate of change*
3. If the projected 5-minute move exceeds the threshold, an alert fires

This is designed to give you a **head start** before a big tank — letting you sell a portion before the full move happens.

**Severity levels:**
- ⚠️ Warning: Projected -3%+ in 5 min
- 🔴 Danger: Projected -5%+ in 5 min
- 🚨 Critical: Projected -8%+ in 5 min

---

## Running in the Background (Off-Device Notifications)

### Option A: Vercel (Recommended — free tier)
```bash
npm i -g vercel
vercel login
vercel --prod

# Set secret for cron protection:
vercel env add CRON_SECRET
# Enter a random string

# Cron runs every minute automatically (see vercel.json)
```

### Option B: Local background process (computer must stay on)
```bash
# In a separate terminal:
npm run cron
# Keep this running; it checks alerts every 60 seconds
```

### Option C: Google Cloud Run
```bash
npm run build
# Deploy to Cloud Run with a Cloud Scheduler trigger
# Trigger: GET /api/cron every minute
```

### Option D: Railway / Render
Any Node.js-compatible cloud host. Set up a cron job to call `/api/cron` every minute.

---

## Technical Indicators Used

| Indicator | Description |
|-----------|-------------|
| **200-day AVWAP** | Anchored VWAP from 200 days ago with ±1σ / ±2σ bands |
| **50MA / 200MA** | Simple moving averages with trend direction |
| **Golden/Death Cross** | 50MA crossing above/below 200MA |
| **AVWAP Reclaim/Loss** | Real-time detection of price crossing AVWAP |
| **RSI** | 14-period Relative Strength Index |
| **MACD** | 12/26/9 MACD with histogram |
| **Bollinger Bands** | 20-period, 2σ bands |
| **ATR** | Average True Range — used for stop loss sizing |
| **Support/Resistance** | Price cluster detection via heatmap algorithm |
| **Price Acceleration** | 2nd derivative of price — crash early warning |

---

## Stop Loss & Price Target Engine

On the Portfolio page, select any holding and click **Targets** tab:

**Stop Loss Methods:**
- ATR 2× — adapts to volatility
- Swing Low — recent 20-day support
- AVWAP -1σ — AVWAP lower band
- 8% Rule — O'Neil's classic stop
- 5% Tight Stop — high-conviction

**Price Target Methods:**
- 52-week high
- Bollinger Band upper
- 5× ATR projection
- Fibonacci range extension
- 15% / 25% momentum targets

---

## Insider & Institutional Tracking

- **Form 4** data from SEC EDGAR and OpenInsider (free, no API key)
- **Finnhub** for richer insider transaction data (requires key)
- **Institutional holders** via Yahoo Finance (free)
- Buy/sell sentiment gauge shows insider conviction

---

## Portfolio Insights

Click **Refresh Insights** on the Insights page to generate:
- Concentration risk warnings (>20% single position)
- Big loser reviews (down >15%)
- Winner trimming suggestions (up >50%)
- Trade timing analysis ("sold too early")
- Diversification recommendations
- AVWAP and momentum event flags

---

## File Structure

```
phantom-trade/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── portfolio/page.tsx    # Portfolio + chart + targets
│   ├── watchlist/page.tsx    # Watchlist + indicators
│   ├── alerts/page.tsx       # Alert management
│   ├── trades/page.tsx       # Full trade history
│   ├── insights/page.tsx     # AI insights
│   ├── insiders/page.tsx     # Insider/institutional
│   ├── settings/page.tsx     # All settings
│   └── api/                  # All API routes
├── lib/
│   ├── api/yahoo.ts          # Yahoo Finance wrapper
│   ├── api/news.ts           # News aggregation
│   ├── api/insiders.ts       # Insider data
│   ├── indicators/index.ts   # All technical indicators
│   ├── alerts/engine.ts      # Alert evaluation engine
│   ├── notifications/index.ts# Email + SMS sender
│   └── db/schema.ts          # SQLite database
├── components/
│   ├── charts/StockChart.tsx # TradingView chart + AVWAP/MA
│   ├── charts/MomentumGauge.tsx # Acceleration display
│   └── ui/TickerSearch.tsx   # Predictive search
├── data/
│   └── phantom.db            # SQLite database (auto-created)
├── scripts/
│   └── cron.ts               # Background alert runner
└── vercel.json               # Cloud cron config
```

---

## Environment Variables

Create `.env.local` for local development (optional — settings page writes to DB):

```bash
CRON_SECRET=your_random_secret_here  # Protects /api/cron endpoint
```

---

## Data Sources

| Data | Source | Cost |
|------|--------|------|
| Real-time quotes | Yahoo Finance (via yahoo-finance2) | Free |
| Historical OHLC | Yahoo Finance | Free |
| Company news | Finnhub | Free (60 req/min) |
| Market news | NewsAPI | Free (100 req/day) |
| Insider trades | SEC EDGAR + OpenInsider | Free |
| Institutional holders | Yahoo Finance | Free |
| SMS alerts | Twilio | ~$0.0075/SMS |
| Email alerts | Your SMTP / Gmail | Free |
