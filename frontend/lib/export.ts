import type { Evidence, ProductMeaning, Snapshot } from "./types";

const text = (value: string) => value.replace(/[&<>]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[character]!)).replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&").replace(/[\r\n]+/g," ");

export function exportReport(snapshot: Snapshot, meaning?: ProductMeaning) {
  const evidence: Evidence[] = [];
  const cite = (proofs: Evidence[] = []) => proofs.map(proof => {
    let index = evidence.findIndex(item => JSON.stringify(item) === JSON.stringify(proof));
    if (index < 0) index = evidence.push(proof) - 1;
    return `[E${index+1}](#evidence-${index+1})`;
  }).join(", ") || "No source citation";
  const graph = snapshot.graph;
  const names = new Map(graph?.nodes.map(node => [node.id,node.label]));
  const lines = [`# Architect report: ${text(snapshot.name)}`, "", `Snapshot: ${text(snapshot.id)} · Captured: ${text(snapshot.created_at)}`, "",
    "Static source analysis. A connection does not prove runtime execution. Product explanations are inferred and require review.", "",
    "This download contains filenames, relationship metadata and citations. Full source contents and reviewed OpenAI excerpts are excluded. Review it before sharing.", "",
    "## Coverage", "", text(snapshot.summary.coverage), "", `Analyzer: ${text(graph?.analyzer_version || "unavailable")} · ${snapshot.files.length} captured files · ${graph?.parsed_files || 0} parsed files`, "",
    "## Components", "", ...(graph?.nodes.map(node => `- **${text(node.label)}** (${text(node.kind)}; ${text(node.confidence || "unspecified")}) — ${cite(node.evidence)}`) || ["No graph available."]), "",
    "## Connections", "", ...(graph?.edges.map(edge => `- **${text(names.get(edge.source) || edge.source)}** → **${text(names.get(edge.target) || edge.target)}**: ${text(edge.label || edge.kind)} (${text(edge.confidence)}) — ${cite(edge.evidence)}`) || []), "",
    "## Analysis gaps", "", ...(graph?.gaps.map(gap => `- ${text(gap.message)}${gap.path ? ` (${text(gap.path)}:${gap.start_line || 1})` : ""}`) || [])];
  const product = meaning && {
    provider: meaning.provider, model: meaning.model, version: meaning.version,
    features: meaning.features, gaps: meaning.gaps,
    evidence: meaning.evidence.map(({content: _content, ...proof}) => proof),
  };
  if (meaning) {
    const proof = (ids: string[]) => ids.flatMap(id => {
      const item = meaning.evidence.find(entry => entry.id === id);
      return item ? [{file_id:item.file_id,path:item.path,start_line:item.start_line,end_line:item.end_line,source_hash:item.source_hash,extractor:`${meaning.provider} citation`}] : [];
    });
    lines.push("", "## Product interpretation · inferred", "", `Provider: ${text(meaning.provider)} · Model: ${text(meaning.model)}`);
    for (const feature of meaning.features) {
      lines.push("", `### ${text(feature.title)}`, "", text(feature.summary), "", cite(proof(feature.evidence_ids)));
      for (const [label,flows] of [["User journey",feature.journeys],["Data flow",feature.data_flows]] as const) {
        for (const flow of flows) {
          lines.push("", `#### ${label}: ${text(flow.title)}`, "");
          for (const step of flow.steps) lines.push(`- **${text(step.title)}**: ${text(step.description)} — ${cite(proof(step.evidence_ids))}`);
          for (const edge of flow.transitions) lines.push(`- ${text(edge.source)} → ${text(edge.target)}: ${text(edge.label)} — ${cite(proof(edge.evidence_ids))}`);
        }
      }
    }
    lines.push("", "### Interpretation gaps", "", ...meaning.gaps.map(gap=>`- ${text(gap)}`));
  }
  lines.push("", "## Source evidence", "");
  evidence.forEach((proof,index)=>lines.push(`<a id="evidence-${index+1}"></a>`, "", `**E${index+1}** — ${text(proof.path)}:${proof.start_line}–${proof.end_line} · ${text(proof.extractor)}`, "", `SHA256: ${text(proof.source_hash)}`, ""));
  lines.push("## Captured file inventory", "", ...snapshot.files.map(file=>`- ${text(file.path)} · ${file.lines} lines · SHA256 ${text(file.hash)}`));
  return {
    markdown: lines.join("\n")+"\n",
    json: JSON.stringify({schema_version:1, snapshot:{id:snapshot.id,name:snapshot.name,created_at:snapshot.created_at},
      limitations:"Static and inferred relationships are not runtime traces. Full source and reviewed excerpts excluded.",
      summary:snapshot.summary,files:snapshot.files,graph,product}, null, 2),
  };
}
