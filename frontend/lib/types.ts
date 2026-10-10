export type Evidence = { file_id: string; path: string; start_line: number; end_line: number; extractor: string; source_hash: string };
export type GraphNode = { id: string; kind: string; label: string; file_id?: string; line?: number; language?: string; description?: string; confidence?: string; evidence?: Evidence[] };
export type GraphEdge = { id: string; source: string; target: string; kind: string; confidence: string; label?: string; evidence: Evidence[] };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[]; gaps: (Partial<Evidence> & { message: string })[]; analyzer_version: string; parsed_files: number; coverage: string };
export type SourceFile = { id: string; path: string; language: string; size: number; lines: number; hash: string };
export type Summary = { file_count: number; total_bytes: number; line_count: number; languages: Record<string, number>; frameworks: string[]; skipped_count: number; skip_reasons: Record<string, number>; coverage: string };
export type Snapshot = { id: string; name: string; files: SourceFile[]; summary: Summary; contents: Record<string, string>; persisted: boolean; graph?: GraphData; warning?: string; created_at: string };
export type Change = "added" | "removed" | "updated";
export type GraphChanges = { nodes: Record<string,Change>; edges: Record<string,Change> };

export type Snippet = Omit<Evidence,"extractor"> & {id:string; content:string};
export type SourceContext = {snippets:Snippet[]; total_files:number};
type Step = {id:string; title:string; description:string; evidence_ids:string[]};
type Flow = {title:string; steps:Step[]; transitions:{source:string; target:string; label:string; evidence_ids:string[]}[]};
type Feature = {title:string; summary:string; evidence_ids:string[]; journeys:Flow[]; data_flows:Flow[]};
export type ProductMeaning = {features:Feature[]; gaps:string[]; provider:string; model:string; version:string; evidence:Snippet[]; usage:{input_tokens?:number; output_tokens?:number}};
