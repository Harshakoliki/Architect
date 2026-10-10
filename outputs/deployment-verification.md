# Vercel deployment verification — 10 October 2026

## Result

- **Production URL:** https://productarchitect.vercel.app
- **Status:** Ready, live application checks passed.
- **Team:** Harsha Koliki’s projects (`harsha-kolikis-projects`), Hobby.
- **Project:** `architect`.
- **Verified application/configuration commit:** `7dfcb6987d1dbd6bb9396bf372c6734c904fff1b`.
- **Initial deployment:** `dpl_CF6HwqUQjTDbZoEGqy4BH6qFeWQT`, dashboard reported a 44-second build.
- **Frameworks:** Next.js frontend and FastAPI backend, one Vercel Services project.
- **Screenshot:** [Production landing page](architect-live.jpg).

## Deployment path

The authenticated connector could list the team but denied project creation with 403. Vercel CLI 63.1.2 was logged out. The already signed-in browser dashboard successfully imported the authorized public GitHub repository; no unrelated projects were changed and no account/billing upgrade was made.

The root Services configuration sends all public paths to Next.js. FastAPI has no public rewrite. A frontend binding supplies `ARCHITECT_BACKEND_URL`; the existing application-level internal-secret and workspace checks remain. A freshly generated 32-byte random service credential was entered as a sensitive Production/Preview variable. Its value is not in source, screenshots or this report.

The initially assigned generated alias was replaced during verification. Calls to the removed alias returned Vercel DEPLOYMENT_NOT_FOUND. All final checks used the current configured production domain, `productarchitect.vercel.app`; the domain settings showed Valid Configuration.

## Checks performed

| Check | Observed result |
|---|---|
| Production landing | Loads current text, charcoal/red illustration and plain text product name |
| Get started | Opens `/dashboard` |
| Anonymous HTTP health | 200 JSON: phase 5, preview storage, AI unconfigured |
| Real ZIP upload through public frontend proxy | 200 NDJSON, seven files, six connections, not persisted, not the annotated sample |
| Invalid ZIP | Error stage, no successful project result |
| Original bundled scan | Seven files, three parsed modules, six supported connections |
| Annotated product view | Four source-linked journey steps, explicitly no AI call |
| Natural-language sample question | Answered with the four upload steps, three supporting source excerpts and Open this flow navigation |
| Explanation switch | Technical mode shows cited source paths while preserving the flow |
| Updated sample comparison | One added, one removed, three modified files; eight relationship changes |
| Before source | Original api/main.py route `/api/documents`, ten lines, original hash |
| After source | Updated api/main.py route `/api/documents/upload`, twelve lines, updated hash and audit call |
| Reload behavior | Clears temporary workspace results as disclosed |

Only the public source fixture was uploaded for API checks. No private repository or provider key was transmitted.

## Observability and limits

- Browser and API tests verify the paths above. A broad production runtime-error scan and log-drain configuration were not verified; connector write permissions and CLI authentication remain unavailable. No monitoring integration was added.
- Supabase and OpenAI are unconfigured. Temporary browser previews and the annotated example work; live AI behavior and cloud persistence remain unverified.
- Services is beta. Service requests and compute consume the account’s included quotas. No paid upgrade was selected. References: https://vercel.com/docs/services ; https://vercel.com/docs/services/config-reference ; https://vercel.com/docs/services/bindings ; https://vercel.com/docs/services/pricing .
- Public demo uploads reach Vercel. Use public/sample code; the MVP does not provide accounts, durable quotas or complete abuse controls.
- History is bounded to eight captured versions in the open dashboard; no Git commit history, watcher, automatic refresh or runtime tracing.
- Phase 6 (full demo polish, accessibility, evidence-aware export, saved-scan deletion and broader reliability review) still requires owner approval.
