# Visual Product Intelligence — Product Requirements Document

**Status:** Founder working draft
**Research as of:** 10 October 2026
**Working name:** Visual Product Intelligence (VPI)
**Document purpose:** Define the product promise, boundaries, testable first release, and decisions required before implementation. Product targets and prices below are hypotheses, not observed market facts.

## 1. Executive decision

Build a **local-first application that turns an authorized codebase into an explorable, evidence-linked model of the product**. A user can start with a local repository, select a feature such as “Document Upload,” and move among six connected views: architecture, user journey, data flow, feature relationships, dependencies, and changes over time. A plain-language question such as “Show me everything involved when a customer uploads a document” should resolve to a visual path with source links, a stated confidence level, and visible gaps.

The initial buyer is an engineering leader in a team with an active, moderately complex codebase. Developers are the first daily users; founders and product managers get a nontechnical explanation of the **same model**, with appropriate access controls. The wedge is faster, more trustworthy codebase comprehension and change discussion. The business must prove that people repeatedly use the map after onboarding and will pay for it.

**Product thesis:** Existing products address important parts of this problem. CodeSee maps code dependencies and review impact; Sourcegraph/Cody answers code questions with graph-informed context; Backstage and Port catalog software entities; Structurizr supports model-driven diagrams; GitLab Orbit builds a local code graph. The opportunity is a coherent product-level graph that links implementation to user-visible behavior, supports both audiences, explains its evidence and uncertainty, and preserves meaningful evolution locally. This is a positioning hypothesis to validate, not a claim that no competitor can offer these capabilities. [C1–C7]

## 2. Problem and opportunity

Software knowledge is split across code, configuration, Git history, docs, tickets, and people. A folder tree shows location but not purpose. Static diagrams drift. Chat answers can sound certain while missing dynamic behavior. A new engineer asks where a feature lives; a PM asks what may change if a requirement shifts; a founder asks what the product actually does. They need one navigable account of the system at different levels of detail.

The hard problem is **grounded interpretation**. Imports and routes are observable; intent, runtime behavior, and end-to-end journeys often are not. VPI must distinguish facts found in code, inferences from multiple signals, and user-authored knowledge. It should expose missing evidence instead of inventing a complete journey.

### Jobs to be done

1. **Onboard:** “Explain how this product works and where this feature is implemented.”
2. **Trace:** “Show the UI, API, data stores, and external services involved in this action.”
3. **Plan:** “If this service changes, what is directly linked and what might be affected?”
4. **Review change:** “What product and architecture relationships changed between these two commits?”
5. **Communicate:** “Give a credible, nontechnical explanation I can share with an authorized colleague.”

### Explicit expectations

- “Live” means the map refreshes after local file changes or a new fetched commit, with a visible **indexed-at time and commit SHA**. It does not mean observing production traffic or proving runtime execution.
- “Everything involved” means **everything supported by the indexed evidence within declared coverage**, with unknown or dynamic steps identified. It is not a guarantee of exhaustive behavior.
- “Private” means code, derived graph, prompts, and answers stay on the user's device by default; network use requires a separate, explicit choice. Merely avoiding raw-code storage is insufficient if filenames, graph edges, snippets, or queries leave the device.
- “History” means snapshots and semantic diffs from Git revisions that were actually indexed. It does not infer why a decision was made or reconstruct uncommitted past states.
- “Confidence” means calibrated evidence strength and coverage, not an AI model's self-reported certainty or a blanket correctness percentage.

## 3. Ground rules

1. **Evidence before polish.** Every user-facing inferred node, edge, journey step, and answer claim links to code, config, docs, a user annotation, or an explicit “unverified” marker.
2. **One graph, six projections.** Switching views or audience changes presentation, not the underlying facts.
3. **Respect access.** A local repo can be opened directly. Any future remote connector is opt-in, repository-scoped, read-only, revocable, and not needed for the core use case.
4. **No automatic code execution.** Indexing treats repositories, docs, comments, and generated files as untrusted data. No install scripts, builds, tests, plugins, or model-suggested shell commands run during analysis.
5. **No silent egress.** Remote models, telemetry, updates, sharing, and connector sync each need a clear control and data disclosure. The core product works offline after installation.
6. **No false authority.** The app does not certify security, compliance, runtime behavior, or complete impact analysis.
7. **Reproducibility.** A finding records repository identity, revision, analyzer version, evidence, and analysis timestamp.
8. **Deletability and portability.** Users can delete the local index and export the model and annotations in documented formats.
9. **Accessible by design.** Every visual path has a navigable list/text equivalent; color is not the only way to convey meaning.
10. **User corrections are first-class.** Human labels and corrections remain separate from extracted facts, carry authorship, and survive reindexing when anchors can be matched.

## 4. Users, buyer, and scope

| Persona | Question | What success looks like | Risk to address |
|---|---|---|---|
| Developer / new hire | “Where does upload happen?” | Finds relevant path and files quickly | Noisy or wrong links |
| Tech lead / architect | “What breaks if we change auth?” | Sees direct dependencies, inferred impacts, and limits | Overstated blast radius |
| Product manager | “What steps does this feature include?” | Understands journey without reading code | Jargon; presumed business intent |
| Founder / executive | “How has the product evolved?” | Understands capabilities and milestones with evidence | Exposing sensitive details or false narrative |
| Security-conscious admin | “Where does our code go?” | Can verify local-only operation and erase index | Hidden egress, broad permissions |

**Primary initial segment:** 10–100 person software teams, one or a few repositories, TypeScript/JavaScript web applications with common server and database patterns. Validate this narrow starting segment in discovery. Support other languages incrementally based on evidence and demand.

**In scope for the product vision:** six views, audience switch, natural-language exploration, evidence/confidence, local history, annotation, export, eventual optional remote integrations.

**Out of scope for MVP:** production tracing, guaranteed exhaustive call graphs, vulnerability scanning, automated refactoring, code editing, ticket/incident ingestion, cross-company benchmarking, browser-based upload of private repos, hosted indexing, multi-repo federation, real-time collaboration, enterprise identity, and arbitrary-language parity.

## 5. Product model and six connected layers

The graph contains typed **entities** (feature, journey, UI screen, route, function, module, service, API, event, database/table, external dependency, config, repository/revision) and typed **relationships** (calls, imports, handles, reads, writes, emits, consumes, implements, depends on, appears in journey). Each edge has evidence, extraction method, source revision, and confidence class. A feature is a curated or inferred grouping, not necessarily a code artifact. Unsupported links are omitted or marked as hypotheses.

| Layer | User question | MVP representation | Known limitation |
|---|---|---|---|
| **1. Product architecture** | “What are the main parts?” | Layered map of UI, server, data stores, and external systems; drill to modules/files | Deployment topology may be absent from repo |
| **2. User journeys** | “What happens when a user does X?” | Evidence-backed path from UI event/route through API and persistence, with gaps | Static code cannot prove runtime order or all branches |
| **3. Data flows** | “Where does this data go?” | Read/write/transform and external-transfer edges for supported patterns | Dynamic schemas, queues, and implicit flows may be missed |
| **4. Feature relationships** | “What capabilities share parts?” | Feature-to-feature links through shared routes, modules, stores, or manual labels | Business feature boundaries often need review |
| **5. Dependencies** | “What uses this component?” | Direct import/call/config relationships and bounded transitive expansion | Correlation is not necessarily breakage |
| **6. Live changes** | “What changed since last week?” | Commit-linked graph delta, new/removed edges, changed feature paths, timeline | Git history does not explain intent; renames are imperfect |

**Interaction contract:** Selecting any node or edge keeps the subject in focus while changing layer. A shared detail panel shows explanation, evidence links, confidence, owner annotation, indexed revision, and “known gaps.” The technical switch reveals symbols, files, routes, and direct dependencies. The nontechnical switch presents product concepts and plain descriptions, with an optional “show evidence” path. Neither mode hides uncertainty.

### Example: “Show me everything involved when a customer uploads a document”

The application interprets the question as a candidate flow, asks for disambiguation only if multiple upload flows are plausible, then returns a visual route such as **Upload screen → submit handler → upload API → authentication middleware → object storage adapter → document record → extraction job → resulting product view**. Each hop is labeled `observed in code`, `inferred from evidence`, `user confirmed`, or `unknown`; clicking a hop opens its file/revision and relevant lines. If the extraction job is queued through a dynamic client that the analyzer cannot resolve, the path stops at that boundary and says what it cannot establish. The user can save the flow as an annotated view.

## 6. Core journeys and UX requirements

### J1. Open and understand a repository

1. User chooses a **local folder**; app previews scope, ignored paths, approximate index size, supported languages, and any network controls.
2. App indexes selected revision without running repository code. It displays progress, skipped files, parser failures, and coverage.
3. Landing view shows a small product map, top capabilities, search, and “what we could/could not identify.”
4. User opens a capability, changes layers and audience mode, and follows an evidence link into their editor or local viewer.

### J2. Ask a question

1. User asks in ordinary language or selects a suggested question.
2. Query planner maps terms to indexed entities and graph paths. Retrieval is local. An optional local language model can summarize retrieved evidence; deterministic templates are the baseline.
3. Result shows the path first, concise answer second, cited evidence and coverage third. Ambiguous matches are shown as alternatives.
4. User can correct a label, mark a path as verified, or flag an incorrect edge.

### J3. Inspect evolution

1. User selects two indexed commits or dates.
2. Timeline highlights additions, removals, relationship changes, and changed evidence; a side-by-side view preserves the old and new map.
3. Summary uses careful wording: “The upload route now calls the new storage adapter,” not “the team migrated to a better architecture” unless a cited decision record says so.

### J4. Share safely

MVP exports a local Markdown/JSON report or image with a preview of included data. Exports are explicit, include revision and caveats, and can omit paths/snippets. Cloud sharing is a later product decision because it changes the privacy promise.

### UX principles

- Start with a comprehensible map of 10–30 grouped items, not a hairball. Expand on demand.
- Search and question input work from every layer.
- Preserve selection and zoom across mode switches; offer back/forward navigation.
- Visually separate fact, inference, and annotation using labels/icons and text, not color alone.
- Show “last indexed” and “unindexed changes” prominently.
- Make edges inspectable and deletable only as annotations; extracted data is corrected at the source or suppressed with a visible user override.
- Provide keyboard navigation, screen reader labels, text/list alternatives, and readable export.

## 7. Requirements and acceptance criteria

| ID | Requirement | Release | Acceptance criterion |
|---|---|---|---|
| R1 | Local repo onboarding | MVP | Open a supported repo without account or network; preview exclusions; index at a named SHA |
| R2 | Unified graph | MVP | A selected entity has stable identity across all available views; same evidence in either audience mode |
| R3 | Six layers | MVP, limited depth | Each layer is reachable for a supported repo and clearly reports empty/unsupported evidence rather than fabricating content |
| R4 | Technical/nontechnical switch | MVP | Switch preserves current subject; descriptions differ in detail, not factual claims |
| R5 | Natural-language flow exploration | MVP | For supported canonical flow questions, return candidate graph path(s), ambiguity choices, citations, and visible gaps |
| R6 | Evidence and confidence | MVP | Every inferred displayed relationship has source link(s), revision, method, and confidence class; unsupported claims are not shown as facts |
| R7 | History | MVP | Compare two indexed commits and list added/removed/changed entities/edges; timeline links to commits |
| R8 | Refresh | MVP | Local file watcher or manual refresh updates affected files; new Git commit can be indexed; UI shows indexed-at time and pending changes |
| R9 | Privacy controls | MVP | Offline indexing and queries; no code-derived network traffic by default; index delete and export work |
| R10 | Corrections | MVP | User can rename/group/verify/suppress with provenance; reindex does not silently erase surviving annotations |
| R11 | Export | MVP | Produce local Markdown/JSON with revision, evidence, and caveats; preview contents before creation |
| R12 | Remote connector | Later | Scoped read-only GitHub App or equivalent, revocable; source remains analyzed on device and no cloud index is created by default |

**Representative scenario tests:** (a) trace a known upload path in a seeded web app; (b) distinguish two similar upload routes; (c) mark an unresolved dynamic dispatch as unknown; (d) show an added storage edge after a commit; (e) switch audience while preserving cited facts; (f) index with network blocked and detect no outbound code-derived request; (g) delete index and confirm derived files are removed. These are release gates, not a claim of universal accuracy.

## 8. Technical design and implementation approach

### Architecture

```text
Local repository / Git history
          ↓ read-only
File discovery → language parsers / framework detectors → normalized evidence records
          ↓                                     ↓
Incremental local index                 coverage + diagnostics
          ↓
Versioned property graph + local search index + user annotations
          ↓
Graph queries / path ranking / optional local summarizer
          ↓
Six views + audience mode + cited report export
```

**Baseline design:** Desktop application with a local analysis worker and local database. Use mature parsers/tree-sitter or language service data where available; use framework-specific rules for route, UI event, ORM, and queue patterns. Store normalized nodes/edges and provenance in an embedded database. The UI can use an existing graph visualization library; layout is a projection, not the source of truth. Avoid adding a graph database server until scale measurements justify it.

**Evidence pipeline:** Discover files with `.gitignore` plus explicit exclusions; identify language/framework; parse imports, exports, definitions, calls, routes, UI navigation, API clients, schema, database access, infrastructure manifests; resolve symbols when possible; connect patterns into candidate paths; attach raw span and analyzer ID; compute graph diff per indexed revision. Docs and tests may add context but never override code-derived facts silently. Business names can be proposed from route labels, component text, docs, and user annotations, always tagged as inferred or authored.

**Confidence classes:** `Direct` = explicit static relation with a resolved source/target; `Corroborated` = multiple independent signals; `Inferred` = plausible single or heuristic signal; `Unknown` = unresolved boundary. Display coverage separately (supported languages/files/patterns and failures). Do not present numerical confidence until it has been calibrated against a labeled benchmark.

**Query design:** Resolve user terms to candidates, traverse bounded typed paths, rank by direct evidence and relevance, return competing paths when close, and generate a concise explanation from the returned subgraph. The default path must not require a hosted LLM. If a local model is used, its output is checked against retrieved node/edge IDs and cannot create uncited graph edges. Query and repository text are untrusted inputs, never executable instructions.

**History design:** Cache graph snapshots keyed by repo/revision/analyzer version. Use stable IDs derived from semantics where possible, with rename detection and an explicit “possible rename” state. Diff edge sets and evidence; summarize changes conservatively. Index the current revision first and a bounded set of previous commits on demand to control time and disk use. “Live” local file changes are an ephemeral working-tree state, distinct from Git snapshots.

**Performance budgets to validate:** first useful map within five minutes for a representative 100k-line supported repo on a standard laptop; incremental refresh within 15 seconds for a small edit; interactive navigation within 200 ms for a typical visible subgraph. These are goals, not guarantees; define benchmark hardware and sample repos before committing publicly.

### Trust and security model

| Threat or concern | Default control | Residual risk / test |
|---|---|---|
| Private code leaves device | Core analysis and storage local; network-deny option; no remote inference by default | Package update checks or OS diagnostics can leak metadata; verify with network test |
| Overbroad repository access | Open local folder; optional GitHub App requests selected repositories and minimum read permissions [S1] | User may grant too much at GitHub; show granted scope and revoke instructions |
| Malicious repository content / prompt injection | Parse as data; no repo scripts; sandbox worker; treat docs/comments as untrusted; validate model output against graph IDs | Parser vulnerabilities and model manipulation remain; fuzz parsers and test adversarial repos |
| Secrets in code or history | Do not print or include raw secrets in summaries/telemetry; redact snippets/exports; allow path exclusions | Secret detection is imperfect; exports require preview |
| Local index exposure | OS file permissions, encrypted-at-rest option if needed, explicit delete, no shared server | Anyone with machine access may read local files; evaluate OS keychain encryption for paid teams |
| Misleading conclusion | Provenance, coverage, uncertainty labels, user corrections | Static analysis cannot prove runtime path; evaluate against known traces |
| External model egress | Separate opt-in, exact data scope preview, provider disclosure, disable per workspace | Provider retention and transit policies require separate diligence |
| Remote update drift | Signed releases, reproducible build target, offline mode | Supply-chain compromise remains; independent security review before enterprise claims |

No “zero knowledge,” “SOC 2,” or “enterprise secure” claim until independently substantiated. For remote GitHub integration, GitHub Apps support targeted, repository-scoped permissions, while push webhooks require a reachable endpoint; a truly local default should instead use local Git state or user-initiated pull, and treat webhooks as an optional later service. [S1–S3] CodeSee itself says it analyzes code in GitHub Actions but stores code metadata, which illustrates why the privacy promise must include derived data and queries. [C1]

### Coverage strategy

Start with TypeScript/JavaScript, common React/Next.js frontends, Node APIs, one ORM family, and explicit HTTP/storage adapters. Publish a coverage matrix. Python or other stacks follow observed demand. For unsupported code, show files/modules and import links where possible; do not imply full journey or data-flow coverage. Monorepos and generated code need inclusion rules and budget controls. Cross-repo references are a later capability.

## 9. MVP and phased roadmap

### Phase 0 — Discovery and feasibility (4–6 weeks, estimate)

- Interview 20–30 target users across developers, leads, PMs, and founders; collect specific last-time questions and current workarounds.
- Obtain 5–8 permissioned, varied repositories with answer keys from maintainers; include one adversarial/unsupported repo.
- Prototype parser coverage and a complete upload/auth/payment-style path in at least two repos.
- Test whether nontechnical descriptions help without hiding uncertainty; test willingness to pay and deployment constraints.
- **Gate:** At least 70% of target interviewees rank one traced question as a recurring pain; prototype answers materially reduce time versus their current workflow in a small observed test. Adjust segment if not.

### Phase 1 — Narrow MVP (10–16 weeks after gate, estimate)

- Local folder indexing, graph, six limited projections, two audience modes, search/question path, evidence panel, two-revision history, basic annotations, export, privacy controls.
- Supported stack and coverage matrix published. Use a deterministic answer path; local model is optional if it improves summaries without weakening traceability.
- Private design partners use it weekly with support. No hosted repository ingestion.
- **Release gate:** Representative scenario tests in §7 pass; no unexpected egress in network tests; no uncited inferred edges in a sampled review; users can recover from parser failures.

### Phase 2 — Trust and team utility

- Broaden language/framework support, improve journey inference, add team-shared artifact format, optional local-network/team deployment, more useful semantic diffs, and IDE deep links.
- Evaluate GitHub/GitLab read-only connectors only if local-folder friction is a proven blocker. Define permission model and data flow before build.

### Phase 3 — Enterprise and ecosystem, conditional

- SSO/RBAC, policy controls, on-prem deployment, audit logs, multi-repo model, optional CI indexing, integrations with catalogs/docs, independent security assessment.
- Proceed only when repeat usage, accuracy, and security review justify operational complexity.

## 10. Success metrics and decision thresholds

**North-star hypothesis:** weekly **evidence-backed questions resolved** per active workspace, measured locally or with opt-in aggregate telemetry. A resolved question means a user opened a path and at least one evidence item, then marked it useful or completed a target task. Do not count raw queries or graph renders as value.

| Metric | Early target / interpretation |
|---|---|
| Time to first useful answer | Median under 10 minutes from folder selection in supported repos |
| Answer precision | ≥85% of sampled displayed edges judged correct by maintainers; track by edge type |
| Journey completeness | ≥70% of known steps represented on chosen benchmark flows, with missing steps visibly marked; never optimize this by hallucinating |
| Weekly reuse | ≥50% of activated pilot workspaces return in week 4; validate against actual work cycles |
| Cross-persona value | At least one nondeveloper uses a saved view in ≥30% of active pilot teams |
| Trust | Zero known unconsented code-derived egress; every sampled inferred claim has provenance |
| Correction rate | Track false edges, ambiguous labels, and user corrections per 100 explored paths |
| Commercial signal | 5 design partners willing to pay or sign paid pilots after hands-on use |

Targets are provisional. Instrument locally first; aggregate only with clear opt-in and avoid logging source paths, queries, snippets, or graph structure. Pair telemetry with observed task studies, since a low query count may mean the map answered the question quickly.

## 11. Go-to-market and pricing hypotheses

**Positioning:** “Understand and explain your product from its code, visually and privately.” Lead with a concrete workflow: trace a feature and its impact in minutes, with proof. Avoid “AI maps everything” language.

**Initial motion:** founder-led design partnerships with engineering leads; local demo on a sample repo; guided pilot on one approved private repo; quantify time saved on onboarding and change planning; collect examples of mistaken paths and fixes. Distribution can include developer communities, architecture/onboarding content, and an offline trial. Enterprise procurement should follow a verified security package, not precede it.

**Pricing to test, not publish as fact:** free local trial on one repo with bounded history; individual paid tier at roughly US$15–30/user/month for deeper history and exports; team tier at roughly US$99–299/workspace/month for shared annotations and support; enterprise annual license for on-prem and policy controls. Test price against usage and buyer interviews. An alternative is per-workspace pricing, which may fit cross-functional users better than seats. Do not gate privacy, evidence, or basic deletion behind payment.

**Sales proof points:** demonstrated time-to-answer, representative accuracy review, local-only network test, architecture/security documentation, straightforward uninstall and deletion. **Avoid** claiming savings or accuracy until measured with design partners.

## 12. Competitive landscape and differentiation

Research below is based on vendor/project documentation available on 10 October 2026. It describes documented capabilities, not a complete hands-on evaluation. “Gap” is a comparison to this PRD's specific goal, not a claim that the competitor lacks all adjacent features.

| Product / category | Documented strength | Where VPI could differ | Honest gap or threat |
|---|---|---|---|
| **CodeSee** | Interactive codebase dependency maps, review maps, annotations/tours; code analyzed in GitHub Actions without storing source code, while code metadata is stored. [C1, C2] | Local-only default that keeps **derived metadata** local, plus unified product/journey/data/history views and evidence classes | Closest visual competitor; already has map and change-review workflows, so “visual code maps” and “private code” are not unique claims |
| **GitLab Orbit** | Local code graph in DuckDB and remote SDLC graph; local mode runs without network after install; point-in-time indexing. [C3] | Product-facing journeys, dual audience UX, six projections, evidence-first explanation across a local repo | Serious direct threat, especially for GitLab users; its remote graph covers SDLC relationships VPI would initially lack |
| **Sourcegraph / Cody** | Code search, code graph context, and repository-aware AI answers for developers. [C4] | Persistent, navigable product model and visual, cross-persona explanation | Strong code intelligence and search; VPI likely trails on scale, language coverage, and cross-repo answers |
| **Backstage / Port** | Software catalogs with entities, metadata, ownership, and relationships. [C5, C6] | Infer from implementation, drill to evidence, trace user actions, compare evolution | Catalogs integrate broad operational context and governance; VPI must not pretend code alone captures ownership or runtime state |
| **Structurizr** | C4 models as code, multiple diagrams from one model, version-controlled architecture documentation. [C7] | Auto-extraction and question-led exploration with nontechnical interpretation | Manually curated diagrams can be more accurate and expressive; VPI should export/interoperate rather than dismiss them |
| **GitHub Copilot Spaces** | Context-grounded Q&A over selected GitHub content that updates as sources change. [C8] | Local graph and visual paths, explicit provenance, privacy-by-default | GitHub distribution and developer workflow reach are major advantages |

### Defensible difference, if validated

1. **Model continuity:** six views and two audiences are projections of one evidence graph, so a question, map, and history point to the same object.
2. **Proof on click:** relationships and narrative claims resolve to file/revision evidence; uncertainty and coverage are part of the UI.
3. **Device boundary:** source, derived metadata, queries, annotations, and history remain local by default. This is narrower and more testable than generic “we do not store your code.”
4. **Product semantics:** connect routes and data operations to user-facing capabilities, with user correction where code cannot reveal business meaning.
5. **Evolution:** compare how a capability's implementation and dependencies changed, not merely which files changed.

**Why this may be hard to copy:** it combines multi-level graph extraction, calibrated evidence, useful visual interaction, nontechnical language, and strict local execution. **Why that is not a moat yet:** incumbents can add views and local modes; extraction quality and distribution are expensive; user annotations and trusted history only become an advantage if teams use them repeatedly. The first proof of differentiation is a head-to-head task study, not a feature checklist.

## 13. Principal risks, constraints, and mitigations

| Risk | Consequence | Mitigation / kill signal |
|---|---|---|
| Inference mistakes | Users lose trust or make wrong decisions | Evidence classes, gaps, maintainer benchmark; stop broad claims if edge precision misses target |
| Static analysis misses runtime paths | “Everything involved” promise fails | Explicit coverage, optional future traces, scoped language support |
| Graph overwhelms user | No practical time saving | Progressive grouping, task-led entry, list view; observe real users |
| Local compute is slow | Onboarding abandonment | Incremental indexing, on-demand history, benchmarks; narrow scope |
| Cross-persona compromise | Neither developers nor PMs find it useful | Same facts, different detail; test each persona separately |
| Local privacy conflicts with collaboration | Team buyers cannot share | Explicit local export/team deployment later; no silent cloud sync |
| Competitor convergence | Weak positioning | Win on verified task outcomes and trust, not generic visualization |
| Security flaw in parser/index | Private repo compromise | Sandboxed worker, dependency review, fuzzing, signed updates, security assessment |
| Poor willingness to pay | Usage without business | Paid pilots, buyer interviews, pricing experiments; pause expansion if no commercial signal |

## 14. Open decisions for founders

1. Is the first buyer engineering leadership, or is the nontechnical stakeholder the economic buyer? Test before designing enterprise packaging.
2. Which two frameworks and one data layer cover the most valuable pilot repositories?
3. Should the first release include an optional local LLM, or use deterministic explanations until reliability is proven?
4. How much Git history can be indexed within acceptable local storage and time budgets?
5. What is the precise team-sharing boundary consistent with the privacy promise: export, local server, or on-prem service?
6. What level of evidence accuracy and coverage is sufficient for onboarding versus change-impact decisions?
7. Which competitor tasks should be used in a blind comparative study: CodeSee map navigation, Orbit graph queries, Sourcegraph answers, or a manually maintained diagram?

## 15. Immediate next steps

1. Recruit design partners and collect five concrete questions per repo, with maintainer-provided answer paths.
2. Build a narrow parser/graph spike for one supported stack and the upload flow; measure evidence precision and missing steps.
3. Prototype the shared selection, six projections, and technical/nontechnical switch using real graph data.
4. Run an offline network test and document exactly what data is stored and exported.
5. Compare pilot task completion against existing tools and manual methods; revisit MVP scope and price only after results.

## Sources

Primary documentation was preferred; capabilities and status can change. Links below support the competitive and implementation claims above. The strategy, targets, timelines, and pricing are VPI hypotheses.

- **[C1] CodeSee, Privacy and Security:** https://docs.codesee.io/docs/privacy — analysis location, source/metadata handling, permissions.
- **[C2] CodeSee, Overview / Explore Your Map:** https://docs.codesee.io/docs/getting-started and https://docs.codesee.io/docs/explore-your-map — interactive maps, dependencies, review maps.
- **[C3] GitLab, GitLab Orbit:** https://docs.gitlab.com/user/project/repository/knowledge_graph/ — local/remote modes, graph scope, status and limitations.
- **[C4] Sourcegraph, Cody Context:** https://sourcegraph.com/docs/cody/core-concepts/context — search, repository and code graph context.
- **[C5] Backstage, Software Catalog:** https://backstage.io/docs/features/software-catalog/ — entity catalog and metadata.
- **[C6] Port, Blueprints:** https://docs.port.io/context-lake/data-model/setup-blueprint/overview/ — modeled assets and relationships.
- **[C7] Structurizr, Home / Why as code:** https://docs.structurizr.com/ and https://docs.structurizr.com/as-code — one model, multiple diagrams, version control.
- **[C8] GitHub, Copilot Spaces:** https://docs.github.com/en/copilot/concepts/context/spaces — contextual Q&A and source updates.
- **[S1] GitHub, GitHub Apps versus OAuth apps:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps — granular permissions.
- **[S2] GitHub, About using GitHub Apps:** https://docs.github.com/en/apps/using-github-apps/about-using-github-apps — repository selection and authorization.
- **[S3] GitHub, Using webhooks with GitHub Apps:** https://docs.github.com/en/enterprise-cloud%40latest/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps — webhook endpoint and events.

---

*This PRD is a decision document, not a commitment to ship every vision feature at full depth in the MVP. Any public security, coverage, performance, or accuracy claim requires implementation evidence and measurement.*
