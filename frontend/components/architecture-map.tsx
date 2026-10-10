"use client";

import { useMemo, useState } from "react";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type NodeProps, type Node, type ReactFlowInstance } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";

import type { Evidence, GraphNode, GraphEdge, GraphData, GraphChanges, Change } from "@/lib/types";
export type { Evidence, GraphNode, GraphEdge, GraphData } from "@/lib/types";
type CardNode = Node<{ label: string; kind: string; subtitle: string; excerpt: string; active: boolean; change?: Change }, "card">;
const labels: Record<string,string> = { imports: "imports", references: "references", unresolved: "unresolved", implemented_by: "implemented by", http_candidate: "HTTP candidate" };

function Card({ data }: NodeProps<CardNode>) {
  return <div className={`architecture-card ${data.active ? "card-active" : ""} kind-${data.kind} ${data.change ? `change-${data.change}` : ""}`}>
    <Handle type="target" position={Position.Left}/>
    <div className="card-category"><span className="card-symbol">{data.kind === "route" ? "↗" : data.kind === "file" ? "⌘" : data.kind === "unresolved" ? "?" : "◇"}</span>{data.kind === "reference" ? "MODULE REFERENCE" : data.kind.toUpperCase()}<span className="card-proof">{data.kind === "unresolved" ? "?" : "●"}</span></div>
    {data.change && <span className="change-label">{data.change === "updated" ? "source updated" : data.change}</span>}
    <div className="card-title">{data.label}</div><div className="card-subtitle">{data.subtitle}</div>
    {data.excerpt && <div className="card-excerpt">{data.excerpt}</div>}
    <Handle type="source" position={Position.Right}/>
  </div>;
}
const nodeTypes = { card: Card };
function edgeLabel(edge: GraphEdge) { return edge.label || labels[edge.kind] || edge.kind; }
const initialFitOptions = { padding: .2, maxZoom: 1 };

export default function ArchitectureMap({ graph, contents, mode, onSource, title, audience="technical", changes }: {
  graph: GraphData; contents: Record<string,string>; mode: string; onSource: (id: string,line: number,end: number) => void; title?: string; audience?: "technical" | "plain"; changes?: GraphChanges;
}) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState("");
  const [edgeId, setEdgeId] = useState("");
  const [references, setReferences] = useState(true);
  const [moving, setMoving] = useState(true);
  const [canvas, setCanvas] = useState<ReactFlowInstance<CardNode> | null>(null);
  const byId = useMemo(() => new Map(graph.nodes.map(node => [node.id,node])),[graph]);
  const eligible = graph.edges.filter(edge => mode !== "dependencies" || ["imports","references","unresolved"].includes(edge.kind));
  const selectedEdge = graph.edges.find(edge => edge.id === edgeId);
  const focusNode = byId.get(focus);
  const related = eligible.filter(edge => edge.source === focus || edge.target === focus);
  const highlighted = new Set(selectedEdge ? [selectedEdge.source,selectedEdge.target] : focus ? [focus,...related.flatMap(edge => [edge.source,edge.target])] : []);
  const allowed = new Set(graph.nodes.filter(node => (references || node.kind !== "reference") && (mode !== "dependencies" || node.kind !== "route")).map(node => node.id));
  let visibleIds = new Set(allowed);
  if (query) {
    const matches = new Set(graph.nodes.filter(node => node.label.toLowerCase().includes(query.toLowerCase())).map(node => node.id));
    visibleIds = new Set([...matches,...eligible.filter(edge => matches.has(edge.source) || matches.has(edge.target)).flatMap(edge => [edge.source,edge.target])].filter(id => allowed.has(id)));
  }
  const candidates = graph.nodes.filter(node => visibleIds.has(node.id));
  const shown = candidates.slice(0,120);
  const shownIds = new Set(shown.map(node => node.id));
  const shownEdges = eligible.filter(edge => shownIds.has(edge.source) && shownIds.has(edge.target));
  const layout = useMemo(() => {
    const topology = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    topology.setGraph({ rankdir:"LR",nodesep:42,ranksep:110,marginx:35,marginy:35 });
    shown.forEach(node => topology.setNode(node.id,{width:238,height:164}));
    shownEdges.forEach(edge => topology.setEdge(edge.source,edge.target));
    dagre.layout(topology);
    return new Map(shown.map(node => [node.id,topology.node(node.id)]));
  // Keep focus interactions from rerunning automatic layout.
  },[graph,mode,query,references]);
  const nodes: CardNode[] = shown.map(node => {
    const point = layout.get(node.id);
    const content = node.file_id ? contents[node.file_id] || "" : "";
    return { id:node.id,type:"card",position:{x:point.x-119,y:point.y-82},data:{
      label:audience === "plain" && node.kind === "file" ? (node.label.split("/").pop() || node.label) : node.label,kind:node.kind,subtitle:audience === "plain" ? node.description || ({file:"Source file · select to inspect its connections",route:"A declared request handler",reference:"A referenced module",unresolved:"A reference we could not resolve"}[node.kind] || "Source-supported relationship") : node.evidence?.[0] ? `${node.evidence[0].path}:${node.evidence[0].start_line}` : node.language || node.description || "Declared source relationship",
      excerpt:audience === "technical" && node.kind === "file" ? content.split("\n").find(line => line.trim() && !line.trim().startsWith("//"))?.slice(0,70) || "" : "",
      active:highlighted.has(node.id),change:changes?.nodes[node.id],
    },style:{opacity:highlighted.size && !highlighted.has(node.id) ? .4 : 1},ariaLabel:`${node.kind}: ${node.label}` };
  });
  const edges = shownEdges.map(edge => {
    const active = selectedEdge ? edge.id === selectedEdge.id : focus ? edge.source === focus || edge.target === focus : false;
    const color = edge.confidence === "unknown" ? "#bc5d70" : active ? "#dc6674" : edge.confidence === "inferred" ? "#ad7b86" : "#8e4b59";
    return {...edge,type:"smoothstep",label:audience === "plain" ? ({imports:"uses code from",references:"refers to module",unresolved:"unresolved reference",implemented_by:"handled by",http_candidate:"possible request"}[edge.kind] || edgeLabel(edge)) : edgeLabel(edge),
      animated:active && moving,className:`${active ? "edge-active" : ""} ${changes?.edges[edge.id] ? `edge-change-${changes.edges[edge.id]}` : ""}`,focusable:true,
      markerEnd:{type:MarkerType.ArrowClosed,color,width:14,height:14},
      style:{stroke:color,strokeWidth:active || changes?.edges[edge.id] ? 2 : 1.3,opacity:highlighted.size && !active ? .25 : 1,
        strokeDasharray:changes?.edges[edge.id] === "removed" ? "3 4" : edge.confidence !== "observed" ? "5 5" : undefined},
      labelStyle:{fill:active ? "#e0c6d0" : "#b7a9b0",fontSize:11},
      labelBgStyle:{fill:"#1b181c",stroke:color,strokeWidth:.5},labelBgPadding:[9,4] as [number,number],labelBgBorderRadius:10,
      ariaLabel:`${byId.get(edge.source)?.label} ${edgeLabel(edge)} ${byId.get(edge.target)?.label}; ${edge.confidence}`,
    };
  });
  function focusOn(ids: string[]) {
    void canvas?.fitView({nodes:ids.map(id => ({id})),padding:.3,maxZoom:1.15,duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280});
  }
  const selectEdge = (edge: GraphEdge) => {setEdgeId(edge.id);setFocus("");focusOn([edge.source,edge.target]);};
  return <section className="graph-section">
    <div className="graph-toolbar"><div><span className="eyebrow">{mode === "product" ? "INTERPRETED PRODUCT FLOWS" : "SOURCE-DERIVED RELATIONSHIPS"}</span><h2>{title || (mode === "dependencies" ? "What depends on what." : "Your architecture, connected.")}</h2></div><span className="graph-status"><span className="tiny-dot"/> {graph.parsed_files} {mode === "product" ? "source excerpts" : "files parsed"}</span></div>
    <div className="graph-filters"><label className="search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a component…" aria-label="Find a graph component"/></label>{mode !== "product" && <label><input type="checkbox" checked={references} onChange={event => setReferences(event.target.checked)}/>Module references</label>}<label className="component-jump">Jump to component <select aria-label="Jump to component" value={focus} onChange={event=>{setFocus(event.target.value);setEdgeId("");if(event.target.value)focusOn([event.target.value]);}}><option value="">Choose a component</option>{shown.map(node=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><button onClick={()=>void canvas?.fitView(initialFitOptions)}>Fit map</button><label><input type="checkbox" checked={moving} onChange={event => setMoving(event.target.checked)}/>Flow motion</label><button onClick={() => {setFocus("");setEdgeId("");setQuery("");}}>Clear focus</button></div>
    <div className="graph-workspace"><div className="graph-canvas">
      {shown.length ? <ReactFlow key={`${mode}:${query}:${references}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={initialFitOptions} minZoom={.15} maxZoom={2} onInit={setCanvas} colorMode="dark" nodesConnectable={false} nodesDraggable={false} elementsSelectable deleteKeyCode={null} ariaLabelConfig={{"node.a11yDescription.default":"Press Enter or Space to inspect this component. The map is read-only.","node.a11yDescription.keyboardDisabled":"Press Enter or Space to inspect this component. The map is read-only.","edge.a11yDescription.default":"Press Enter or Space to inspect this connection and its evidence. The map is read-only."}}
        onNodeClick={(_,node) => {setFocus(node.id);setEdgeId("");}}
        onEdgeClick={(_,edge) => {setEdgeId(edge.id);setFocus("");focusOn([edge.source,edge.target]);}}
        onPaneClick={() => {setFocus("");setEdgeId("");}}
        onSelectionChange={({nodes:selectedNodes,edges:selectedEdges}) => {
          if(selectedEdges.length){setEdgeId(selectedEdges[0].id);setFocus("");}
          else if(selectedNodes.length){setFocus(selectedNodes[0].id);setEdgeId("");}
        }}>
        <Background color="#3a3037" gap={22} size={.7}/><Controls showInteractive={false}/><MiniMap nodeColor={node => node.data.kind === "route" ? "#996577" : "#4d3b46"} pannable zoomable/>
      </ReactFlow> : <div className="graph-empty">{query ? "No supported relationships match this search." : "No supported source modules in this scan. The inventory remains available."}</div>}
      <div className="graph-legend">{mode === "product" ? <span><i className="inferred"/>Inferred · review source evidence</span> : <><span><i/>Observed</span><span><i className="inferred"/>Candidate</span><span><i className="unknown"/>Unresolved</span></>}</div>
    </div><aside className="graph-inspector" aria-label="Connection inspector">
      <span className="eyebrow">THE EVIDENCE</span>
      {selectedEdge ? <><h3>{edgeLabel(selectedEdge)}</h3><span className={`confidence ${selectedEdge.confidence}`}>{selectedEdge.confidence}</span><p className="relationship-text">{byId.get(selectedEdge.source)?.label}<span>↓</span>{byId.get(selectedEdge.target)?.label}</p>
        {changes?.edges[selectedEdge.id] && <span className="change-label">{changes.edges[selectedEdge.id] === "updated" ? "relationship / evidence updated" : changes.edges[selectedEdge.id]}</span>}
        {selectedEdge.kind === "http_candidate" && <p className="inspector-note">Matched by literal HTTP method and path. Routing, service origin, and execution are not proven.</p>}
        {selectedEdge.kind === "references" && <p className="inspector-note">The import is observed. The module is outside the captured source or cannot be resolved here.</p>}
        {selectedEdge.evidence.map((proof,index) => <div className="proof-card" key={index}><span>{proof.extractor}</span><strong>{proof.path}:{proof.start_line}</strong><pre>{(contents[proof.file_id] || "").split(/\r?\n/).slice(proof.start_line-1,Math.min(proof.end_line,proof.start_line+7)).join("\n")}</pre><button onClick={() => onSource(proof.file_id,proof.start_line,proof.end_line)}>Open supporting source ↗</button></div>)}
      </> : focusNode ? <><h3>{focusNode.label}</h3>{changes?.nodes[focusNode.id] && <span className="change-label">{changes.nodes[focusNode.id] === "updated" ? "source updated" : changes.nodes[focusNode.id]}</span>}<span className={`confidence ${focusNode.confidence || "observed"}`}>{focusNode.confidence || focusNode.kind}</span><p className="inspector-note">{focusNode.description || "Select a connection below to inspect its evidence."}</p>{focusNode.file_id && <button className="button ghost" onClick={() => onSource(focusNode.file_id!,focusNode.line || 1,focusNode.line || 1)}>Open source ↗</button>}<button className="button ghost focus-selection" onClick={() => focusOn([...highlighted])}>Focus this component</button>{focusNode.evidence?.map((proof,index) => <div className="proof-card" key={index}><span>{proof.extractor}</span><strong>{proof.path}:{proof.start_line}–{proof.end_line}</strong><button onClick={() => onSource(proof.file_id,proof.start_line,proof.end_line)}>Open supporting source ↗</button></div>)}<h4>Direct relationships ({related.length})</h4>{related.slice(0,30).map(edge => <button className="related-edge" key={edge.id} onClick={() => selectEdge(edge)}><span>{edge.source === focus ? "OUT →" : "IN ←"} {edgeLabel(edge)}</span>{byId.get(edge.source === focus ? edge.target : edge.source)?.label}</button>)}{!related.length && <p className="inspector-note">No supported direct relationships were found. This does not prove the file is unused.</p>}</> : <><div className="inspector-placeholder">↗</div><h3>Follow a connection.</h3><p className="inspector-note">Select a card to see its direct relationships. Select a line to see the source that supports it.</p><div className="inspector-divider"/><p className="inspector-note">{mode === "product" ? "Product steps and flow order are inferred from source excerpts and require review. Motion guides attention; it is not a runtime trace." : "Arrows follow the labeled relationship. This is static source analysis, not a live execution trace. Motion guides your attention."}</p></>}
    </aside></div>
    <div className="graph-footnote">Scroll to zoom, drag the background to pan, or jump to a component for a readable close-up. Tab to cards and connections; Enter selects them. The relationship list below offers the same evidence. <br/>Showing {shown.length} of {candidates.length} matching nodes · {shownEdges.length} visible connections · {mode === "product" ? "inferred relationships · review the gaps below." : `${graph.gaps.length} extraction gaps.`} {candidates.length > 120 && "Refine search to explore beyond the 120-node canvas limit."}</div>
    <details className="relationship-list"><summary>Browse relationships as a list ({shownEdges.length})</summary>{shownEdges.map(edge => <button key={edge.id} onClick={() => selectEdge(edge)}>{byId.get(edge.source)?.label}<span>{edgeLabel(edge)} →</span>{byId.get(edge.target)?.label}<small>{edge.confidence}</small></button>)}</details>
    {graph.gaps.length > 0 && <details className="relationship-list gap-list"><summary>Known gaps ({graph.gaps.length})</summary>{graph.gaps.slice(0,100).map((gap,index) => <div key={index}><strong>{gap.path}:{gap.start_line}</strong><span>{gap.message}</span>{gap.file_id && <button onClick={() => onSource(gap.file_id!,gap.start_line || 1,gap.start_line || 1)}>Inspect source ↗</button>}</div>)}</details>}
  </section>;
}
