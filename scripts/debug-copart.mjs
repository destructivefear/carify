import { chromium } from "playwright";

const LOT = process.argv[2] || "99999495";
const HEADLESS = process.env.HEADFUL ? false : true;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({
  userAgent: UA,
  viewport: { width: 1366, height: 900 },
  locale: "en-US",
});
const page = await ctx.newPage();

console.log(`[debug] headless=${HEADLESS} lot=${LOT}`);
console.log("[debug] warming on search page...");
await page.goto(
  "https://www.copart.com/lotSearchResults/?free=true&query=toyota",
  { waitUntil: "domcontentloaded", timeout: 45000 }
);
await page.waitForTimeout(4000);
console.log("[debug] warm page title:", await page.title());

const res = await page.evaluate(async (ln) => {
  const out = {};
  try {
    const r = await fetch(
      `https://www.copart.com/public/data/lotdetails/solr/${ln}`,
      { headers: { Accept: "application/json" } }
    );
    out.status = r.status;
    const txt = await r.text();
    out.len = txt.length;
    out.snippet = txt.slice(0, 400);
    try {
      const j = JSON.parse(txt);
      out.hasLotDetails = !!(j && j.data && j.data.lotDetails);
      out.returnCode = j?.returnCode;
    } catch (e) {
      out.parseError = String(e);
    }
  } catch (e) {
    out.fetchError = String(e);
  }
  return out;
}, LOT);

console.log("[debug] fetch result:", JSON.stringify(res, null, 2));

await browser.close();
