export type Verdict = "BUY" | "RISKY" | "SKIP";

export interface Lot {
  lotNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  primaryDamage: string | null;
  secondaryDamage: string | null;
  odometer: number | null;
  odometerBrand: string | null;
  driveable: boolean | null;
  titleType: string | null;
  titleState: string | null;
  saleDocument: string | null;
  hasKeys: string | null;
  fuel: string | null;
  cylinders: string | null;
  transmission: string | null;
  engineCc: number | null;
  color: string | null;
  location: string | null;
  state: string | null;
  estRetailValue: number | null;
  currentBid: number | null;
  photos: string[];
  sourceUrl: string;
  fromCache: boolean;
}

export interface PartToReplace {
  name: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  note?: string;
}

export interface DamagePoint {
  area: string;
  condition: string;
  decision: "replace" | "repair" | "ok";
}

export interface Analysis {
  damageSummary: string;
  damagePoints: DamagePoint[];
  runnableAssessment: string;
  floodRisk: "none" | "possible" | "likely";
  structuralRisk: "low" | "medium" | "high";
  partsToReplace: PartToReplace[];
  repairMinUsd: number;
  repairMaxUsd: number;
  resaleEstimateUsd: number;
  confidence: "low" | "medium" | "high";
  risks: string[];
  notes: string;
}

export interface CostBreakdown {
  purchaseUsd: number;
  auctionFeesUsd: number;
  shippingUsd: number;
  customsUsd: number;
  repairUsd: number;
  landedCostUsd: number;
  resaleUsd: number;
  netProfitUsd: number;
  marginPct: number;
}

export interface Report {
  lot: Lot;
  analysis: Analysis;
  costs: CostBreakdown;
  verdict: Verdict;
  score: number;
  headline: string;
}
