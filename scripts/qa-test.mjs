#!/usr/bin/env node
/**
 * Phantom Trade — Full QA Test Suite
 * Usage:  PHANTOM_URL=https://your-app.vercel.app node scripts/qa-test.mjs
 *         Or locally: node scripts/qa-test.mjs  (defaults to http://localhost:3000)
 */

const BASE = process.env.PHANTOM_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const PASS = "\x1b[32m✔\x1b[0m";
const FAIL = "\x1b[31m✘\x1b[0m";
const SKIP = "\x1b[33m◌\x1b[0m";
const HEAD = "\x1b[1m\x1b[34m";
const RESET = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await r.json(); } catch { json = null; }
  return { status: r.status, json };
}

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS} ${name}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(`${name}${detail ? ` (${detail})` : ""}`);
  }
}

function skip(name, reason) {
  console.log(`  ${SKIP} ${name} [skipped: ${reason}]`);
  skipped++;
}

function section(title) {
  console.log(`\n${HEAD}▶ ${title}${RESET}`);
}

// ─── Helpers ────────────────────────────────────────────

let createdHoldingId   = null;
let createdTradeId     = null;
let createdAlertId     = null;
let watchlistTicker    = "QA_TEST_" + Date.now();

// ─── TESTS ──────────────────────────────────────────────

section("1. Portfolio — Holdings CRUD");
{
  // Create
  const { status: s1, json: j1 } = await req("POST", "/api/portfolio", {
    ticker: "AAPL", shares: 10, avg_cost: 150, account: "qa-test", name: "Apple Inc", asset_type: "stock", notes: null,
  });
  assert("POST /api/portfolio returns 200", s1 === 200, `got ${s1}`);
  assert("POST /api/portfolio returns ok:true", j1?.ok === true, JSON.stringify(j1));

  // Read
  const { status: s2, json: j2 } = await req("GET", "/api/portfolio");
  assert("GET /api/portfolio returns 200", s2 === 200, `got ${s2}`);
  assert("GET /api/portfolio returns array", Array.isArray(j2), typeof j2);
  const holding = j2?.find(h => h.ticker === "AAPL" && h.account === "qa-test");
  assert("Holding created in DB", !!holding, "AAPL qa-test not found in holdings");
  createdHoldingId = holding?.id;

  // Update
  if (createdHoldingId) {
    const { status: s3, json: j3 } = await req("PATCH", "/api/portfolio", {
      id: createdHoldingId, shares: 15, avg_cost: 155,
    });
    assert("PATCH /api/portfolio returns ok", j3?.ok === true, JSON.stringify(j3));
    const { json: j4 } = await req("GET", "/api/portfolio");
    const updated = j4?.find(h => h.id === createdHoldingId);
    assert("Holding shares updated to 15", updated?.shares === 15, `got ${updated?.shares}`);
  }
}

section("2. Trades — Log & Read");
{
  const { status: s1, json: j1 } = await req("POST", "/api/trades", {
    ticker: "AAPL", action: "buy", shares: 5, price: 180, fees: 0,
    account: "qa-test", trade_date: "2024-01-15", notes: "QA test trade",
  });
  assert("POST /api/trades returns 200", s1 === 200, `got ${s1}`);
  assert("POST /api/trades returns ok", j1?.ok === true, JSON.stringify(j1));
  createdTradeId = j1?.id;

  const { status: s2, json: j2 } = await req("GET", "/api/trades");
  assert("GET /api/trades returns 200", s2 === 200, `got ${s2}`);
  assert("GET /api/trades returns array", Array.isArray(j2), typeof j2);

  const { status: s3, json: j3 } = await req("GET", "/api/trades?ticker=AAPL");
  assert("GET /api/trades?ticker=AAPL returns array", Array.isArray(j3), typeof j3);
  const trade = j3?.find(t => t.id === createdTradeId);
  assert("Trade persisted with correct ticker", trade?.ticker === "AAPL", `got ${trade?.ticker}`);
  assert("Trade price correct", trade?.price === 180, `got ${trade?.price}`);
}

section("3. Watchlist — Add, List, Remove");
{
  const { status: s1, json: j1 } = await req("POST", "/api/watchlist", {
    ticker: watchlistTicker, name: "QA Test Ticker",
  });
  assert("POST /api/watchlist returns ok", j1?.ok === true, JSON.stringify(j1));

  const { status: s2, json: j2 } = await req("GET", "/api/watchlist");
  assert("GET /api/watchlist returns 200", s2 === 200, `got ${s2}`);
  assert("GET /api/watchlist returns array", Array.isArray(j2), typeof j2);
  assert("Watchlist item found", j2?.some(w => w.ticker === watchlistTicker.toUpperCase()), "not found");

  const { json: j3 } = await req("DELETE", "/api/watchlist", { ticker: watchlistTicker });
  assert("DELETE /api/watchlist returns ok", j3?.ok === true, JSON.stringify(j3));
  const { json: j4 } = await req("GET", "/api/watchlist");
  assert("Watchlist item removed", !j4?.some(w => w.ticker === watchlistTicker.toUpperCase()), "still found");
}

section("4. Alerts — Create, List, Toggle, Delete");
{
  const { status: s1, json: j1 } = await req("POST", "/api/alerts", {
    ticker: "AAPL", type: "price_above",
    condition: { target: 250 },
    notify_email: 0, notify_sms: 0,
  });
  assert("POST /api/alerts returns ok", j1?.ok === true, JSON.stringify(j1));
  createdAlertId = j1?.id;

  const { status: s2, json: j2 } = await req("GET", "/api/alerts");
  assert("GET /api/alerts returns array", Array.isArray(j2), typeof j2);
  const alert = j2?.find(a => a.id === createdAlertId);
  assert("Alert created with correct ticker", alert?.ticker === "AAPL", `got ${alert?.ticker}`);
  assert("Alert created as active", alert?.active === 1, `got ${alert?.active}`);

  const { json: j3 } = await req("GET", "/api/alerts?ticker=AAPL");
  assert("GET /api/alerts?ticker=AAPL returns array", Array.isArray(j3), typeof j3);

  if (createdAlertId) {
    const { json: j4 } = await req("PATCH", "/api/alerts", { id: createdAlertId, active: 0 });
    assert("PATCH /api/alerts deactivate returns ok", j4?.ok === true, JSON.stringify(j4));

    const { json: j5 } = await req("DELETE", "/api/alerts", { id: createdAlertId });
    assert("DELETE /api/alerts returns ok", j5?.ok === true, JSON.stringify(j5));
  }

  const { json: j6 } = await req("GET", "/api/alerts?log=1");
  assert("GET /api/alerts?log=1 returns array", Array.isArray(j6), typeof j6);
}

section("5. Settings — Read & Write");
{
  const { status: s1, json: j1 } = await req("GET", "/api/settings");
  assert("GET /api/settings returns 200", s1 === 200, `got ${s1}`);
  assert("Settings is an object", typeof j1 === "object" && j1 !== null, typeof j1);
  assert("Settings has smtp_host key", "smtp_host" in (j1 ?? {}), Object.keys(j1 ?? {}).slice(0,5).join(","));
  assert("Secrets are masked", j1?.smtp_pass === "" || j1?.smtp_pass === "••••••••", `got '${j1?.smtp_pass}'`);

  const { json: j2 } = await req("POST", "/api/settings", { alert_pct_threshold: "7" });
  assert("POST /api/settings returns ok", j2?.ok === true, JSON.stringify(j2));
  const { json: j3 } = await req("GET", "/api/settings");
  assert("Settings value persisted", j3?.alert_pct_threshold === "7", `got ${j3?.alert_pct_threshold}`);
  // Restore
  await req("POST", "/api/settings", { alert_pct_threshold: "5" });
}

section("6. Insights — Generate & Dismiss");
{
  const { status: s1, json: j1 } = await req("GET", "/api/insights");
  assert("GET /api/insights returns 200", s1 === 200, `got ${s1}`);
  assert("Insights returns array", Array.isArray(j1), typeof j1);

  // Refresh endpoint (generates new insights from holdings)
  const { status: s2, json: j2 } = await req("GET", "/api/insights?refresh=1");
  assert("GET /api/insights?refresh=1 returns 200", s2 === 200, `got ${s2}`);
  assert("Refreshed insights is array", Array.isArray(j2), typeof j2);
}

section("7. Import — Portfolio CSV");
{
  const csvRows = [
    { ticker: "MSFT", shares: "5", avg_cost: "300", account: "qa-import", name: "Microsoft Corp", asset_type: "stock", notes: null },
  ];
  const { status, json } = await req("POST", "/api/portfolio/import", {
    format: "generic", data: csvRows,
  });
  assert("POST /api/portfolio/import returns 200", status === 200, `got ${status}`);
  assert("Import returns ok:true", json?.ok === true, JSON.stringify(json));
  assert("Import count = 1", json?.imported === 1, `got ${json?.imported}`);

  // Verify it landed in DB
  const { json: holdings } = await req("GET", "/api/portfolio");
  const imported = holdings?.find(h => h.ticker === "MSFT" && h.account === "qa-import");
  assert("Imported holding found in DB", !!imported, "MSFT qa-import not found");
}

section("8. Import — Fidelity Trade History format");
{
  const fidelityRows = [
    { "Run Date": "01/15/2024", "Account": "Individual - TOD X12345", "Action": "YOU BOUGHT", "Symbol": "NVDA",
      "Security Description": "NVIDIA Corp", "Quantity": "3", "Price ($)": "500.00",
      "Commission ($)": "0", "Fees ($)": "0.00", "Amount ($)": "-1500.00", "Settlement Date": "01/17/2024" },
    { "Run Date": "02/01/2024", "Account": "Individual - TOD X12345", "Action": "YOU SOLD", "Symbol": "NVDA",
      "Security Description": "NVIDIA Corp", "Quantity": "1", "Price ($)": "620.00",
      "Commission ($)": "0", "Fees ($)": "0.00", "Amount ($)": "620.00", "Settlement Date": "02/05/2024" },
    { "Run Date": "03/01/2024", "Account": "Individual - TOD X12345", "Action": "DIVIDEND RECEIVED", "Symbol": "AAPL",
      "Security Description": "Apple Inc", "Quantity": "1", "Price ($)": "0.25",
      "Commission ($)": "0", "Fees ($)": "0.00", "Amount ($)": "0.25", "Settlement Date": "03/01/2024" },
    // Should be skipped (unknown action)
    { "Run Date": "03/15/2024", "Account": "Individual", "Action": "TRANSFER OF ASSETS", "Symbol": "AAPL",
      "Quantity": "10", "Price ($)": "0", "Commission ($)": "0", "Fees ($)": "0" },
  ];
  const { status, json } = await req("POST", "/api/portfolio/import", {
    format: "fidelity_trades", data: fidelityRows,
  });
  assert("Fidelity trade import returns 200", status === 200, `got ${status}`);
  assert("Fidelity trade import ok:true", json?.ok === true, JSON.stringify(json));
  assert("Fidelity import count = 3 (4th skipped)", json?.imported === 3, `got ${json?.imported}`);
}

section("9. Prices — Quotes API");
{
  const { status: s1, json: j1 } = await req("GET", "/api/prices/quotes?tickers=SPY,AAPL");
  assert("GET /api/prices/quotes returns 200", s1 === 200, `got ${s1}`);
  assert("Quotes returns object", typeof j1 === "object" && j1 !== null, typeof j1);
  if (j1 && Object.keys(j1).length > 0) {
    const first = Object.values(j1)[0];
    assert("Quote has price field", typeof first?.price === "number", typeof first?.price);
    assert("Quote has change_pct field", typeof first?.change_pct === "number", typeof first?.change_pct);
  } else {
    skip("Quote field validation", "no data returned (check API key / rate limit)");
  }

  const { status: s2, json: j2 } = await req("GET", "/api/prices/quotes?ticker=MSFT");
  assert("GET /api/prices/quotes?ticker= returns 200", s2 === 200 || s2 === 200, `got ${s2}`);
}

section("10. Prices — Ticker Tape API");
{
  const { status, json } = await req("GET", "/api/prices/tape");
  assert("GET /api/prices/tape returns 200", status === 200, `got ${status}`);
  assert("Tape returns array", Array.isArray(json), typeof json);
  if (Array.isArray(json) && json.length > 0) {
    const item = json[0];
    assert("Tape item has ticker", typeof item?.ticker === "string", typeof item?.ticker);
    assert("Tape item has price", typeof item?.price === "number", typeof item?.price);
  }
}

section("11. News API");
{
  const { status, json } = await req("GET", "/api/news?ticker=AAPL");
  assert("GET /api/news?ticker=AAPL returns 200", status === 200, `got ${status}`);
  assert("News returns array", Array.isArray(json), typeof json);
}

section("12. Insiders API");
{
  const { status, json } = await req("GET", "/api/insiders?ticker=AAPL");
  assert("GET /api/insiders?ticker=AAPL returns 200", status === 200, `got ${status}`);
  assert("Insiders returns array", Array.isArray(json), typeof json);

  const { status: s2, json: j2 } = await req("GET", "/api/insiders?ticker=AAPL&type=institutional");
  assert("GET /api/insiders institutional returns 200", s2 === 200, `got ${s2}`);
}

section("13. Cron / Alert Engine");
{
  const { status, json } = await req("GET", "/api/cron");
  assert("GET /api/cron returns 200", status === 200, `got ${status}`);
  assert("Cron returns ok", json?.ok === true, JSON.stringify(json));
}

section("14. Error handling — bad inputs");
{
  const { status: s1 } = await req("GET", "/api/insiders");
  assert("GET /api/insiders without ticker returns 400", s1 === 400, `got ${s1}`);

  const { status: s2, json: j2 } = await req("GET", "/api/prices/acceleration");
  assert("GET /api/prices/acceleration without ticker returns 400", s2 === 400, `got ${s2}`);

  const { status: s3, json: j3 } = await req("POST", "/api/portfolio/import", {
    format: "fidelity_trades", data: [
      { "Action": "GARBAGE_VALUE", "Symbol": "AAPL", "Quantity": "0", "Price ($)": "0" }
    ],
  });
  assert("Import with 0 shares/invalid action skips row gracefully", j3?.ok === true && j3?.imported === 0, JSON.stringify(j3));
}

section("15. OHLC / Historical data");
{
  const { status, json } = await req("GET", "/api/prices/ohlc?ticker=AAPL&range=1mo");
  assert("GET /api/prices/ohlc returns 200", status === 200, `got ${status}`);
  assert("OHLC data is array", Array.isArray(json), typeof json);
}

// ─── Cleanup ────────────────────────────────────────────
section("16. Cleanup — remove QA test data");
{
  // Delete test holdings
  const { json: all } = await req("GET", "/api/portfolio");
  const qaHoldings = all?.filter(h => h.account === "qa-test" || h.account === "qa-import") ?? [];
  let deleted = 0;
  for (const h of qaHoldings) {
    const { json } = await req("DELETE", "/api/portfolio", { id: h.id });
    if (json?.ok) deleted++;
  }
  assert(`Cleaned up ${qaHoldings.length} QA test holdings`, deleted === qaHoldings.length, `deleted ${deleted}/${qaHoldings.length}`);
}

// ─── Summary ────────────────────────────────────────────
console.log("\n" + "═".repeat(52));
console.log(`${HEAD}PHANTOM TRADE — QA RESULTS${RESET}`);
console.log("═".repeat(52));
console.log(`  ${PASS} Passed:  ${passed}`);
console.log(`  ${FAIL} Failed:  ${failed}`);
console.log(`  ${SKIP} Skipped: ${skipped}`);
console.log(`  Total:   ${passed + failed + skipped}`);

if (failures.length > 0) {
  console.log("\n\x1b[31mFailing tests:\x1b[0m");
  failures.forEach(f => console.log(`  • ${f}`));
}

console.log(`\n  Tested against: ${BASE}`);
console.log("═".repeat(52) + "\n");

process.exit(failed > 0 ? 1 : 0);
