export async function register() {
  // Only warm the Playwright/Copart browser on the Node.js server runtime.
  // This creates (and minimizes) the one-time headed window during boot, so no
  // stray Copart window appears when the first lot is analyzed on stage.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CARIFY_SKIP_WARM === "1") return;
  try {
    const { warmUp } = await import("@/lib/copart");
    // Fire-and-forget: never block server readiness on the Copart warm-up.
    void warmUp();
  } catch {
    /* best-effort: the request path re-warms and falls back to cache */
  }
}
