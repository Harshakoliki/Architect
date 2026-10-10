# Architect — Six-phase MVP build plan

Date: 10 October 2026

Status: Phase 1 approved. Phase 2 built with the static coverage documented in README and its verification report. Phases 3 and 4 are built; live OpenAI verification awaits a private key. Phase 5 requires the owner’s confirmation.

**Hosting amendment:** Vercel + Supabase replace the original local-only runtime below. ZIP upload replaces local-path registration. Optional Supabase stores captured masked source; without credentials, previews last until reload. Hosted code leaves the device. Phase 5 starts with uploaded snapshot comparisons; Git refresh/history and local watching require later GitHub/companion integrations. See TRD Section 0 and README for the authoritative current baseline.

Implementation baseline: [Detailed Technical Requirements Document](architect-mvp-trd.md).

Visual quality is required from Phase 1 onward. Use the supplied UI references to establish the direction before frontend implementation; review readable grouping, selected paths, typography, spacing, transitions, and evidence-panel behavior as each view is introduced. Phase 6 refines and verifies the complete experience.

## Working agreement

Build one phase at a time. After each phase, stop and give the user:

1. A plain-English account of what now works.
2. A demo or exact steps to try it.
3. What was checked, what failed, and the remaining limits.
4. A simple explanation of the next phase.

Proceed to the next phase only after the user's explicit confirmation. Fix defects in the completed phase as part of that phase; do not treat approval of this plan as permission to build all phases. The user's UI reference images will guide the first interface and final visual polish. Ask for images before committing to the visual direction if they have not arrived.

## What we are building

A browser-based application running on the user's own computer. Next.js with TypeScript provides the interface; Python with FastAPI reads and analyzes the selected codebase. SQLite stores the project graph, evidence, saved views, and analysis snapshots. OpenAI APIs help interpret features, explain flows, and answer questions over relevant code evidence.

The six final views are product architecture, user journeys, data flows, feature relationships, dependencies, and live changes. They share one model and the same evidence. Technical/nontechnical mode changes descriptions and visible detail while preserving the selected subject.

No login, billing, team management, or cloud deployment in this build. The services bind to the local machine. A hosted version would need a different repository-access and security design; a browser on a remote server cannot silently read a user's laptop folders.

## How analysis will work

`Selected local repository → safe file scan → code parsing → evidence graph → relevant-context retrieval → optional OpenAI interpretation → interactive views`

Python finds observable code relationships. OpenAI can suggest feature groupings and explanations, but inferred relationships stay visibly labeled and must cite real evidence. Unknown links remain unknown. Structured Outputs can constrain the response format, but they do not prove factual correctness; returned evidence IDs and file spans still need validation. Reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Start with JavaScript/TypeScript imports, React/Next.js routes and handlers, Python imports and FastAPI routes, and a small documented set of HTTP/database patterns. Unsupported frameworks get file/module visibility and an explicit coverage notice. Broad language support is not a first-release promise.

The OpenAI key stays on the Python server, outside source control and browser responses. Basic scanning works without a key. Enabling AI sends selected relevant code and graph context to OpenAI; this mode is not fully offline. Include a clear workspace setting, excluded paths, request limits, and failure handling. Never execute the analyzed repository, install its dependencies, or let its comments trigger tools.

## Phase 1 — A working app that opens a real codebase

**Build:** Next.js frontend, FastAPI backend, optional Supabase persistence, ZIP repository ingestion, and real scan stages. Validate archives, ignore generated/credential files, and bound input size. Adapt the initial layout to the supplied UI references. Include a small sample application with a document-upload flow, so we have known answers to check.

**You will see:** An app you can open in your browser, upload a repository ZIP, and inspect real file counts, detected languages/frameworks, skipped files, and scan status. Empty, loading, and failed states work. Any sample content is clearly labeled.

**Check before approval:** The frontend talks to the backend; a valid ZIP scans; an unsafe or invalid archive gives a useful error; excluded secrets and dependency folders are skipped; the inspected repository is unchanged. A browser can only access a registered project, not arbitrary file paths through the source-view endpoint.

**Next phase in simple words:** Turn the files into a map of the actual parts and their connections.

## Phase 2 — Real architecture and dependencies, with proof

**Build:** Parse supported source files, resolve imports and supported route/symbol relationships, and store nodes, edges, source lines, revision, and extraction method. Add architecture and dependency views, grouping, zoom, search, selection, and a source-evidence panel. Define edge direction consistently. Keep unresolved dynamic links visible as gaps.

**You will see:** A map based on your code. Click a connection to see why it exists and open the supporting source. Expand a component to see what it directly uses and what directly uses it.

**Check before approval:** Compare extracted relationships with known answers in the sample repository. Verify graph direction, source line links, relative imports, unsupported patterns, and a deliberately missing reference. Run once on an additional real repository selected by the user.

**Next phase in simple words:** Explain what those technical connections mean for product features and user actions.

## Phase 3 — Features, user journeys, and data flows

**Build:** Add the OpenAI integration to propose feature groupings and plain explanations using retrieved evidence. Build feature relationships, user journeys, and data flows over the same graph. Show direct observations, AI inferences, and unknown boundaries separately. Validate AI evidence references; handle missing key, request failure, refusal, and malformed results. Cache valid interpretations against source/analyzer/prompt versions.

**You will see:** Select “Document Upload” and follow the supported path from screen or route to API, processing, and storage. See shared components between features and where information is read or written. Inspect the evidence for every step. An unresolvable queue or dynamic call ends at an explicit gap.

**Check before approval:** The known sample flow matches its implementation. Invented file names and invalid evidence IDs cannot enter the graph as facts. Failure of OpenAI leaves the existing graph usable. Exclusions apply to the context sent to the API.

**Next phase in simple words:** Ask questions naturally and switch between developer detail and a simpler explanation.

## Phase 4 — Ask the codebase, and switch audience

**Build:** Question input, relevant graph/code retrieval, bounded path exploration, OpenAI answer generation with citations, and canvas highlighting. Add technical/nontechnical mode, preserving selected feature and evidence. Allow ambiguous questions to return alternatives and unsupported questions to say what is missing. Save useful views and simple user corrections locally.

**You will see:** Ask “Show me everything involved when a customer uploads a document” and get a highlighted flow plus a readable answer. Ask “What uses this service?” and inspect the linked components. Switch mode without losing your place.

**Check before approval:** Trace, dependency, ambiguous, and unanswerable questions. Verify cited evidence exists in the selected snapshot; both audience modes preserve the same facts; a failed query does not erase the map; saved corrections remain separate from extracted facts.

**Next phase in simple words:** See how the map changes as code changes, and compare it with earlier versions.

## Phase 5 — Live refresh and product history

**Build:** File-change detection with debounced refresh, visible indexing status, and revision snapshots. Read selected older Git revisions without checking out or changing the user's worktree. Add a chronological timeline, comparison of two indexed states, and highlighted added/removed/changed entities and relationships. Refresh invalidated explanations and mark stale answers. Preserve corrections where anchors still match and flag broken anchors.

**You will see:** Change a route or dependency and watch the map update. Pick two indexed commits and inspect how an architecture or feature flow changed. A folder without Git still supports analysis and subsequent local snapshots, with Git history explicitly unavailable.

**Check before approval:** Introduce a known change, deletion, and rename in a controlled fixture. Verify graph deltas, revision-correct evidence, stale-result handling, interrupted indexing recovery, and no checkout or source mutation. Reopening the app preserves stored history. Explain analyzer-version changes rather than mislabeling them as product changes.

**Next phase in simple words:** Make the complete experience easy to use and verify it works on actual projects.

## Phase 6 — Complete MVP review, UI polish, and reliability

**Build:** Finish the reference-based design across all six views. Improve graph readability, keyboard access and text alternatives, progress/error messages, and smaller screens. Add Markdown/JSON export with evidence and revision, local data deletion, setup instructions, and concise support/coverage notes.

**You will see:** One coherent product: open a repo, explore six connected views, ask a question, change audience, inspect evidence, compare history, and export a result.

**Check before final approval:** Run the whole journey on the sample app and agreed real repositories. Measure first analysis and refresh times; inspect a sample of edges and answer citations; confirm secrets/key are absent from browser output and logs; confirm analyzed code remains untouched. Check API errors, missing Git, unsupported files, deletion/export, restart persistence, and core keyboard navigation. Report the measured limits rather than claiming universal codebase understanding.

**Final handoff:** Runnable local web MVP, setup instructions, coverage/limitations, and a short results report. This phase does not automatically authorize public deployment.

## MVP finish line

The MVP succeeds when a user can analyze a real supported repository, understand a feature through six connected views, ask a grounded flow question, inspect the supporting code, switch explanation depth, and compare changes over time. A visually convincing diagram without working analysis does not meet the finish line.

## Current state and deferred scope

Phases 1–4 are implemented and the public repository is https://github.com/Harshakoliki/Architect . Phase 3 has a verified annotated sample and mocked real-SDK tests; a live OpenAI call awaits a private key. The owner deferred hosting and is handling submission. Phase 4 adds a verified sample flow finder, source-grounded OpenAI question integration, and an explanation switch. Phase 5 retains its confirmation gate. The hosting amendment and current README supersede older local-only descriptions above.

Authentication, billing, hosted ingestion, remote repository authorization, production telemetry, arbitrary-language support, collaboration, and enterprise controls are deferred. Basic file validation, secret exclusion, API key protection, and evidence accuracy remain part of the MVP.
