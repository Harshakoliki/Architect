# Phase 3 verification — 2026-10-10

## Delivered

- Official OpenAI Python SDK 3.28.0 and Responses Structured Outputs integration; default model gpt-6.1-sol, configurable by OPENAI_MODEL.
- Consent-gated source bundle review: up to 12 excerpts / 48 KB total, up to 100 lines / 6,000 bytes per excerpt, route/HTTP source priority, known-pattern masking before transmission.
- Strict product schema: candidate features, user journeys, data flows, source citation IDs on all features/steps/transitions, valid step endpoints, unique step IDs.
- Source excerpts/comments are untrusted data; no AI tools or analyzed-code execution. store=false, 45-second SDK timeout, zero retries, 6,000 output-token limit, one request in flight per Python process.
- Missing key, refusal/incomplete result, malformed output, invalid citation/transition, provider failure, and size boundaries fail safely. Existing static scan remains available.
- Feature/source map, selectable journey/data-flow maps, charcoal/red motion, card/connection evidence, source excerpt highlighting, gaps, source-bundle review, provider/model/token labels.
- Interpretations remain inferred, including the sample. Feature relationships show shared cited source, not feature dependencies.
- Explicit annotated sample: two hand-authored features, a four-step upload journey, a four-step document data flow, and a two-step fingerprinting data flow. It makes no API call and only accepts the unchanged sample context.
- Browser-scan result cache; switching layers reuses the result. Results are not persisted to Supabase yet.

## Checks

29 Python tests pass and Ruff passes. TypeScript type checking and the Next.js production build pass.

The tests include actual SDK request serialization and structured parsing via mocked HTTP transport, store=false/schema/no-tools assertions, citation and endpoint rejection, masking/bounds/exclusions, consent/missing key, sample-context mismatch rejection, provider refusal/401/malformed JSON, and lock release after failure. The earlier security/static graph tests continue to pass.

Browser walkthrough:

- Opened a freshly scanned sample and User journeys. OpenAI generation is disabled without a key; the separately labeled annotated-sample action works.
- The upload journey shows four nodes and three inferred connections. Selected Send the document and opened its captured web/upload.tsx:1–17 excerpt; highlighting matched the cited span.
- Switched to Data flows and selected Document fingerprinting; its two nodes and one connection are present.
- Switched to Feature relationships; five nodes and four source-citation connections show two features sharing storage source.
- Selected the storage citation; inspector displays actual api/storage.py and its in-memory implementation, with an inferred badge.
- Cached meaning survives layer switches. Source/generation controls collapse after a result.
- Browser error log was empty during the final walkthrough. Saved outputs/architect-phase-3.jpg.

## Unverified and deferred

No OpenAI key is configured, so no live provider call, model access, latency, billing, or semantic quality evaluation is claimed. SDK/provider tests use mocked responses; the working sample is hand-authored and labeled. Live Supabase and hosting are intentionally pending. No natural-language questions, audience switch, GitHub reader, snapshot history, or runtime trace yet. Phase 4 requires the owner's confirmation.

Source context is supplied by the current browser snapshot and validated/remasked; its hash is an identity/provenance field, not a server-issued cryptographic attestation. Citation validation cannot establish the truth of free-text interpretations. Partial snippets can omit critical behavior; gaps remain visible. Product-view results disappear on reload.
