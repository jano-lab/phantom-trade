import { NextRequest, NextResponse } from "next/server";
import { upsertHolding, getDb } from "@/lib/db/schema";

/**
 * Import portfolio from CSV
 * Supports: Fidelity positions, Fidelity trade history, Robinhood, generic
 *
 * Trade history uses db.batch() — a single round-trip for all rows — to avoid
 * Vercel's function timeout that occurs when calling insertTrade() sequentially
 * for every row (each of which does 2-3 DB calls).
 */

/** Parse a numeric string safely — returns 0 for NaN, Infinity, or empty values.
 *  Also handles Fidelity's Unicode minus sign (U+2212 −) and parenthetical negatives. */
function safeFloat(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw)
    .replace(/\u2212/g, "-")        // Unicode minus → ASCII minus
    .replace(/^\((.+)\)$/, "-$1")   // (1,234.56) → -1234.56
    .replace(/[$, ]/g, "")
    .trim();
  if (s === "" || s === "-") return 0;
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  const body             = await req.json();
  const { format, data } = body as { format: string; data: any[] };

  let imported = 0;

  try {
    // ── Trade history formats: batch all inserts in one round-trip ──────────
    if (format === "fidelity_trades" || format === "trades") {
      const db         = await getDb();
      const statements: { sql: string; args: any[] }[] = [];

      for (const row of data) {
        if (format === "fidelity_trades") {
          const rawTicker = (row["Symbol"] ?? "").trim().toUpperCase();
          const ticker    = rawTicker.replace(/\*+$/, "");
          if (!ticker || ticker.length > 6 || !/^[A-Z.-]+$/.test(ticker)) continue;

          const rawAction = (row["Action"] ?? "").toUpperCase();
          let action: string | null = null;
          if      (rawAction.includes("BOUGHT") || rawAction.includes("REINVESTMENT") || rawAction.includes("PURCHASE")) action = "buy";
          else if (rawAction.includes("SOLD")   || rawAction.includes("SELL"))                                           action = "sell";
          else if (rawAction.includes("DIVIDEND") || rawAction.includes("INTEREST"))                                     action = "dividend";
          else if (rawAction.includes("SPLIT"))                                                                          action = "split";
          if (!action) continue;

          const shares = Math.abs(safeFloat(row["Quantity"]));
          const price  = Math.abs(safeFloat(row["Price ($)"] ?? row["Price"]));
          if (shares <= 0 && action !== "dividend") continue;
          if (price  <= 0 && action === "buy")      continue;

          const comm  = Math.abs(safeFloat(row["Commission ($)"] ?? row["Commission"]));
          const fees  = Math.abs(safeFloat(row["Fees ($)"]       ?? row["Fees"]));
          const total = action === "dividend"
            ? Math.abs(safeFloat(row["Amount ($)"] ?? row["Amount"]))
            : shares * price + comm + fees;

          const rawDate   = (row["Run Date"] ?? row["Settlement Date"] ?? "").trim();
          const dateParts = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          const tradeDate = dateParts
            ? `${dateParts[3]}-${dateParts[1].padStart(2, "0")}-${dateParts[2].padStart(2, "0")}`
            : new Date().toISOString().split("T")[0];

          const account = (row["Account"] ?? "brokerage")
            .replace(/^Individual.*?-\s*/i, "").trim() || "brokerage";

          statements.push({
            sql:  "INSERT INTO trades (ticker,action,shares,price,fees,total,account,trade_date,notes) VALUES (?,?,?,?,?,?,?,?,?)",
            args: [ticker, action, shares, price, comm + fees, total, account, tradeDate, null],
          });

        } else {
          // generic trades CSV
          const ticker = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
          const action = (row.action ?? row.type ?? "buy").toLowerCase();
          const shares = safeFloat(row.shares ?? row.quantity);
          const price  = safeFloat(row.price);
          const fees   = safeFloat(row.fees);
          const date   = row.date ?? row.trade_date ?? new Date().toISOString().split("T")[0];
          if (!ticker || shares <= 0) continue;
          statements.push({
            sql:  "INSERT INTO trades (ticker,action,shares,price,fees,total,account,trade_date,notes) VALUES (?,?,?,?,?,?,?,?,?)",
            args: [ticker, action, shares, price, fees, shares * price + fees, row.account ?? "brokerage", date, row.notes ?? null],
          });
        }
      }

      if (statements.length > 0) {
        await db.batch(statements);
      }
      imported = statements.length;

    // ── Position / holdings formats: upsert each row ────────────────────────
    } else {
      for (const row of data) {
        if (format === "fidelity") {
          const ticker  = (row["Symbol"]       ?? row["symbol"]   ?? "").trim().toUpperCase();
          const shares  = safeFloat(row["Quantity"]    ?? row["quantity"]);
          const avgCost = safeFloat(row["Average Cost Basis"] ?? row["avg_cost"]);
          const account = (row["Account Name"] ?? row["account"]  ?? "brokerage").trim();
          const name    = (row["Description"]  ?? row["name"]     ?? "").trim();
          if (!ticker || ticker.length > 6 || shares <= 0) continue;
          await upsertHolding({ ticker, name, shares, avg_cost: avgCost, account, asset_type: "stock", notes: null });
          imported++;

        } else if (format === "robinhood") {
          const ticker  = (row["Symbol"]       ?? "").trim().toUpperCase();
          const shares  = safeFloat(row["Quantity"]);
          const avgCost = safeFloat(row["Average Cost"]);
          const name    = (row["Name"]          ?? "").trim();
          if (!ticker || shares <= 0) continue;
          await upsertHolding({ ticker, name, shares, avg_cost: avgCost, account: "robinhood", asset_type: "stock", notes: null });
          imported++;

        } else {
          // generic positions CSV
          const ticker  = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
          const shares  = safeFloat(row.shares ?? row.quantity);
          const avgCost = safeFloat(row.avg_cost ?? row.cost);
          if (!ticker || shares <= 0) continue;
          await upsertHolding({ ticker, name: row.name ?? null, shares, avg_cost: avgCost, account: row.account ?? "brokerage", asset_type: row.asset_type ?? "stock", notes: row.notes ?? null });
          imported++;
        }
      }
    }

    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    console.error("[Import]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
