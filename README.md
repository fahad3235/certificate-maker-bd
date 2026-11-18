# Certificate Maker BD

Offline bilingual (EN / বাংলা) certificate maker: design a certificate, preview it live at A4 proportions, issue it into a local history, and print it (or save as PDF) from the browser. No account, no server, no network calls — everything stays in the browser.

Live site: https://fahad3235.github.io/certificate-maker-bd/

## Problem

Teachers, clubs, and small teams in Bangladesh constantly need simple certificates — for a course, a workshop, a competition, a farewell. Existing options are either online design tools that need accounts and uploads, or Word templates that never quite print right. This is a small offline tool that does the one job well.

## Features

- **Live A4 preview** — the certificate updates as you type (name, title, achievement line, issuer, signer, date).
- **4 templates** — Classic Gold, Modern Teal, Academic Navy, Minimal Porcelain.
- **Landscape / portrait** A4 orientation.
- **Issue & history** — issued certificates are saved in localStorage; load, duplicate, or delete them; search the list.
- **Print / Save as PDF** — print CSS shows only the certificate, sized for A4 (set margins to None and background graphics on).
- **Sample certificate** — one click loads a filled example.
- **Export / import JSON** — backup issued certificates, with strict import validation (bad JSON, wrong shape, invalid certificate, duplicate id, >500 items all rejected).
- **EN / বাংলা toggle** — persisted, with Bengali digits for dates and counts.
- **Validation** — inline errors for missing/invalid name, title, issuer, or date; length limits on every field.
- **XSS-safe** — user text is rendered as text, never as HTML.

## Stack

- Pure HTML + CSS + vanilla JavaScript (no framework, no build step, no CDN).
- `js/data.js` — templates, orientations, i18n strings, sample certificate.
- `js/logic.js` — pure functions (validation, date formatting, import validation, file naming) shared by the app and the Node tests.
- `js/app.js` — browser glue (rendering, localStorage, print, export/import).
- Tests: `node:test` unit tests (`tests/test.js`) + raw-CDP headless-Chrome smoke test (`tests/smoke.mjs`).

## Prerequisites

Any modern browser. For tests: Node.js 18+ and a Chromium headless shell (used at `/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell` in this repo's CI-less setup; adjust `SHELL` in `tests/smoke.mjs` to your Chromium binary).

## Install & run

```bash
# just open it — no install step
open index.html
# or serve locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Testing

```bash
node tests/test.js    # 12 unit tests
node tests/smoke.mjs  # 40 headless-Chrome checks (1280px + 390px)
```

## Deployment

Static site — push to GitHub and enable GitHub Pages (main branch, root). No environment variables, no secrets.

## Limitations

- Print output depends on the browser's print dialog: for a true A4 PDF, choose "Save as PDF", paper A4, margins None, background graphics on.
- Issued certificates live only in the browser's localStorage; clearing browser data erases them — use Export JSON for a backup.
- Dates are Gregorian only (no Bangla-calendar conversion).
- No image/logo upload and no custom fonts — the four templates are the whole design set.
- The tool makes the document; it does not verify that the issuer is authorised to award it. Check details before issuing.

## Status

Complete MVP. Tests: 12/12 unit + 40/40 headless-Chrome smoke, 0 console/page errors, 0 network requests.
