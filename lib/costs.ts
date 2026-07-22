import type { Lot } from "./types";

/**
 * All figures are approximate hackathon-grade estimates in USD and are clearly
 * labeled as such in the UI. Constants are grouped here so they are easy to tweak.
 */

// Auction-to-Poti shipping estimate keyed by US state code.
// Reflects the usual pattern: East Coast / Gulf ports are cheaper to Georgia,
// inland and West Coast are pricier due to the ground leg to the export port.
const SHIPPING_BY_STATE: Record<string, number> = {
  NJ: 1250,
  NY: 1250,
  PA: 1300,
  MD: 1250,
  DE: 1250,
  VA: 1300,
  CT: 1300,
  MA: 1350,
  GA: 1350,
  SC: 1350,
  NC: 1350,
  FL: 1400,
  TX: 1500,
  LA: 1450,
  OH: 1500,
  IL: 1550,
  MI: 1550,
  TN: 1500,
  MO: 1650,
  MN: 1700,
  CO: 1900,
  AZ: 2050,
  NV: 2100,
  UT: 2000,
  WA: 2150,
  OR: 2150,
  CA: 2200,
};

const SHIPPING_FALLBACK = 1800;

// Copart buyer fee curve (bid tiers -> approximate combined fees for a
// non-member Guest buyer, incl. internet bid + gate + environmental).
function copartBuyerFee(bid: number): number {
  const tiers: Array<[number, number]> = [
    [0, 25],
    [100, 45],
    [200, 80],
    [500, 130],
    [1000, 200],
    [2000, 350],
    [4000, 500],
    [6000, 650],
    [8000, 775],
    [10000, 900],
    [15000, 1050],
  ];
  let fee = tiers[tiers.length - 1][1];
  for (let i = 0; i < tiers.length; i++) {
    if (bid < tiers[i][0]) {
      fee = tiers[Math.max(0, i - 1)][1];
      break;
    }
  }
  // above the top tier, fees scale ~ percentage of bid
  if (bid >= 15000) fee = Math.round(bid * 0.075);
  const gate = 79;
  const environmental = 15;
  return fee + gate + environmental;
}

// Simplified Georgia customs for imported passenger cars.
// Real Georgia import tax = excise (by engine cc and age) + 18% VAT + small clearance.
// This is a rough model good enough for a go / no-go margin signal.
function georgiaCustoms(engineCc: number | null, ageYears: number | null): number {
  const cc = engineCc ?? 2000;
  const age = ageYears ?? 6;

  // Excise base: per-cc rate rises with displacement.
  let perCc: number;
  if (cc <= 1000) perCc = 0.05;
  else if (cc <= 1500) perCc = 0.13;
  else if (cc <= 2000) perCc = 0.28;
  else if (cc <= 2500) perCc = 0.56;
  else if (cc <= 3000) perCc = 0.83;
  else if (cc <= 3500) perCc = 1.1;
  else perCc = 1.4;

  // Age coefficient: cheapest around 4-6 years, penalty for very new and very old.
  let ageCoef: number;
  if (age < 1) ageCoef = 1.5;
  else if (age <= 3) ageCoef = 1.2;
  else if (age <= 6) ageCoef = 1.0;
  else if (age <= 10) ageCoef = 1.1;
  else if (age <= 14) ageCoef = 1.4;
  else ageCoef = 1.9;

  const exciseGel = cc * perCc * ageCoef;
  const clearanceGel = 300; // customs clearance + import declaration, approx.
  const totalGel = exciseGel + clearanceGel;

  const GEL_PER_USD = 2.7;
  return Math.round(totalGel / GEL_PER_USD);
}

export function shippingForLot(lot: Lot): number {
  const code = (lot.state ?? "").toUpperCase().slice(0, 2);
  return SHIPPING_BY_STATE[code] ?? SHIPPING_FALLBACK;
}

export function auctionFeesForBid(bid: number): number {
  return copartBuyerFee(Math.max(0, bid));
}

export function customsForLot(lot: Lot): number {
  const age = lot.year ? new Date().getFullYear() - lot.year : null;
  return georgiaCustoms(lot.engineCc, age);
}
