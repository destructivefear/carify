import { auctionFeesForBid, customsForLot, shippingForLot } from "./costs";
import type { Analysis, CostBreakdown, Lot, Report, Verdict } from "./types";

/**
 * Combine every cost leg into a landed cost and a profit / verdict.
 * `purchaseUsd` is the user's expected final hammer price.
 */
export function computeCosts(
  lot: Lot,
  analysis: Analysis,
  purchaseUsd: number
): CostBreakdown {
  const auctionFeesUsd = auctionFeesForBid(purchaseUsd);
  const shippingUsd = shippingForLot(lot);
  const customsUsd = customsForLot(lot);
  const repairUsd = Math.round(
    (analysis.repairMinUsd + analysis.repairMaxUsd) / 2
  );
  const resaleUsd = analysis.resaleEstimateUsd;

  const landedCostUsd =
    purchaseUsd + auctionFeesUsd + shippingUsd + customsUsd + repairUsd;
  const netProfitUsd = resaleUsd - landedCostUsd;
  const marginPct =
    landedCostUsd > 0 ? (netProfitUsd / landedCostUsd) * 100 : 0;

  return {
    purchaseUsd,
    auctionFeesUsd,
    shippingUsd,
    customsUsd,
    repairUsd,
    landedCostUsd,
    resaleUsd,
    netProfitUsd,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}

function scoreLot(
  lot: Lot,
  analysis: Analysis,
  costs: CostBreakdown
): number {
  let score = 50;

  // Profit margin is the dominant driver.
  if (costs.marginPct >= 30) score += 30;
  else if (costs.marginPct >= 20) score += 22;
  else if (costs.marginPct >= 12) score += 12;
  else if (costs.marginPct >= 6) score += 2;
  else if (costs.marginPct >= 0) score -= 10;
  else score -= 30;

  // Structural and flood risk are deal-killers for resale.
  if (analysis.structuralRisk === "high") score -= 22;
  else if (analysis.structuralRisk === "medium") score -= 8;

  if (analysis.floodRisk === "likely") score -= 25;
  else if (analysis.floodRisk === "possible") score -= 10;

  // Runs & drives is a strong positive signal.
  if (lot.driveable === true) score += 8;
  else if (lot.driveable === false) score -= 6;

  // Odometer sanity.
  if (lot.odometerBrand && /not actual|exempt|tmu/i.test(lot.odometerBrand)) {
    score -= 8;
  }

  // Low confidence widens uncertainty -> pull toward the middle.
  if (analysis.confidence === "low") score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function verdictFromScore(score: number, costs: CostBreakdown): Verdict {
  if (score >= 68 && costs.netProfitUsd > 0) return "BUY";
  if (score >= 45) return "RISKY";
  return "SKIP";
}

function headlineFor(
  verdict: Verdict,
  costs: CostBreakdown,
  analysis: Analysis
): string {
  const profit =
    costs.netProfitUsd >= 0
      ? `+$${costs.netProfitUsd.toLocaleString()}`
      : `-$${Math.abs(costs.netProfitUsd).toLocaleString()}`;
  switch (verdict) {
    case "BUY":
      return `Worth it — projected margin ${profit} (${costs.marginPct}%).`;
    case "RISKY":
      if (analysis.structuralRisk === "high")
        return `Thin margin and structural risk — only for an experienced buyer (${profit}).`;
      return `Marginal deal (${profit}) — buy only below your target price.`;
    case "SKIP":
      return costs.netProfitUsd < 0
        ? `Skip — the numbers go negative (${profit}).`
        : `Skip — risk outweighs the thin margin (${profit}).`;
  }
}

export function buildReport(
  lot: Lot,
  analysis: Analysis,
  purchaseUsd: number
): Report {
  const costs = computeCosts(lot, analysis, purchaseUsd);
  const score = scoreLot(lot, analysis, costs);
  const verdict = verdictFromScore(score, costs);
  const headline = headlineFor(verdict, costs, analysis);
  return { lot, analysis, costs, verdict, score, headline };
}
