import Anthropic from "@anthropic-ai/sdk";
import type { Analysis, Lot } from "./types";

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_PHOTOS = 16;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

const SYSTEM = `You are a veteran salvage-car reseller who imports US auction cars into Georgia (the country) through the port of Poti and resells them locally.

You will receive a Copart lot's structured data plus its auction photos. Judge the car the way an experienced buyer would from photos alone: direction and severity of impact, deployed airbags, flood/water lines and rust, panel gaps and structural clues (frame rails visible in engine-bay shots), interior condition, wheel/suspension stance, and whether the odometer and title flags are consistent with the photos.

Cost everything in the GEORGIAN market context, not the US one:
- Used parts from local dismantlers and imported used parts are the norm and are far cheaper than US new OEM.
- Labor (bodywork, paint, mechanical) is inexpensive in Georgia.
- Give every part a realistic MIN-MAX USD range for parts obtained on the Georgian used-parts market.

Estimate the local resale price after a sensible repair (this generation of car, this mileage, salvage-title car on the Georgian market). Be realistic, Georgian buyers discount rebuilt cars.

Only claim what photos and data support. If photos are few or low quality, lower your confidence and say so.

Respond with ONLY a single JSON object, no prose, matching exactly this shape:
{
  "damageSummary": string,
  "damagePoints": [{ "area": string, "condition": string, "decision": "replace" | "repair" | "ok" }],
  "runnableAssessment": string,
  "floodRisk": "none" | "possible" | "likely",
  "structuralRisk": "low" | "medium" | "high",
  "partsToReplace": [{ "name": string, "priceMinUsd": number, "priceMaxUsd": number, "note": string }],
  "repairMinUsd": number,
  "repairMaxUsd": number,
  "resaleEstimateUsd": number,
  "confidence": "low" | "medium" | "high",
  "risks": [string],
  "notes": string
}
repairMinUsd/repairMaxUsd must be the total estimated repair incl. parts and labor (Georgian prices).`;

function buildLotContext(lot: Lot): string {
  const age = lot.year ? new Date().getFullYear() - lot.year : null;
  const lines = [
    `Lot #: ${lot.lotNumber}`,
    `Vehicle: ${[lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "unknown"}`,
    lot.vin ? `VIN: ${lot.vin}` : null,
    age !== null ? `Age: ~${age} years` : null,
    lot.primaryDamage ? `Primary damage: ${lot.primaryDamage}` : null,
    lot.secondaryDamage ? `Secondary damage: ${lot.secondaryDamage}` : null,
    lot.odometer !== null
      ? `Odometer: ${lot.odometer.toLocaleString()} mi (${lot.odometerBrand ?? "unknown brand"})`
      : null,
    lot.driveable !== null
      ? `Run & drive flag: ${lot.driveable ? "yes" : "no"}`
      : null,
    lot.titleType ? `Title: ${lot.titleType}` : null,
    lot.saleDocument ? `Sale document: ${lot.saleDocument}` : null,
    lot.hasKeys ? `Keys: ${lot.hasKeys}` : null,
    lot.fuel ? `Fuel: ${lot.fuel}` : null,
    lot.cylinders ? `Cylinders: ${lot.cylinders}` : null,
    lot.engineCc ? `Engine: ~${lot.engineCc} cc` : null,
    lot.transmission ? `Transmission: ${lot.transmission}` : null,
    lot.color ? `Color: ${lot.color}` : null,
    lot.location ? `Location: ${lot.location}` : null,
    lot.estRetailValue ? `Copart est. retail value: $${lot.estRetailValue}` : null,
    `Photos provided: ${Math.min(lot.photos.length, MAX_PHOTOS)}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function coerce(raw: unknown): Analysis {
  const o = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d = 0): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const parts = arr<Record<string, unknown>>(o.partsToReplace).map((p) => ({
    name: String(p.name ?? "Part"),
    priceMinUsd: num(p.priceMinUsd),
    priceMaxUsd: num(p.priceMaxUsd),
    note: p.note ? String(p.note) : undefined,
  }));

  const damagePoints = arr<Record<string, unknown>>(o.damagePoints).map((d) => {
    const decision = String(d.decision ?? "ok");
    return {
      area: String(d.area ?? ""),
      condition: String(d.condition ?? ""),
      decision: (decision === "replace" || decision === "repair"
        ? decision
        : "ok") as "replace" | "repair" | "ok",
    };
  });

  return {
    damageSummary: String(o.damageSummary ?? ""),
    damagePoints,
    runnableAssessment: String(o.runnableAssessment ?? ""),
    floodRisk: (["none", "possible", "likely"].includes(String(o.floodRisk))
      ? o.floodRisk
      : "none") as Analysis["floodRisk"],
    structuralRisk: (["low", "medium", "high"].includes(String(o.structuralRisk))
      ? o.structuralRisk
      : "low") as Analysis["structuralRisk"],
    partsToReplace: parts,
    repairMinUsd: num(o.repairMinUsd),
    repairMaxUsd: num(o.repairMaxUsd),
    resaleEstimateUsd: num(o.resaleEstimateUsd),
    confidence: (["low", "medium", "high"].includes(String(o.confidence))
      ? o.confidence
      : "medium") as Analysis["confidence"],
    risks: arr<string>(o.risks).map(String),
    notes: String(o.notes ?? ""),
  };
}

export async function analyzeLot(lot: Lot): Promise<Analysis> {
  const anthropic = client();
  // Only remote http(s) images are valid for the vision API; lazy-load
  // placeholders (data: URIs, svg spacers) trigger a 400 "invalid base64" if
  // forwarded, so drop anything that is not a real remote URL.
  const photos = lot.photos
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, MAX_PHOTOS);

  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: `${buildLotContext(lot)}\n\nAnalyze the photos below in order and return the JSON verdict.`,
    },
    ...photos.map(
      (url) =>
        ({
          type: "image",
          source: { type: "url", url },
        }) as unknown as Anthropic.ImageBlockParam
    ),
  ];

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return JSON");
  }
  return coerce(JSON.parse(jsonMatch[0]));
}
