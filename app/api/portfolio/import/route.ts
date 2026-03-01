import { NextRequest, NextResponse } from "next/server";
import { upsertHolding, insertTrade } from "@/lib/db/schema";

/**
 * Import portfolio from CSV
 * Supports: Fidelity positions, Fidelity trade history, Robinhood, generic
 */
export async function POST(req: NextRequest) {
  const body             = await req.json();
  const { format, data } = body as { format: string; data: any[] };

  let imported = 0;

  try {
    for (const row of data) {
      if (format === "fidelity") {
        // Fidelity positions CSV
        const ticker  = (row["Symbol"] ?? row["symbol"] ?? "").trim().toUpperCase();
        const shares  = parseFloat(row["Quantity"] ?? row["quantity"] ?? "0");
        const avgCost = parseFloat((row["Average Cost Basis"] ?? row["avg_cost"] ?? "0").replace(/[$,]/g, ""));
        const account = (row["Account Name"] ?? row["account"] ?? "brokerage").trim();
        const name    = (row["Description"] ?? row["name"] ?? "").trim();
        if (!ticker || ticker.length > 6 || shares <= 0) continue;
        await upsertHolding({ ticker, name, shares, avg_cost: avgCost, account, asset_type: "stock", notes: null });
        imported++;

      } else if (format === "fidelity_trades") {
        // Fidelity Activity & Trades history CSV
        // Columns: Run Date, Account, Action, Symbol, Security Description, Quantity, Price ($), Commission ($), Fees ($), Amount ($)
        const rawTicker = (row["Symbol"] ?? "").trim().toUpperCase();
        const ticker    = rawTicker.replace(/\*+$/, ""); // strip trailing asterisks Fidelity adds
        if (!ticker || ticker.length > 6 || !/^[A-Z.-]+$/.test(ticker)) continue;

        const rawAction = (row["Action"] ?? "").toUpperCase();
        let action: "buy" | "sell" | "dividend" | "split" | null = null;
        if (rawAction.includes("BOUGHT") || rawAction.includes("REINVESTMENT") || rawAction.includes("PURCHASE")) action = "buy";
        else if (rawAction.includes("SOLD") || rawAction.includes("SELL"))                                          action = "sell";
        else if (rawAction.includes("DIVIDEND") || rawAction.includes("INTEREST"))                                  action = "dividend";
        else if (rawAction.includes("SPLIT"))                                                                       action = "split";
        if (!action) continue;

        const shares = Math.abs(parseFloat((row["Quantity"] ?? "0").replace(/[,]/g, "")));
        const price  = Math.abs(parseFloat((row["Price ($)"] ?? row["Price"] ?? "0").replace(/[$,]/g, "")));
        if (shares <= 0 || price <= 0) continue;

        const comm    = Math.abs(parseFloat((row["Commission ($)"] ?? row["Commission"] ?? "0").replace(/[$,]/g, "")));
        const fees    = Math.abs(parseFloat((row["Fees ($)"] ?? row["Fees"] ?? "0").replace(/[$,]/g, "")));
        const total   = shares * price + comm + fees;

        // Parse date: MM/DD/YYYY → YYYY-MM-DD
        const rawDate   = (row["Run Date"] ?? row["Settlement Date"] ?? "").trim();
        const dateParts = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        const tradeDate = dateParts
          ? `${dateParts[3]}-${dateParts[1].padStart(2,"0")}-${dateParts[2].padStart(2,"0")}`
          : new Date().toISOString().split("T")[0];

        const account = (row["Account"] ?? "brokerage").replace(/^Individual.*?-\s*/i, "").trim() || "brokerage";

        await insertTrade({ ticker, action, shares, price, fees: comm + fees, total, account, trade_date: tradeDate, notes: null });
        imported++;

      } else if (format === "robinhood") {
        const ticker  = (row["Symbol"] ?? "").trim().toUpperCase();
        const shares  = parseFloat(row["Quantity"] ?? "0");
        const avgCost = parseFloat((row["Average Cost"] ?? "0").replace(/[$,]/g, ""));
        const name    = (row["Name"] ?? "").trim();
        if (!ticker || shares <= 0) continue;
        await upsertHolding({ ticker, name, shares, avg_cost: avgCost, account: "robinhood", asset_type: "stock", notes: null });
        imported++;

      } else if (format === "trades") {
        const ticker = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
        const action = (row.action ?? row.type ?? "buy").toLowerCase();
        const shares = parseFloat(row.shares ?? row.quantity ?? "0");
        const price  = parseFloat((row.price ?? "0").toString().replace(/[$,]/g, ""));
        const date   = row.date ?? row.trade_date ?? new Date().toISOString().split("T")[0];
        const fees   = parseFloat(row.fees ?? "0");
        if (!ticker || shares <= 0) continue;
        await insertTrade({ ticker, action: action as any, shares, price, fees, total: shares * price + fees, account: row.account ?? "brokerage", trade_date: date, notes: row.notes ?? null });
        imported++;

      } else {
        const ticker  = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
        const shares  = parseFloat(row.shares ?? row.quantity ?? "0");
        const avgCost = parseFloat(row.avg_cost ?? row.cost ?? "0");
        if (!ticker || shares <= 0) continue;
        await upsertHolding({ ticker, name: row.name ?? null, shares, avg_cost: avgCost, account: row.account ?? "brokerage", asset_type: row.asset_type ?? "stock", notes: row.notes ?? null });
        imported++;
      }
    }

    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    console.error("[Import]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
