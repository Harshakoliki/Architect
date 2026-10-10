# Architect — approved visual direction

Date: 2026-10-10. Reference lock: user-provided images and permission to start building.

## What the interface should communicate

**Problem:** A dense codebase can leave people without a clear starting point.

**Solution:** Use readable charcoal cards, restrained red paths, circular ports and source evidence to help a person follow one question at a time. Keep inferred connections and unknowns visible.

**Benefit:** The user can find a route through the information, explain it to another person, and inspect the supporting code. Motion guides attention along a selected connection; it must not imply observed runtime traffic.

Product copy follows **problem → solution → benefit**. Lead with the question people struggle to answer, show how the map helps, and close with the practical payoff. Prefer specific actions over broad claims about intelligence or productivity. Quantified gains require measurement; planned features remain labeled as planned.

The final charcoal/red correction below is authoritative; earlier palette notes are historical.

## Decisions

- Reference 3: dark canvas, rounded flow nodes, curved connections, citron selected path.
- Reference 6: spacious composition, readable sans-serif typography, charcoal panels.
- Reference 5: parallel lanes for data flows in Phase 3.
- Reference 7: chronological milestones for history in Phase 5.
- References 1–2: precise linework and technical annotations; avoid their tiny labels.
- Reference 8: editorial restraint; the product workspace uses the dark direction.

## Interface rules

Charcoal #101112 base, #151617 sidebar, warm-white text, muted secondary labels,
and #d8ff62 selected state. Color reinforces labels and shape. No remote fonts.
Use 2D containment in Phase 1, with an explicit label that it is not a dependency graph.
Show real counts and captured source. Disabled future views say “Soon.” Never fill the
canvas with fictional extracted relationships. List view, readable source, visible focus,
responsive layout, native upload dialog, and reduced motion are required.

## Phase 2 reference update — 2026-10-10

The owner added red wireframe music-flow boards and dark green modular workflow canvases.
Use layered charcoal cards, clearly visible ports, generous 2D canvas spacing, annotated
connections, and an evidence inspector. Selected relationships get a green accent and
subtle directional motion; unresolved boundaries use red. Motion is an exploration cue,
not a claim of observed runtime execution. Pause control and reduced-motion support apply.
Source: user images a1353a1..., a6f966..., 4d7e74..., fa4d2f... in this conversation.

## Final owner correction — charcoal and red only

The owner explicitly rejected green and neon after the mixed-reference discussion.
This supersedes earlier citron/green guidance: charcoal wireframe cards, muted red
connections, circular ports, and clear small labels. Selected paths use restrained red
and directional motion, with smooth focus transitions. No neon/glow styling. Confidence
is conveyed by text and solid/dashed lines, not a green/red trust legend.

## Phase 3 product views

Feature/source, user-journey, and data-flow views reuse the charcoal/red cards, circular ports, connection labels, selected-edge motion, smooth focus, and source inspector. Product interpretations have their own inferred legend and explicit provider label. Generation/source-review controls collapse after a result to keep the map prominent. No green or neon palette was introduced.

## Phase 5 landing and evolution reference lock

Reviewed 2026-10-10 using the Refero design workflow: three independent searches (minimal editorial SaaS, dark developer diagram previews, restrained technical marketing), three full style records, and two full screen records. Owner references and the charcoal/red correction remain authoritative; no new approval was needed for the requested build.

| Reference | Borrow | Omit / adapt |
|---|---|---|
| [Linear Changelog](https://linear.app/changelog), style `11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6` | Charcoal surfaces, text-first hierarchy, hairline separation and contained functional graphics | Use existing system type and product-specific content |
| [Audyr](https://audyr.com), style `9552d07f-2f68-4dd7-a0e9-d779d4a31562` | Concise hero/CTA hierarchy and breathing room | Do not adopt its light palette |
| [Trunk](https://trunk.io), style `09af2984-b556-4971-bd5a-20224574ccd9` | Schematic linework and technical product framing | Omit green/neon styling |
| Miro Board history, Refero screen `bec9a1f2-8537-4052-b694-8bb35592575f` | Timestamped list leading to selected version | Capture times only; no implied commit history |
| n8n revision comparison, Refero screen `dfc74e55-09b5-4f67-af50-f13a1d485a81` | Explicit Before/After controls and visible version context | Reuse charcoal/red evidence map; no runtime execution implication |

**Decision ledger:** Keep the existing charcoal tokens and system fonts. Use plain text “architect” without an emblem. Give the landing page one clear message, Get started → `/dashboard`, and a simplified source-derived upload illustration. Do not invent usage statistics, testimonials or observed traffic. Show a chronological capture list, changed-file/relationship counts, explicit version selectors and source-correct maps. Added/removed/updated states use words and line treatment alongside restrained color.

**Verification:** Landing navigation, readable current copy, version-specific source and before/after maps checked in the browser. Desktop comparison and smaller-screen dashboard controls were exercised as the browser panel changed size. README images replaced with current logo-free landing/dashboard captures. No new visual assets or dependencies were needed.
