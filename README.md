# CARify

Analyse a US auto-auction lot (Copart) for import and resale in Georgia: a
vision model reads the lot photos and returns a verdict — **buy or pass**, which
parts need replacing, whether it will run after repair, and the projected
margin once shipping to Poti, customs, and Georgian repair costs are priced in.

**Live:** https://carify.destructivefear.com

## How it works

1. **Link** — paste a Copart lot URL (or bare lot number).
2. **Fetch** — a headed Chromium (Playwright) clears Copart's Imperva challenge
   and pulls the lot JSON: photos, title, run-and-drive flag, odometer, region.
3. **Vision** — Claude reads up to 16 photos and returns a structured verdict.
4. **Economics** — landed cost vs. Georgian resale price → profit and a
   BUY / RISKY / SKIP call.

Results stream to the browser over Server-Sent Events, step by step.

## Stack

- **Next.js 16** (App Router) — UI + streaming `/api/analyze` route
- **@anthropic-ai/sdk** — photo analysis (vision)
- **Playwright** (Chromium) — Copart lot scraping

## Local development

```bash
npm install
cp .env.local.example .env.local   # then add your real key
npm run dev                         # http://localhost:3000
```

`.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Production (Docker)

The app ships as a single container built on the official Playwright image
(Chromium + system deps + Xvfb bundled). Secrets are injected at runtime via a
server-side `.env` (`chmod 600`) and never baked into the image.

```bash
# 1. put the API key in .env next to docker-compose.yml (not committed)
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env && chmod 600 .env

# 2. build + run (binds to 127.0.0.1:13010)
docker compose up -d --build
```

Deployed behind Cloudflare → nginx (`:80`) → the container on `127.0.0.1:13010`.
The container listens on loopback only; it is never exposed to the public
interface directly.

## Notes

- Copart sits behind Imperva/Incapsula, so the scraper runs a **headed**
  Chromium (via Xvfb on the server) — a headless shell gets challenged.
- On Node 24 the app forces the Anthropic SDK onto native `fetch`; the bundled
  `node-fetch` fallback throws `Premature close` while gunzipping responses.
- If a live fetch is blocked, the API transparently falls back to a cached demo
  lot so the report still renders end-to-end.
