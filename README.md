# CARify

A tool that analyses US auto-auction lots (Copart / IAAI) for import and resale in Georgia: a vision model reads the lot photos and returns a verdict — buy or pass, which parts need replacing, and what the margin looks like.

## Landing page

Static, no build step: `index.html` + `tokens.css` + `styles.css`.

```bash
python3 -m http.server 8741
# → http://localhost:8741
```

The design system lives in `tokens.css` (OKLCH colours, fonts, spacing) — it ports to Next.js as-is.

## Planned backend stack

- Next.js (App Router) — `package.json` is already in the repo
- Anthropic SDK — lot photo analysis (vision)
- Playwright — scraping the lot page (photos, status, title)
