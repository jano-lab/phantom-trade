/**
 * Database schema & operations — powered by Turso (libSQL, serverless SQLite)
 * Set env vars: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
 */
import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url:       process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export async function getDb(): Promise<Client> {
  const client = getClient();
  if (!_initPromise) {
    _initPromise = initSchema(client);
  }
  await _initPromise;
  return client;
}

async function initSchema(db: Client) {
  await db.executeMultiple(`
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

    CREATE TABLE IF NOT EXISTS trades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      action        TEXT    NOT NULL,
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

    CREATE TABLE IF NOT EXISTS watchlist (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL UNIQUE,
      name          TEXT,
      added_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      notes         TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      type          TEXT    NOT NULL,
      condition     TEXT    NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1,
      triggered_at  TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      notify_email  INTEGER NOT NULL DEFAULT 1,
      notify_sms    INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON alerts(ticker);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);

    CREATE TABLE IF NOT EXISTS alert_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id      INTEGER,
      ticker        TEXT    NOT NULL,
      alert_type    TEXT    NOT NULL,
      message       TEXT    NOT NULL,
      price         REAL,
      triggered_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      notified      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS price_cache (
      ticker        TEXT    NOT NULL,
      price         REAL    NOT NULL,
      change_pct    REAL,
      volume        REAL,
      snapped_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(ticker, snapped_at)
    );

    CREATE TABLE IF NOT EXISTS insights (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL,
      title         TEXT    NOT NULL,
      body          TEXT    NOT NULL,
      severity      TEXT    NOT NULL DEFAULT 'info',
      ticker        TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      dismissed_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT    PRIMARY KEY,
      value         TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

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

type AnyRow = Record<string, unknown>;

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

export async function getAllHoldings(): Promise<Holding[]> {
  const db = await getDb();
  const r = await db.execute("SELECT * FROM holdings ORDER BY ticker");
  return r.rows as unknown as Holding[];
}

export async function upsertHolding(h: Omit<Holding, "id" | "created_at" | "updated_at">) {
  const db = await getDb();
  const r = await db.execute({
    sql:  "SELECT * FROM holdings WHERE ticker=? AND account=?",
    args: [h.ticker, h.account],
  });
  const existing = r.rows[0] as AnyRow | undefined;

  if (existing) {
    const existShares = existing.shares as number;
    const existCost   = existing.avg_cost as number;
    const totalShares = existShares + h.shares;
    const avgCost     = totalShares > 0
      ? (existShares * existCost + h.shares * h.avg_cost) / totalShares
      : 0;
    await db.execute({
      sql:  "UPDATE holdings SET shares=?, avg_cost=?, name=?, updated_at=datetime('now') WHERE id=?",
      args: [totalShares, avgCost, h.name ?? (existing.name as string | null), existing.id as number],
    });
  } else {
    await db.execute({
      sql:  "INSERT INTO holdings (ticker,name,shares,avg_cost,account,asset_type,notes) VALUES (?,?,?,?,?,?,?)",
      args: [h.ticker, h.name, h.shares, h.avg_cost, h.account, h.asset_type, h.notes],
    });
  }
}

export async function deleteHolding(id: number) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM holdings WHERE id=?", args: [id] });
}

export async function updateHoldingShares(id: number, shares: number, avg_cost: number) {
  const db = await getDb();
  await db.execute({
    sql:  "UPDATE holdings SET shares=?, avg_cost=?, updated_at=datetime('now') WHERE id=?",
    args: [shares, avg_cost, id],
  });
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

export async function getAllTrades(ticker?: string): Promise<Trade[]> {
  const db = await getDb();
  if (ticker) {
    const r = await db.execute({
      sql:  "SELECT * FROM trades WHERE ticker=? ORDER BY trade_date DESC",
      args: [ticker],
    });
    return r.rows as unknown as Trade[];
  }
  const r = await db.execute("SELECT * FROM trades ORDER BY trade_date DESC");
  return r.rows as unknown as Trade[];
}

export async function insertTrade(t: Omit<Trade, "id" | "created_at">): Promise<number> {
  const db = await getDb();
  const r = await db.execute({
    sql:  "INSERT INTO trades (ticker,action,shares,price,fees,total,account,trade_date,notes) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [t.ticker, t.action, t.shares, t.price, t.fees, t.total, t.account, t.trade_date, t.notes],
  });

  const hr      = await db.execute({ sql: "SELECT * FROM holdings WHERE ticker=? AND account=?", args: [t.ticker, t.account] });
  const holding = hr.rows[0] as AnyRow | undefined;

  if (t.action === "buy") {
    if (holding) {
      const totalShares = (holding.shares as number) + t.shares;
      const avgCost     = ((holding.shares as number) * (holding.avg_cost as number) + t.shares * t.price) / totalShares;
      await db.execute({ sql: "UPDATE holdings SET shares=?, avg_cost=?, updated_at=datetime('now') WHERE id=?", args: [totalShares, avgCost, holding.id as number] });
    } else {
      await db.execute({ sql: "INSERT INTO holdings (ticker,shares,avg_cost,account,asset_type) VALUES (?,?,?,?,'stock')", args: [t.ticker, t.shares, t.price, t.account] });
    }
  } else if (t.action === "sell" && holding) {
    const remaining = Math.max(0, (holding.shares as number) - t.shares);
    if (remaining === 0) {
      await db.execute({ sql: "DELETE FROM holdings WHERE id=?", args: [holding.id as number] });
    } else {
      await db.execute({ sql: "UPDATE holdings SET shares=?, updated_at=datetime('now') WHERE id=?", args: [remaining, holding.id as number] });
    }
  }

  return Number(r.lastInsertRowid);
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

export async function getAlerts(ticker?: string): Promise<Alert[]> {
  const db = await getDb();
  if (ticker) {
    const r = await db.execute({ sql: "SELECT * FROM alerts WHERE ticker=? ORDER BY created_at DESC", args: [ticker] });
    return r.rows as unknown as Alert[];
  }
  const r = await db.execute("SELECT * FROM alerts ORDER BY created_at DESC");
  return r.rows as unknown as Alert[];
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const db = await getDb();
  const r = await db.execute("SELECT * FROM alerts WHERE active=1");
  return r.rows as unknown as Alert[];
}

export async function insertAlert(a: Omit<Alert, "id" | "triggered_at" | "trigger_count" | "created_at">): Promise<number> {
  const db = await getDb();
  const r = await db.execute({
    sql:  "INSERT INTO alerts (ticker,type,condition,active,notify_email,notify_sms) VALUES (?,?,?,?,?,?)",
    args: [a.ticker, a.type, a.condition, a.active, a.notify_email, a.notify_sms],
  });
  return Number(r.lastInsertRowid);
}

export async function deactivateAlert(id: number) {
  const db = await getDb();
  await db.execute({ sql: "UPDATE alerts SET active=0 WHERE id=?", args: [id] });
}

export async function deleteAlert(id: number) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM alerts WHERE id=?", args: [id] });
}

export async function logAlertTrigger(alertId: number, ticker: string, type: string, message: string, price: number) {
  const db = await getDb();
  await db.execute({ sql: "INSERT INTO alert_log (alert_id,ticker,alert_type,message,price) VALUES (?,?,?,?,?)", args: [alertId, ticker, type, message, price] });
  await db.execute({ sql: "UPDATE alerts SET triggered_at=datetime('now'), trigger_count=trigger_count+1 WHERE id=?", args: [alertId] });
}

export async function getAlertLog(limit = 50) {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT * FROM alert_log ORDER BY triggered_at DESC LIMIT ?", args: [limit] });
  return r.rows;
}

// ─────────────────────── Watchlist ──────────────────────

export interface WatchItem { id: number; ticker: string; name: string | null; added_at: string; notes: string | null; }

export async function getWatchlist(): Promise<WatchItem[]> {
  const db = await getDb();
  const r = await db.execute("SELECT * FROM watchlist ORDER BY ticker");
  return r.rows as unknown as WatchItem[];
}

export async function addToWatchlist(ticker: string, name?: string) {
  const db = await getDb();
  await db.execute({ sql: "INSERT OR IGNORE INTO watchlist (ticker,name) VALUES (?,?)", args: [ticker.toUpperCase(), name ?? null] });
}

export async function removeFromWatchlist(ticker: string) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM watchlist WHERE ticker=?", args: [ticker.toUpperCase()] });
}

// ─────────────────────── Settings ───────────────────────

export async function getSetting(key: string): Promise<string> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT value FROM settings WHERE key=?", args: [key] });
  return (r.rows[0]?.["value"] as string) ?? "";
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.execute({ sql: "INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))", args: [key, value] });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const r = await db.execute("SELECT key,value FROM settings");
  return Object.fromEntries(r.rows.map(row => [row["key"] as string, row["value"] as string]));
}

// ─────────────────────── Insights ───────────────────────

export interface Insight { id: number; category: string; title: string; body: string; severity: string; ticker: string | null; created_at: string; dismissed_at: string | null; }

export async function getInsights(limit = 20): Promise<Insight[]> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT * FROM insights WHERE dismissed_at IS NULL ORDER BY created_at DESC LIMIT ?", args: [limit] });
  return r.rows as unknown as Insight[];
}

export async function insertInsight(i: Omit<Insight, "id" | "created_at" | "dismissed_at">) {
  const db = await getDb();
  await db.execute({ sql: "INSERT INTO insights (category,title,body,severity,ticker) VALUES (?,?,?,?,?)", args: [i.category, i.title, i.body, i.severity, i.ticker] });
}

export async function dismissInsight(id: number) {
  const db = await getDb();
  await db.execute({ sql: "UPDATE insights SET dismissed_at=datetime('now') WHERE id=?", args: [id] });
}

// ─────────────────────── Price cache ────────────────────

export async function cachePrice(ticker: string, price: number, changePct: number, volume: number) {
  const db = await getDb();
  await db.execute({ sql: "INSERT OR REPLACE INTO price_cache (ticker,price,change_pct,volume,snapped_at) VALUES (?,?,?,?,datetime('now'))", args: [ticker, price, changePct, volume] });
}

export async function getPriceHistory(ticker: string, hours = 24) {
  const db = await getDb();
  const r = await db.execute({ sql: `SELECT * FROM price_cache WHERE ticker=? AND snapped_at > datetime('now','-${hours} hours') ORDER BY snapped_at ASC`, args: [ticker] });
  return r.rows;
}
