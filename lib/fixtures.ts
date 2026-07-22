import type { Analysis, Lot } from "./types";

/**
 * Demo fallback. If the live Copart fetch fails during a demo, the API serves
 * one of these cached real lots so the report still renders end-to-end.
 * Photo URLs point at Copart's public image CDN (cs.copart.com).
 */
export const CACHED_LOTS: Record<string, Lot> = {
  "99901895": {
    lotNumber: "99901895",
    vin: null,
    make: "FORD",
    model: "FOCUS",
    year: 2012,
    trim: null,
    primaryDamage: "FRONT END",
    secondaryDamage: null,
    odometer: 128521,
    odometerBrand: "ACTUAL",
    driveable: false,
    titleType: "MANUAL",
    titleState: "NJ",
    saleDocument: null,
    hasKeys: "YES",
    fuel: "GAS",
    cylinders: "4",
    transmission: null,
    engineCc: 2000,
    color: null,
    location: "NJ - TRENTON",
    state: "NJ",
    estRetailValue: 4269,
    currentBid: 500,
    photos: [
      "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0126/4c21206368b241548f1d3d56255015bc_hrs.jpg",
      "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0126/8f4839f4d5254ed9ae721f01a6a7b828_hrs.jpg",
      "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/0126/65bd0e7493d74fbfbd461417488d67b9_hrs.jpg",
    ],
    sourceUrl: "https://www.copart.com/lot/99901895",
    fromCache: true,
  },
};

/**
 * Demo verdict for the cached Focus lot. Served when the Claude call is
 * unavailable (e.g. ANTHROPIC_API_KEY not set) so the demo renders end-to-end.
 */
export const DEMO_ANALYSIS: Analysis = {
  damageSummary:
    "Front-end impact concentrated on the bumper, hood and radiator support. No airbag deployment visible in the cabin shots, no water lines or rust in the interior.",
  damagePoints: [
    { area: "Front bumper", condition: "cracked, mounts torn", decision: "replace" },
    { area: "Hood", condition: "creased at the front edge", decision: "replace" },
    { area: "Radiator support", condition: "pushed back", decision: "repair" },
    { area: "Airbags", condition: "not deployed", decision: "ok" },
    { area: "Cabin", condition: "clean, no water traces", decision: "ok" },
  ],
  runnableAssessment:
    "Listed as non-runner; cooling pack likely damaged. Expect it to drive after radiator and condenser replacement.",
  floodRisk: "none",
  structuralRisk: "medium",
  partsToReplace: [
    { name: "Front bumper", priceMinUsd: 60, priceMaxUsd: 120, note: "used, local dismantler" },
    { name: "Hood", priceMinUsd: 80, priceMaxUsd: 150, note: "used, colour match optional" },
    { name: "Radiator + condenser", priceMinUsd: 70, priceMaxUsd: 140 },
    { name: "Headlight (left)", priceMinUsd: 40, priceMaxUsd: 90, note: "used" },
  ],
  repairMinUsd: 700,
  repairMaxUsd: 1200,
  resaleEstimateUsd: 3900,
  confidence: "medium",
  risks: [
    "Frame rails not visible in the cached photos — verify before bidding",
    "Non-runner flag: engine start unconfirmed",
  ],
  notes:
    "Cached demo verdict. Set ANTHROPIC_API_KEY in .env.local for live photo analysis.",
};

const CACHED_LIST = Object.values(CACHED_LOTS);

export function getCachedLot(lotNumber: string): Lot | null {
  if (CACHED_LOTS[lotNumber]) return { ...CACHED_LOTS[lotNumber] };
  return null;
}

export function anyCachedLot(): Lot {
  return { ...CACHED_LIST[0] };
}
