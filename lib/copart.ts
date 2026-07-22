import { chromium, type Browser, type BrowserContext } from "playwright";
import type { Lot } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

let browserPromise: Promise<Browser> | null = null;
let context: BrowserContext | null = null;
let warmed = false;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

async function getContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  if (!context) {
    context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1366, height: 900 },
      locale: "en-US",
    });
  }
  return context;
}

/**
 * Load a Copart page once so Imperva/Incapsula issues a valid clearance cookie
 * for this browser context. Subsequent in-page fetches to the public JSON
 * endpoints then succeed.
 */
async function warm(): Promise<void> {
  if (warmed) return;
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto("https://www.copart.com/lotSearchResults/?free=true&query=toyota", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    // Give the challenge script a moment to set the clearance cookie.
    await page.waitForTimeout(2500);
    warmed = true;
  } finally {
    await page.close();
  }
}

export function parseLotNumber(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/\/lot\/(\d+)/);
  if (m) return m[1];
  const q = trimmed.match(/(?:lot|lotNumber|ln)[=/](\d{6,})/i);
  if (q) return q[1];
  const bare = trimmed.match(/\b(\d{8,})\b/);
  if (bare) return bare[1];
  return null;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const num = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" ? null : str;
}

function parseEngineCc(details: Record<string, unknown>): number | null {
  const engine = s(details.egn) ?? s(details.eng) ?? s(details.engine);
  if (!engine) return null;
  const liters = engine.match(/([\d.]+)\s*L/i);
  if (liters) return Math.round(parseFloat(liters[1]) * 1000);
  const cc = engine.match(/(\d{3,4})\s*cc/i);
  if (cc) return parseInt(cc[1], 10);
  return null;
}

function pick(details: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (details[k] !== undefined && details[k] !== null && details[k] !== "") {
      return details[k];
    }
  }
  return null;
}

function normalize(
  lotNumber: string,
  details: Record<string, unknown>,
  photos: string[]
): Lot {
  const location = s(pick(details, ["yn", "ynm", "location"]));
  let state = s(pick(details, ["stt", "state", "lstadesc"]));
  if (!state && location && location.includes(" - ")) {
    state = location.split(" - ")[0].trim();
  }

  return {
    lotNumber,
    vin: s(pick(details, ["fv", "vin"])),
    make: s(pick(details, ["mkn", "lmk", "make"])),
    model: s(pick(details, ["lm", "lmc", "model"])),
    year: n(pick(details, ["lcy", "year"])),
    trim: s(pick(details, ["lcd", "trim"])),
    primaryDamage: s(pick(details, ["dd", "damage", "primaryDamage"])),
    secondaryDamage: s(pick(details, ["sdd", "secondaryDamage"])),
    odometer: n(pick(details, ["orr", "odometer"])),
    odometerBrand: s(pick(details, ["ord", "odometerBrand"])),
    driveable:
      typeof details.driveableInd === "boolean"
        ? (details.driveableInd as boolean)
        : typeof details.driveStatus === "boolean"
          ? (details.driveStatus as boolean)
          : null,
    titleType: s(pick(details, ["td", "tdd", "title", "titleType"])),
    titleState: s(pick(details, ["ts", "titleState"])),
    saleDocument: s(pick(details, ["sdd2", "saleDoc", "salvageDesc"])),
    hasKeys: s(pick(details, ["hk", "hasKeys"])),
    fuel: s(pick(details, ["ft", "fuel"])),
    cylinders: s(pick(details, ["cy", "cylinders"])),
    transmission: s(pick(details, ["tsmn", "transmission"])),
    engineCc: parseEngineCc(details),
    color: s(pick(details, ["clr", "color"])),
    location,
    state,
    estRetailValue: n(pick(details, ["la", "estimatedRetailValue"])),
    currentBid: n(pick(details, ["hb", "currentBid", "sbf", "cb"])),
    photos,
    sourceUrl: `https://www.copart.com/lot/${lotNumber}`,
    fromCache: false,
  };
}

interface RawFetch {
  detailsOk: boolean;
  details: Record<string, unknown>;
  photos: string[];
}

export async function getLot(lotNumber: string): Promise<Lot> {
  await warm();
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    const raw: RawFetch = await page.evaluate(async (ln: string) => {
      const result: {
        detailsOk: boolean;
        details: Record<string, unknown>;
        photos: string[];
      } = { detailsOk: false, details: {}, photos: [] };

      try {
        const r = await fetch(
          `https://www.copart.com/public/data/lotdetails/solr/${ln}`,
          { headers: { Accept: "application/json" } }
        );
        const j = await r.json();
        if (j?.data?.lotDetails) {
          result.details = j.data.lotDetails;
          result.detailsOk = true;
        }
      } catch {
        /* ignore */
      }

      try {
        const r = await fetch(
          `https://www.copart.com/public/data/lotdetails/solr/lotImages/${ln}`,
          { headers: { Accept: "application/json" } }
        );
        const j = await r.json();
        const content = j?.data?.imagesList?.content ?? [];
        result.photos = content
          .map(
            (c: { highResUrl?: string; fullUrl?: string }) =>
              c.highResUrl || c.fullUrl
          )
          .filter(Boolean);
      } catch {
        /* ignore */
      }

      return result;
    }, lotNumber);

    if (!raw.detailsOk) {
      throw new Error(`Copart returned no lot details for ${lotNumber}`);
    }

    return normalize(lotNumber, raw.details, raw.photos);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
  warmed = false;
}
