import { NextResponse } from "next/server";
import { auctionFeesForBid, shippingForLot, customsForLot } from "@/lib/costs";
import { computeCosts, buildReport } from "@/lib/profit";
import { parseLotNumber } from "@/lib/copart";
import type { Analysis, Lot } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const fails: string[] = [];
  let pass = 0;
  const ok = (cond: boolean, msg: string) => {
    if (cond) pass++;
    else fails.push(msg);
  };
  const eq = (a: unknown, e: unknown, msg: string) =>
    ok(a === e, `${msg} — expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);

  const baseLot = (over: Partial<Lot> = {}): Lot => ({
    lotNumber: "12345678", vin: null, make: "TOYOTA", model: "CAMRY", year: 2019,
    trim: "SE", primaryDamage: "FRONT END", secondaryDamage: null, odometer: 50000,
    odometerBrand: "ACTUAL", driveable: true, titleType: "SALVAGE", titleState: "GA",
    saleDocument: null, hasKeys: "YES", fuel: "GAS", cylinders: "6", transmission: null,
    engineCc: 3500, color: null, location: "GA - ATLANTA", state: "GA",
    estRetailValue: 15000, currentBid: 6200, photos: ["a", "b"], sourceUrl: "x",
    fromCache: false, ...over,
  });
  const baseAnalysis = (over: Partial<Analysis> = {}): Analysis => ({
    damageSummary: "", damagePoints: [], runnableAssessment: "", floodRisk: "none",
    structuralRisk: "low", partsToReplace: [], repairMinUsd: 1000, repairMaxUsd: 2000,
    resaleEstimateUsd: 14000, confidence: "high", risks: [], notes: "", ...over,
  });

  // parseLotNumber
  eq(parseLotNumber("99901895"), "99901895", "bare number");
  eq(parseLotNumber("https://www.copart.com/lot/58214937"), "58214937", "lot URL");
  eq(parseLotNumber("  https://www.copart.com/lot/58214937/detail  "), "58214937", "lot URL suffix");
  eq(parseLotNumber("copart.com/lot/12345678?x=1"), "12345678", "lot URL query");
  eq(parseLotNumber("garbage"), null, "garbage -> null");
  eq(parseLotNumber("12345"), null, "5 digits -> null");

  // auction fees monotonic + non-negative
  let prev = -1, mono = true;
  for (let bid = 0; bid <= 30000; bid += 50) {
    const f = auctionFeesForBid(bid);
    if (f < 0) fails.push(`fee negative at ${bid}`);
    if (f < prev) mono = false;
    prev = f;
  }
  ok(mono, "auction fee monotonic non-decreasing");
  eq(auctionFeesForBid(-100), auctionFeesForBid(0), "negative bid clamped");

  // shipping
  eq(shippingForLot(baseLot({ state: "NJ" })), 1250, "NJ shipping");
  eq(shippingForLot(baseLot({ state: "CA" })), 2200, "CA shipping");
  eq(shippingForLot(baseLot({ state: "ZZ" })), 1800, "unknown -> fallback");
  eq(shippingForLot(baseLot({ state: null })), 1800, "null -> fallback");
  eq(shippingForLot(baseLot({ state: "ga" })), 1350, "lowercase normalised");

  // customs
  const cSmall = customsForLot(baseLot({ year: 2019, engineCc: 1000 }));
  const cBig = customsForLot(baseLot({ year: 2019, engineCc: 3500 }));
  ok(cBig > cSmall, `bigger engine more customs (${cSmall} vs ${cBig})`);
  ok(customsForLot(baseLot({ engineCc: null, year: null })) > 0, "customs null defaults > 0");

  // computeCosts arithmetic
  {
    const cb = computeCosts(baseLot(), baseAnalysis({ repairMinUsd: 1000, repairMaxUsd: 2000, resaleEstimateUsd: 14000 }), 6200);
    eq(cb.repairUsd, 1500, "repair = avg");
    eq(cb.landedCostUsd, cb.purchaseUsd + cb.auctionFeesUsd + cb.shippingUsd + cb.customsUsd + cb.repairUsd, "landed = sum");
    eq(cb.netProfitUsd, cb.resaleUsd - cb.landedCostUsd, "net = resale - landed");
  }

  // verdict invariants
  {
    const buy = buildReport(baseLot({ driveable: true }),
      baseAnalysis({ resaleEstimateUsd: 20000, repairMinUsd: 500, repairMaxUsd: 800 }), 5000);
    ok(buy.verdict === "BUY", `expect BUY got ${buy.verdict} (score ${buy.score})`);
    const skip = buildReport(baseLot(),
      baseAnalysis({ resaleEstimateUsd: 3000, repairMinUsd: 4000, repairMaxUsd: 6000 }), 8000);
    ok(skip.verdict === "SKIP", `expect SKIP got ${skip.verdict}`);
    let violated = false;
    for (let resale = 0; resale <= 30000; resale += 500)
      for (let purchase = 1000; purchase <= 12000; purchase += 1000) {
        const r = buildReport(baseLot(), baseAnalysis({ resaleEstimateUsd: resale }), purchase);
        if (r.verdict === "BUY" && r.costs.netProfitUsd <= 0) violated = true;
      }
    ok(!violated, "BUY never with non-positive profit");
  }

  return NextResponse.json({ pass, fail: fails.length, fails });
}
