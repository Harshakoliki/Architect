import type { Change, GraphChanges, GraphData, Snapshot } from "./types";

type Entry = { key:string; label:string; ids:string[]; signature:string };
export type Delta = { key:string; label:string; status:Change; beforeIds:string[]; afterIds:string[] };
function changes(before:Entry[], after:Entry[]):Delta[] {
  const old = new Map(before.map(item=>[item.key,item]));
  const next = new Map(after.map(item=>[item.key,item]));
  const result:Delta[] = [];
  for(const key of [...new Set([...old.keys(),...next.keys()])].sort()) {
    const a=old.get(key),b=next.get(key);
    if(a?.signature === b?.signature) continue;
    result.push({key,label:(b || a)!.label,status:!a?"added":!b?"removed":"updated",beforeIds:a?.ids || [],afterIds:b?.ids || []});
  }
  return result;
}
function graphEntries(graph:GraphData, snapshot:Snapshot) {
  const files = new Map(snapshot.files.map(file=>[file.id,file]));
  const labels = new Map(graph.nodes.map(node=>[node.id,node.label]));
  // Route extraction IDs include line numbers; compare their declarations across captures instead.
  const identities = new Map(graph.nodes.map(node=>[node.id,node.kind === "route" ? JSON.stringify([node.kind,node.file_id,node.label]) : node.id]));
  const nodeGroups = new Map<string,Entry>();
  for(const node of graph.nodes) {
    const key=identities.get(node.id)!;
    const existing=nodeGroups.get(key);
    const signature=JSON.stringify([node.kind,node.label,node.description,node.language,node.line,files.get(node.file_id || "")?.hash]);
    if(existing) {existing.ids.push(node.id);existing.signature += signature;}
    else nodeGroups.set(key,{key,label:node.label,ids:[node.id],signature});
  }
  const edgeGroups = new Map<string,{label:string;ids:string[];proof:Set<string>}>();
  for(const edge of graph.edges) {
    const source=identities.get(edge.source),target=identities.get(edge.target);
    if(!source || !target) continue;
    const key=JSON.stringify([source,target,edge.kind]);
    const group=edgeGroups.get(key) || {label:`${labels.get(edge.source)} → ${labels.get(edge.target)} · ${edge.label || edge.kind}`,ids:[],proof:new Set<string>()};
    group.ids.push(edge.id);
    group.proof.add(JSON.stringify([edge.confidence,edge.label || edge.kind]));
    for(const proof of edge.evidence) group.proof.add(JSON.stringify([proof.path,proof.start_line,proof.end_line,proof.extractor,proof.source_hash]));
    edgeGroups.set(key,group);
  }
  return {nodes:[...nodeGroups.values()],edges:[...edgeGroups].map(([key,group])=>({key,label:group.label,ids:group.ids,signature:JSON.stringify([...group.proof].sort())}))};
}
export function compareSnapshots(before:Snapshot,after:Snapshot) {
  const files=changes(before.files.map(file=>({key:file.path,label:file.path,ids:[file.id],signature:file.hash})),after.files.map(file=>({key:file.path,label:file.path,ids:[file.id],signature:file.hash})));
  const compatible=!!before.graph?.analyzer_version && before.graph.analyzer_version === after.graph?.analyzer_version;
  let nodes:Delta[]=[],edges:Delta[]=[];
  if(compatible) {
    const a=graphEntries(before.graph!,before),b=graphEntries(after.graph!,after);
    nodes=changes(a.nodes,b.nodes);edges=changes(a.edges,b.edges);
  }
  const beforeChanges:GraphChanges={nodes:{},edges:{}},afterChanges:GraphChanges={nodes:{},edges:{}};
  for(const [kind,items] of [["nodes",nodes],["edges",edges]] as const) for(const item of items) {
    item.beforeIds.forEach(id=>beforeChanges[kind][id]=item.status);
    item.afterIds.forEach(id=>afterChanges[kind][id]=item.status);
  }
  return {files,nodes,edges,compatible,beforeChanges,afterChanges};
}
