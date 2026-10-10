# Phase 2 verification — 2026-10-10

## Implemented

- Python AST and tree-sitter JS/TS static import extraction, relative module/index resolution, explicit external references, plain-JSON tsconfig/jsconfig path mappings.
- FastAPI factory/decorator route extraction and basic Next.js App Router page/exported-function handler conventions. This does not establish mounted prefixes or production routing.
- Literal fetch method/path matching to a unique declared route, labeled **inferred candidate**, with evidence on both sides. Computed/spread/ambiguous methods remain gaps.
- Stable node/edge IDs; direct relationship semantics and direction; observed/inferred/unknown labels; source hash, file identity, and line spans on edges.
- Charcoal layered cards, muted red connections, circular ports, connection labels, selected-edge motion and focus transitions. No green/neon palette. Motion is an exploration cue and can be disabled; reduced-motion styling applies.
- Architecture and dependency views, search, module-reference filter, zoom/pan/fit/minimap, source inspector, highlighted evidence lines, list alternative, and small-screen view selector.
- Optional Supabase graph persistence migration. The owner's separate project is still required for live cloud verification.

## Automated checks

23 Python tests pass, including the original ZIP/privacy/API tests plus sample answer-key checks, JS comments/string false-positive avoidance, multi-line imports, relative resolution, dynamic/alias gaps, aliased FastAPI factories, rejection of invented non-FastAPI routes, ambiguous HTTP matching, parser failures, cycles/direction, plain-JSON alias and Next App Router conventions, and scanning Architect's real repository.

All graph edge evidence is checked against captured file IDs, valid line spans, and source hashes in the sample. The deliberately unconnected SQL schema receives no invented graph edge.

TypeScript type checking and the Next.js production build pass. Live cloud, provider streaming, and production-runtime behavior remain pending.

## Browser checks

- Sample: 7 inventory files, 3 parsed source modules, 7 graph nodes, 6 relationships, 0 extraction gaps.
- Clicked a rendered red HTTP candidate line; inspector displayed frontend fetch line 9 and FastAPI decorator line 6 with an inferred warning.
- Opened captured source from that evidence; line 9 was correctly highlighted and displayed line count matched the snapshot.
- Clicked an observed import line; inspector showed `from .storage import save_document` at `api/main.py:2`.
- Dependencies filters the sample to 6 nodes / 4 module relationships. Searching `storage` narrows it to 3 nodes / 2 relationships.
- Turning Flow motion off removes the animated-edge class; source evidence highlights frontend line 9 correctly.
- The small-screen selector switches back to architecture, and the page has no horizontal overflow at 390px.
- Focus interaction and final charcoal/red screenshot are checked in the browser; SVG path targeting can be awkward in automation, so the accessible relationship list provides the same evidence action.

## Scope limits

Static supported patterns only. No runtime trace, symbol call graph, deployment topology, complete Git/Next/Python resolver, inherited/JSONC configs, full six-layer semantics, or OpenAI calls. HTTP method/path coincidence is not proof of deployed connectivity. Module references may be external or unresolved; their source import is the observation. Cloud persistence and a deployed URL are not claimed as tested.
