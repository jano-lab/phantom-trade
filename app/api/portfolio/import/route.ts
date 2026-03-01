import { NextRequest, NextResponse } from "next/server";
import { upsertHolding, insertTrade } from "@/lib/db/schema";

/**
 * Import portfolio from CSV
 * Supports: Fidelity, Robinhood, Schwab, generic format, manual JSON
 */
export async function POST(req: NextRequest) {
  const body     = await req.json();
  const { format, data } = body as { format: string; data: any[] };

  let imported = 0;

  try {
    for (const row of data) {
      if (format === "fidelity") {
        // Fidelity CSV columns: Symbol, Description, Quantity, Last Price, Average Cost Basis, Account Name
        const ticker  = (row["Symbol"] ?? row["symbol"] ?? "").trim().toUpperCase();
        const shares  = parseFloat(row["Quantity"] ?? row["quantity"] ?? "0");
        const avgCost = parseFloat((row["Average Cost Basis"] ?? row["avg_cost"] ?? "0").replace(/[$,]/g, ""));
        const account = (row["Account Name"] ?? row["account"] ?? "brokerage").trim();
        const name    = (row["Description"] ?? row["name"] ?? "").trim();
        if (!ticker || shares <= 0) continue;
        upsertHolding({ ticker, name, shares, avg_cost: avgCost, account, asset_type: "stock", notes: null });
        imported++;

      } else if (format === "robinhood") {
        // Robinhood CSV: Symbol, Quantity, Average Cost, Name
        const ticker  = (row["Symbol"] ?? "").trim().toUpperCase();
        const shares  = parseFloat(row["Quantity"] ?? "0");
        const avgCost = parseFloat((row["Average Cost"] ?? "0").replace(/[$,]/g, ""));
        const name    = (row["Name"] ?? "").trim();
        if (!ticker || shares <= 0) continue;
        upsertHolding({ ticker, name, shares, avg_cost: avgCost, account: "robinhood", asset_type: "stock", notes: null });
        imported++;

      } else if (format === "coinbase") {
        // Coinbase Pro export: Asset, Quantity Purchased, Price at Purchase
        const ticker  = (row["Asset"] ?? "").trim().toUpperCase() + "-USD";
        const shares  = parseFloat(row["Quantity Purchased"] ?? "0");
        const avgCost = parseFloat((row["Price at Purchase"] ?? "0").replace(/[$,]/g, ""));
        if (!ticker || shares <= 0) continue;
        upsertHolding({ ticker, name: row["Asset"], shares, avg_cost: avgCost, account: "coinbase", asset_type: "crypto", notes: null });
        imported++;

      } else if (format === "trades") {
        // Generic trade history import
        const ticker = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
        const action = (row.action ?? row.type ?? "buy").toLowerCase();
        const shares = parseFloat(row.shares ?? row.quantity ?? "0");
        const price  = parseFloat((row.price ?? "0").toString().replace(/[$,]/g, ""));
        const date   = row.date ?? row.trade_date ?? new Date().toISOString().split("T")[0];
        const fees   = parseFloat(row.fees ?? "0");
        if (!ticker || shares <= 0) continue;
        insertTrade({
          ticker, action: action as any, shares, price,
          fees, total: shares * price + fees,
          account: row.account ?? "brokerage",
          trade_date: date, notes: row.notes ?? null,
        });
        imported++;

      } else {
        // Generic: { ticker, shares, avg_cost, account?, name? }
        const ticker  = (row.ticker ?? row.symbol ?? "").trim().toUpperCase();
        const shares  = parseFloat(row.shares ?? row.quantity ?? "0");
        const avgCost = parseFloat(row.avg_cost ?? row.cost ?? "0");
        if (!ticker || shares <= 0) continue;
        upsertHolding({
          ticker, name: row.name ?? null, shares, avg_cost: avgCost,
          account:    row.account ?? "brokerage",
          asset_type: row.asset_type ?? "stock",
          notes:      row.notes ?? null,
        });
        imported++;
      }
    }

    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    console.error("[Import]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
