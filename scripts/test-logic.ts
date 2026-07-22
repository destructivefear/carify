// Deterministic feedback loop for CARify pure logic.
// Run: node scripts/test-logic.ts
import { auctionFeesForBid, shippingForLot, customsForLot } from "../lib/costs.ts";
import { computeCosts, buildReport } from "../lib/profit.ts";
import { parseLotNumber } from "../lib/copart.ts";
import type { Analysis, Lot } from "../lib/types.ts";

let pass = 0;
let fail = 0;
const fails: string[] = [];

function ok(cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    fails.push(msg);
    console.error("  FAIL:", msg);
  }
}
function eq(actual: unknown, expected: unknown, msg: string) {
  ok(actual === expected, `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function baseLot(over: Partial<Lot> = {}): Lot {
  return {
    lotNumber: "12345678",
    vin: null, make: "TOYOTA", model: "CAMRY", year: 2019, trim: "SE",
    primaryDamage: "FRONT END", secondaryDamage: null,
    odometer: 50000, odometerBrand: "ACTUAL", driveable: true,
    titleType: "SALVAGE", titleState: "GA", saleDocument: null, hasKeys: "YES",
    fuel: "GAS", cylinders: "6", transmission: null, engineCc: 3500,
    color: null, location: "GA - ATLANTA", state: "GA",
    estRetailValue: 15000, currentBid: 6200, photos: ["a", "b"],
    sourceUrl: "x", fromCache: false, ...over,
  };
}
function baseAnalysis(over: Partial<Analysis> = {}): Analysis {
  return {
    damageSummary: "", damagePoints: [], runnableAssessment: "",
    floodRisk: "none", structuralRisk: "low", partsToReplace: [],
    repairMinUsd: 1000, repairMaxUsd: 2000, resaleEstimateUsd: 14000,
    confidence: "high", risks: [], notes: "", ...over,
  };
}

console.log("== parseLotNumber ==");
eq(parseLotNumber("99901895"), "99901895", "bare number");
eq(parseLotNumber("https://www.copart.com/lot/58214937"), "58214937", "lot URL");
eq(parseLotNumber("  https://www.copart.com/lot/58214937/detail  "), "58214937", "lot URL w/ suffix + spaces");
eq(parseLotNumber("copart.com/lot/12345678?x=1"), "12345678", "lot URL w/ query");
eq(parseLotNumber("garbage"), null, "garbage -> null");
eq(parseLotNumber("12345"), null, "5 digits -> null (needs 6+)");
eq(parseLotNumber("ln=87654321"), "87654321", "ln= form");

console.log("== auctionFeesForBid (monotonic non-decreasing) ==");
let prev = -1;
let mono = true;
for (let bid = 0; bid <= 30000; bid += 50) {
  const f = auctionFeesForBid(bid);
  ok(f >= 0, `fee non-negative at bid ${bid} (got ${f})`);
  if (f < prev) { mono = false; }
  prev = f;
}
ok(mono, "auction fee is monotonic non-decreasing in bid");
eq(auctionFeesForBid(-100), auctionFeesForBid(0), "negative bid clamped to 0");

console.log("== shippingForLot ==");
eq(shippingForLot(baseLot({ state: "NJ" })), 1250, "NJ shipping");
eq(shippingForLot(baseLot({ state: "CA" })), 2200, "CA shipping");
eq(shippingForLot(baseLot({ state: "ZZ" })), 1800, "unknown state -> fallback");
eq(shippingForLot(baseLot({ state: null })), 1800, "null state -> fallback");
eq(shippingForLot(baseLot({ state: "ga" })), 1350, "lowercase state normalised");

console.log("== customsForLot (sanity, positive, monotonic in cc) ==");
const c2019 = customsForLot(baseLot({ year: 2019, engineCc: 3500 }));
ok(c2019 > 0, `customs positive (got ${c2019})`);
const cSmall = customsForLot(baseLot({ year: 2019, engineCc: 1000 }));
const cBig = customsForLot(baseLot({ year: 2019, engineCc: 3500 }));
ok(cBig > cSmall, `bigger engine costs more customs (${cSmall} vs ${cBig})`);
const cNull = customsForLot(baseLot({ engineCc: null, year: null }));
ok(cNull > 0, `customs with null engine/year uses defaults (got ${cNull})`);

console.log("== computeCosts: landed cost == sum of legs ==");
{
  const lot = baseLot();
  const a = baseAnalysis({ repairMinUsd: 1000, repairMaxUsd: 2000, resaleEstimateUsd: 14000 });
  const cb = computeCosts(lot, a, 6200);
  const expectedRepair = Math.round((1000 + 2000) / 2);
  eq(cb.repairUsd, expectedRepair, "repair = avg(min,max)");
  const legSum = cb.purchaseUsd + cb.auctionFeesUsd + cb.shippingUsd + cb.customsUsd + cb.repairUsd;
  eq(cb.landedCostUsd, legSum, "landedCost = sum of legs");
  eq(cb.netProfitUsd, cb.resaleUsd - cb.landedCostUsd, "netProfit = resale - landed");
  const expMargin = Math.round((cb.netProfitUsd / cb.landedCostUsd) * 100 * 10) / 10;
  eq(cb.marginPct, expMargin, "marginPct consistent");
}

console.log("== buildReport verdicts ==");
{
  // Clear BUY: high margin, low risk, driveable
  const buy = buildReport(
    baseLot({ driveable: true }),
    baseAnalysis({ resaleEstimateUsd: 20000, repairMinUsd: 500, repairMaxUsd: 800, structuralRisk: "low", floodRisk: "none", confidence: "high" }),
    5000
  );
  ok(buy.verdict === "BUY", `expected BUY, got ${buy.verdict} (score ${buy.score}, margin ${buy.costs.marginPct})`);
  ok(buy.score >= 0 && buy.score <= 100, `score in range (got ${buy.score})`);

  // Clear SKIP: negative margin
  const skip = buildReport(
    baseLot(),
    baseAnalysis({ resaleEstimateUsd: 3000, repairMinUsd: 4000, repairMaxUsd: 6000 }),
    8000
  );
  ok(skip.verdict === "SKIP", `expected SKIP for negative margin, got ${skip.verdict} (net ${skip.costs.netProfitUsd})`);

  // BUY must never coexist with negative profit
  let violated = false;
  for (let resale = 0; resale <= 30000; resale += 500) {
    for (let purchase = 1000; purchase <= 12000; purchase += 1000) {
      const r = buildReport(baseLot(), baseAnalysis({ resaleEstimateUsd: resale }), purchase);
      if (r.verdict === "BUY" && r.costs.netProfitUsd <= 0) { violated = true; }
    }
  }
  ok(!violated, "BUY never returned with non-positive net profit");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error("\nFAILURES:\n- " + fails.join("\n- "));
  process.exit(1);
}
