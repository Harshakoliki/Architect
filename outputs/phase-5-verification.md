# Phase 5 verification — 10 October 2026

## Delivered

- Minimal landing page at `/`, Get started → `/dashboard`, and plain text product name with the custom emblem removed.
- Captured-version timeline and Before/After selection, up to eight snapshots in the open dashboard.
- Added/removed/modified file counts and added/removed/evidence-updated supported relationships.
- Before/After maps and source links tied to the chosen version’s captured content and original hash.
- Second source-only sample for a no-key demonstration; no analyzed repository code is executed.
- README problem narrative expanded for solo builders, AI-assisted projects and teams; current landing/dashboard screenshots replace the older logo screenshot.

## Automated checks

| Check | Result |
|---|---|
| Backend pytest | 35 passed |
| Backend Ruff (`architect tests main.py`) | Passed |
| Frontend type checking | Passed |
| Snapshot comparison tests | 6 passed |
| Next.js production build | Passed; `/`, `/dashboard` and API proxy built |
| Diff whitespace check | Passed |

Focused comparison tests cover identical/nonmutating snapshots, path/hash file changes and rename representation, moved route declarations, changed paths with version IDs, missing/different analyzer versions, and duplicate evidence-edge aggregation. Backend fixture checks validate exact source changes and evidence hashes/spans. Provider tests remain mocked responses through the real SDK.

## Browser observations

- Get started from the landing page opened the dashboard.
- Original sample scan: seven files, three parsed modules, six supported relationships.
- Live changes → Try updated sample retained both captures and showed **one added file, one removed file, three modified files**, plus **eight relationship changes**: three added, two removed, three evidence/relation updates.
- `api/main.py` Before source showed the original ten lines and `/api/documents`, hash prefix `db7cb24c1bd5`.
- The matching After source showed twelve lines, the audit import/call and `/api/documents/upload`, hash prefix `5f37fa7d98d4`.
- Before map labeled the original route removed; After map labeled the updated route added. The selected updated HTTP candidate showed frontend and FastAPI source with the correct new line numbers and an explicit inferred label.
- Selecting the same snapshot on both sides showed “Choose two different snapshots to compare.”
- Desktop sidebar and smaller-screen Workspace view selector were exercised. Current captures show charcoal/red styling, circular ports, readable selected connections and no custom emblem.
- Browser error log query returned no errors for the tested flow.

## Evidence captures

- [Landing](architect-landing.jpg)
- [Current dashboard](architect-dashboard.jpg)
- [Version comparison](architect-phase-5.jpg)

## Boundaries and skipped checks

Comparison is browser-side over captured scans; it performs no additional provider call or upload. The tray disappears when the dashboard unmounts or reloads. Optional Supabase saves individual scans, not the selected comparison tray. Repository lineage is not verified, capture times are not Git commit times, and evidence changes do not prove changed behavior. Renames are removal/addition.

No Git history, automatic refresh, local watcher, feature semantic diff, full call graph or runtime tracing is implemented. No new dependencies or database migrations were introduced. Live OpenAI, live Supabase, fresh-machine setup, large-repository performance and deployed behavior were not checked in this phase. Hosting was separately authorized after these local checks; deployment verification will be recorded separately. Phase 6 awaits approval.
