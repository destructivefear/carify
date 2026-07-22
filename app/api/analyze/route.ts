import { NextRequest } from "next/server";
import { getLot, parseLotNumber } from "@/lib/copart";
import { analyzeLot } from "@/lib/analyze";
import { buildReport } from "@/lib/profit";
import { anyCachedLot, getCachedLot, DEMO_ANALYSIS } from "@/lib/fixtures";
import type { Lot } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input") ?? "";
  const priceParam = req.nextUrl.searchParams.get("price");
  const useCache = req.nextUrl.searchParams.get("cache") === "1";

  const lotNumber = parseLotNumber(input);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(sse(event, data));
      const step = (label: string, state: string = "active") =>
        send("step", { label, state });

      try {
        if (!lotNumber) {
          send("error", {
            message:
              "Could not find a Copart lot number. Paste a full lot URL or the lot number.",
          });
          controller.close();
          return;
        }

        // 1. Fetch lot
        step("Fetching lot from Copart");
        let lot: Lot | null = null;
        let usedCache = false;

        if (useCache) {
          lot = getCachedLot(lotNumber) ?? anyCachedLot();
          usedCache = true;
        } else {
          try {
            lot = await getLot(lotNumber);
          } catch (e) {
            // transparent fallback to cache so the demo still renders
            const cached = getCachedLot(lotNumber) ?? anyCachedLot();
            lot = cached;
            usedCache = true;
            send("notice", {
              message:
                "Live fetch was blocked — showing a cached demo lot instead.",
              detail: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (!lot) {
          send("error", { message: "No lot data available." });
          controller.close();
          return;
        }

        send("lot", { lot, usedCache });
        step(
          usedCache ? "Loaded cached lot" : `Loaded lot ${lot.lotNumber}`,
          "done"
        );

        // 2. Analyze photos
        step(`Analyzing ${lot.photos.length} photos with Claude`);
        let analysis;
        try {
          analysis = await analyzeLot(lot);
        } catch (e) {
          if (usedCache) {
            // keep the demo alive: cached lot gets a cached verdict
            analysis = DEMO_ANALYSIS;
            send("notice", {
              message:
                "Photo analysis unavailable — showing a cached demo verdict.",
              detail: e instanceof Error ? e.message : String(e),
            });
          } else {
            throw e;
          }
        }
        step("Photo analysis complete", "done");

        // 3. Costs + profit
        step("Estimating Georgia import costs & profit");
        const defaultPrice =
          lot.currentBid && lot.currentBid > 0
            ? Math.round(lot.currentBid * 1.15)
            : Math.round((lot.estRetailValue ?? 5000) * 0.4);
        const purchaseUsd = priceParam ? Number(priceParam) : defaultPrice;
        const report = buildReport(lot, analysis, purchaseUsd);
        step("Report ready", "done");

        send("report", report);
        controller.close();
      } catch (e) {
        send("error", {
          message: e instanceof Error ? e.message : "Analysis failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
