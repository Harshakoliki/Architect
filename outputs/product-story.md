# Architect — Product story and pitch

**Positioning:** Understand the product behind your code.

**Core promise:** Turn “How does this work?” into a visual flow you can explore and check against the source.

## Problem

A team can have access to its entire codebase and still struggle to answer a simple product question: “What happens when a customer uploads a document?”

The answer crosses screens, handlers, APIs and storage logic. Someone has to find the relevant files, reconstruct the connections, and translate the result for everyone else. When that knowledge lives across code and a few people's memories, onboarding and change discussions can repeatedly require the same investigation.

The cost is attention: developers interrupt their work to explain the system, newcomers lack a starting point, and product conversations proceed with an incomplete picture.

## Solution

Architect turns supported source relationships and cited product interpretations into an interactive visual workspace. Start with a repository, follow a feature through its proposed journey or data flow, and inspect the source behind each card or connection.

Ask a product question to find an existing flow. Switch between Plain English and Technical detail to discuss the same evidence with different teammates. Observations, inferences and missing context remain visible throughout.

## Benefits

- **A clearer starting point:** find relevant modules and routes before diving into source.
- **A feature you can follow:** connect code relationships to a product action through cited interpretations.
- **A shared explanation:** give technical and nontechnical teammates a common visual reference.
- **A reviewable answer:** inspect the supporting source and decide whether the explanation holds up.
- **A more concrete change discussion:** bring direct connections and unresolved questions into the conversation.

These are the intended benefits. Time savings, defect reduction and adoption have not been measured. The MVP does not establish complete runtime behavior or change impact.

## Short pitch

Your team has the code. Understanding how the product fits together can still mean hunting through files and asking the people who built it. Architect makes supported connections visible through interactive maps, cited feature flows, and Plain English or Technical explanations. Follow a product question to the relevant flow, inspect its source, and give the team a clearer starting point for the next conversation.

## Submission description

Architect helps teams understand the product behind their code. Product knowledge is often scattered across files, documentation and people's memories, so even “What happens when a customer uploads a document?” can become an investigation. Architect turns supported source relationships into interactive architecture and dependency maps, then adds cited feature, journey and data-flow interpretations. Users can explore a flow question, inspect supporting source, and switch between Plain English and Technical detail. The goal is a clearer starting point for onboarding and a shared reference for product and change discussions. The Phase 4 MVP runs locally, accepts small repository ZIPs, and includes a no-key annotated demo. Optional OpenAI integration requires consent; live provider verification is pending. History and GitHub ingestion are planned.

## Forty-second demo story

1. **Start with the pain:** “We have the code, but explaining one feature still means reconstructing how the parts connect.”
2. **Open the sample:** “Architect scans actual source and maps supported imports and routes.”
3. **Show the question:** “Here is the document-upload question. This no-key sample finder opens a hand-authored, source-linked example; it is explicitly labeled.”
4. **Follow the flow:** “Selection, request candidate, memory record, feedback. Click a connection to inspect its evidence.”
5. **Switch explanation level:** “Same map and evidence, with detail suited to the person exploring it.”
6. **Close with the payoff:** “A clearer place to begin, an explanation to share, and source you can check.”

## Messaging rules

- Use **problem → solution → benefit** in introductions, demos and descriptions.
- Lead with a recognizable product question and the effort required to answer it.
- Describe benefits through actions people can perform; quantify outcomes only after measurement.
- Distinguish the demonstrated sample, supported static extraction, and inferred AI output.
- Call history, GitHub ingestion and the local companion planned until implemented.
- Say local execution only when the services run locally. Hosted uploads reach a server; optional OpenAI sends reviewed context after consent. Do not claim all modes keep code on-device.
- Treat animation as exploration guidance, never proof of a live runtime trace.
