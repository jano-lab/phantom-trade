/**
 * SQLite database schema & operations
 * Uses better-sqlite3 for synchronous, performant local storage
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "phantom.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Holdings: current positions
    CREATE TABLE IF NOT EXISTS holdings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      name          TEXT,
      shares        REAL    NOT NULL DEFAULT 0,
      avg_cost      REAL    NOT NULL DEFAULT 0,
      account       TEXT    NOT NULL DEFAULT 'brokerage',
      asset_type    TEXT    NOT NULL DEFAULT 'stock',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      notes         TEXT,
      UNIQUE(ticker, account)
    );

    -- Trades: full history of buy/sell
    CREATE TABLE IF NOT EXISTS trades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      action        TEXT    NOT NULL CHECK(action IN ('buy','sell','dividend','split')),
      shares        REAL    NOT NULL,
      price         REAL    NOT NULL,
      fees          REAL    NOT NULL DEFAULT 0,
      total         REAL    NOT NULL,
      account       TEXT    NOT NULL DEFAULT 'brokerage',
      trade_date    TEXT    NOT NULL,
      notes         TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
    CREATE INDEX IF NOT EXISTS idx_trades_date   ON trades(trade_date DESC);

    -- Watchlist
    CREATE TABLE IF NOT EXISTS watchlist (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL UNIQUE,
      name          TEXT,
      added_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      notes         TEXT
    );

    -- Alerts
    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      type          TEXT    NOT NULL,  -- price_above, price_below, pct_change, avwap_reclaim, avwap_loss, ma_cross, acceleration, insider_buy, insider_sell
      condition     TEXT    NOT NULL,  -- JSON blob with condition params
      active        INTEGER NOT NULL DEFAULT 1,
      triggered_at  TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      notify_email  INTEGER NOT NULL DEFAULT 1,
      notify_sms    INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON alerts(ticker);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);

    -- Alert history log
    CREATE TABLE IF NOT EXISTS alert_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id      INTEGER REFERENCES alerts(id),
      ticker        TEXT    NOT NULL,
      alert_type    TEXT    NOT NULL,
      message       TEXT    NOT NULL,
      price         REAL,
      triggered_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      notified      INTEGER NOT NULL DEFAULT 0
    );

    -- Price snapshots (cached prices for history)
    CREATE TABLE IF NOT EXISTS price_cache (
      ticker        TEXT    NOT NULL,
      price         REAL    NOT NULL,
      change_pct    REAL,
      volume        REAL,
      snapped_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(ticker, snapped_at)
    );

    -- Insights log
    CREATE TABLE IF NOT EXISTS insights (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL,  -- portfolio, trade, risk, opportunity
      title         TEXT    NOT NULL,
      body          TEXT    NOT NULL,
      severity      TEXT    NOT NULL DEFAULT 'info',
      ticker        TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      dismissed_at  TEXT
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT    PRIMARY KEY,
      value         TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed default settings
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('notification_email',    ''),
      ('notification_phone',    ''),
      ('smtp_host',             'smtp.gmail.com'),
      ('smtp_port',             '587'),
      ('smtp_user',             ''),
      ('smtp_pass',             ''),
      ('twilio_sid',            ''),
      ('twilio_token',          ''),
      ('twilio_from',           ''),
      ('finnhub_key',           ''),
      ('newsapi_key',           ''),
      ('alpha_vantage_key',     ''),
      ('alert_pct_threshold',   '5'),
      ('accel_window_min',      '30'),
      ('accel_pct_trigger',     '3'),
      ('auto_stop_loss_pct',    '8'),
      ('market_open',           '09:30'),
      ('market_close',          '16:00');
  `);
}

// ─────────────────────── Holdings ───────────────────────

export interface Holding {
  id: number;
  ticker: string;
  name: string | null;
  shares: number;
  avg_cost: number;
  account: string;
  asset_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getAllHoldings(): Holding[] {
  return getDb().prepare("SELECT * FROM holdings ORDER BY ticker").all() as Holding[];
}

export function upsertHolding(h: Omit<Holding, "id" | "created_at" | "updated_at">) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM holdings WHERE ticker=? AND account=?").get(h.ticker, h.account) as Holding | undefined;
  if (existing) {
    // Recalculate avg cost
    const totalShares = existing.shares + h.shares;
    const avgCost     = totalShares > 0
      ? (existing.shares * existing.avg_cost + h.shares * h.avg_cost) / totalShares
      : 0;
    db.prepare(`UPDATE holdings SET shares=?, avg_cost=?, name=?, updated_at=datetime('now') WHERE id=?`)
      .run(totalShares, avgCost, h.name ?? existing.name, existing.id);
  } else {
    db.prepare(`INSERT INTO holdings (ticker,name,shares,avg_cost,account,asset_type,notes)
                VALUES (?,?,?,?,?,?,?)`)
      .run(h.ticker, h.name, h.shares, h.avg_cost, h.account, h.asset_type, h.notes);
  }
}

export function deleteHolding(id: number) {
  getDb().prepare("DELETE FROM holdings WHERE id=?").run(id);
}

export function updateHoldingShares(id: number, shares: number, avg_cost: number) {
  getDb().prepare("UPDATE holdings SET shares=?, avg_cost=?, updated_at=datetime('now') WHERE id=?")
         .run(shares, avg_cost, id);
}

// ─────────────────────── Trades ─────────────────────────

export interface Trade {
  id: number;
  ticker: string;
  action: "buy" | "sell" | "dividend" | "split";
  shares: number;
  price: number;
  fees: number;
  total: number;
  account: string;
  trade_date: string;
  notes: string | null;
  created_at: string;
}

export function getAllTrades(ticker?: string): Trade[] {
  const db = getDb();
  if (ticker) {
    return db.prepare("SELECT * FROM trades WHERE ticker=? ORDER BY trade_date DESC").all(ticker) as Trade[];
  }
  return db.prepare("SELECT * FROM trades ORDER BY trade_date DESC").all() as Trade[];
}

export function insertTrade(t: Omit<Trade, "id" | "created_at">) {
  const db = getDb();
  const info = db.prepare(`INSERT INTO trades (ticker,action,shares,price,fees,total,account,trade_date,notes)
               VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(t.ticker, t.action, t.shares, t.price, t.fees, t.total, t.account, t.trade_date, t.notes);

  // Update holding
  const holding = db.prepare("SELECT * FROM holdings WHERE ticker=? AND account=?").get(t.ticker, t.account) as Holding | undefined;
  if (t.action === "buy") {
    if (holding) {
      const totalShares = holding.shares + t.shares;
      const avgCost     = (holding.shares * holding.avg_cost + t.shares * t.price) / totalShares;
      db.prepare("UPDATE holdings SET shares=?, avg_cost=?, updated_at=datetime('now') WHERE id=?")
        .run(totalShares, avgCost, holding.id);
    } else {
      db.prepare("INSERT INTO holdings (ticker,shares,avg_cost,account,asset_type) VALUES (?,?,?,?,'stock')")
        .run(t.ticker, t.shares, t.price, t.account);
    }
  } else if (t.action === "sell" && holding) {
    const remaining = Math.max(0, holding.shares - t.shares);
    if (remaining === 0) {
      db.prepare("DELETE FROM holdings WHERE id=?").run(holding.id);
    } else {
      db.prepare("UPDATE holdings SET shares=?, updated_at=datetime('now') WHERE id=?")
        .run(remaining, holding.id);
    }
  }

  return info.lastInsertRowid;
}

// ─────────────────────── Alerts ─────────────────────────

export interface Alert {
  id: number;
  ticker: string;
  type: string;
  condition: string;
  active: number;
  triggered_at: string | null;
  trigger_count: number;
  notify_email: number;
  notify_sms: number;
  created_at: string;
}

export function getAlerts(ticker?: string): Alert[] {
  const db = getDb();
  if (ticker) return db.prepare("SELECT * FROM alerts WHERE ticker=? ORDER BY created_at DESC").all(ticker) as Alert[];
  return db.prepare("SELECT * FROM alerts ORDER BY created_at DESC").all() as Alert[];
}

export function getActiveAlerts(): Alert[] {
  return getDb().prepare("SELECT * FROM alerts WHERE active=1").all() as Alert[];
}

export function insertAlert(a: Omit<Alert, "id" | "triggered_at" | "trigger_count" | "created_at">): number {
  const r = getDb().prepare(`INSERT INTO alerts (ticker,type,condition,active,notify_email,notify_sms)
               VALUES (?,?,?,?,?,?)`)
    .run(a.ticker, a.type, a.condition, a.active, a.notify_email, a.notify_sms);
  return r.lastInsertRowid as number;
}

export function deactivateAlert(id: number) {
  getDb().prepare("UPDATE alerts SET active=0 WHERE id=?").run(id);
}

export function deleteAlert(id: number) {
  getDb().prepare("DELETE FROM alerts WHERE id=?").run(id);
}

export function logAlertTrigger(alertId: number, ticker: string, type: string, message: string, price: number) {
  const db = getDb();
  db.prepare(`INSERT INTO alert_log (alert_id,ticker,alert_type,message,price) VALUES (?,?,?,?,?)`)
    .run(alertId, ticker, type, message, price);
  db.prepare(`UPDATE alerts SET triggered_at=datetime('now'), trigger_count=trigger_count+1 WHERE id=?`)
    .run(alertId);
}

export function getAlertLog(limit = 50) {
  return getDb().prepare("SELECT * FROM alert_log ORDER BY triggered_at DESC LIMIT ?").all(limit);
}

// ─────────────────────── Watchlist ──────────────────────

export interface WatchItem { id: number; ticker: string; name: string | null; added_at: string; notes: string | null; }

export function getWatchlist(): WatchItem[] {
  return getDb().prepare("SELECT * FROM watchlist ORDER BY ticker").all() as WatchItem[];
}
export function addToWatchlist(ticker: string, name?: string) {
  getDb().prepare("INSERT OR IGNORE INTO watchlist (ticker,name) VALUES (?,?)").run(ticker.toUpperCase(), name ?? null);
}
export function removeFromWatchlist(ticker: string) {
  getDb().prepare("DELETE FROM watchlist WHERE ticker=?").run(ticker.toUpperCase());
}

// ─────────────────────── Settings ───────────────────────

export function getSetting(key: string): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key=?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function setSetting(key: string, value: string) {
  getDb().prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))").run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare("SELECT key,value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ─────────────────────── Insights ───────────────────────

export interface Insight { id: number; category: string; title: string; body: string; severity: string; ticker: string | null; created_at: string; dismissed_at: string | null; }

export function getInsights(limit = 20): Insight[] {
  return getDb().prepare("SELECT * FROM insights WHERE dismissed_at IS NULL ORDER BY created_at DESC LIMIT ?").all(limit) as Insight[];
}
export function insertInsight(i: Omit<Insight, "id" | "created_at" | "dismissed_at">) {
  getDb().prepare("INSERT INTO insights (category,title,body,severity,ticker) VALUES (?,?,?,?,?)").run(i.category, i.title, i.body, i.severity, i.ticker);
}
export function dismissInsight(id: number) {
  getDb().prepare("UPDATE insights SET dismissed_at=datetime('now') WHERE id=?").run(id);
}

// ─────────────────────── Price cache ────────────────────

export function cachePrice(ticker: string, price: number, changePct: number, volume: number) {
  getDb().prepare("INSERT OR REPLACE INTO price_cache (ticker,price,change_pct,volume,snapped_at) VALUES (?,?,?,?,datetime('now'))")
    .run(ticker, price, changePct, volume);
}

export function getPriceHistory(ticker: string, hours = 24) {
  return getDb().prepare(`SELECT * FROM price_cache WHERE ticker=? AND snapped_at > datetime('now','-${hours} hours') ORDER BY snapped_at ASC`).all(ticker);
}
