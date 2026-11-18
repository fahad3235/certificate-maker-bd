# TEST RESULTS — certificate-maker-bd (run #375, 16:00 slot, 2026-11-18)

## Unit tests — 12/12 pass
Run: `node tests/test.js` (Node v24.22.1, `node:test` + `node:assert/strict`).

- data: 4 templates + 2 orientations, unique ids, BN names present; sample validates
- toBnDigits converts all digits (`0123456789` -> Bengali digits; `2026-11-18` -> `২০২৬-১১-১৮`)
- formatDateLong: EN `18 November 2026`, BN `১৮ নভেম্বর ২০২৬`; rejects 2026-02-29 (not a leap year), 2026-13-01, 2026-04-31, `18-11-2026`, empty, null; accepts 2024-02-29
- isValidIsoDate agrees with formatDateLong
- templateById / orientationById fall back to first entry on unknown id
- validateCert: good draft passes; optional line/signer may be empty; each bad field flagged (name 0/1/81 chars, title 0/121, issuer blank, date invalid/empty, line 161, signer 81, bad template, bad orientation); boundary lengths (2 chars) pass
- normaliseCert: trims, rejects bad, requires id, rejects null/string/{}
- validateImport: happy path (1 cert), empty list ok, bad JSON -> badJson, `[]` -> badShape, bad cert -> badCert:1, duplicate id -> dupId:1, 501 certs -> tooMany; source object not mutated
- certFileName: `Certificate-Ishan-Ahmed-Fahad-2026-11-18.pdf`; punctuation-only name falls back to `certificate`
- certSummary: EN and BN date forms
- newId: unique, string, `c`-prefixed, alphanumeric

## Headless-Chrome smoke — 40/40 pass
Run: `node tests/smoke.mjs` (raw CDP, headless_shell, file://, 1280px + 390px).

- Initial render: title, 3 tabs, 4 template options, 2 orientation options, preview sheet, no overflow at 1280px, empty-state in Issued list
- Live preview: typed name/title/issuer appear in the certificate
- Validation: issuing with no date shows inline error and saves nothing
- Sample + issue: sample fills name + date `2026-11-18`; preview date `18 November 2026`; issue saves 1 cert, switches to Issued tab, card + count badge `1`
- Templates: modern / academic / minimal / classic classes applied; portrait class applied
- Duplicate -> 2 certs, badge `2`; Load returns to Make tab with the name; Delete (confirm stubbed) -> 1 cert
- Search: no-match shows empty state; `ishan` matches 1 card
- Reload persistence: 1 cert survives page reload (localStorage)
- BN toggle: BN title shown, preview date in Bengali digits, count badge `১`, `cmbd-lang=bn` persisted; back to EN
- XSS: `<script>alert(1)</script>` as a name renders as text, no script element created
- Mobile 390px: no horizontal overflow (scrollWidth <= 391), preview sheet >300px wide
- Zero console/page errors; zero network requests (fully offline)

## Repairs during testing (2 cycles)
1. `js/logic.js` called `require('./data.js')` unguarded — threw `require is not defined` in the browser and killed app init (15 smoke checks failed). Fixed with a Node/browser dual guard.
2. Same file then re-declared `const TEMPLATES` in the shared global lexical scope — `Identifier 'TEMPLATES' has already been declared` SyntaxError. Fixed by renaming logic.js locals to `TPL`/`ORI`/`M_EN`/`M_BN` (and two leftover `TEMPLATES[0]`/`ORIENTATIONS[0]` fallbacks).
3. One test-side fix: BN-date check ran after a reload when the form was empty; smoke now loads the sample before toggling language.

## Visual verification
- Desktop 1280px screenshot (`/tmp/cm-desktop.png`): navy header, form + live preview side by side, Classic Gold double border + star seal render correctly.
- Mobile 390px screenshot (`/tmp/cm-mobile.png`): single column, no overflow, form fully usable.

## Notes
- All sources pure ASCII (Bengali as `\uXXXX` escapes in JS, HTML entities in HTML); verified with `grep -P '[^\x00-\x7F]'` — zero matches.
- No fabricated data: the only pre-filled content is the clearly-labelled sample certificate; the Issued list ships empty.
