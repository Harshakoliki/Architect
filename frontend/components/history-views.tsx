"use client";

import { useMemo, useState } from "react";
import ArchitectureMap from "./architecture-map";
import { compareSnapshots, type Delta } from "@/lib/history";
import type { Snapshot } from "@/lib/types";

const captureTime=(snapshot:Snapshot)=>new Date(snapshot.created_at).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
export default function HistoryViews({snapshots,current,audience,onUpload,onSampleNext,onKeep,onRemove,onSource,busy}:{
  snapshots:Snapshot[];current:Snapshot;audience:"technical"|"plain";busy:boolean;
  onUpload:()=>void;onSampleNext:()=>void;onKeep:()=>void;onRemove:(id:string)=>void;
  onSource:(snapshot:Snapshot,id:string,start:number,end:number)=>void;
}) {
  const ordered=useMemo(()=>[...snapshots].sort((a,b)=>a.created_at.localeCompare(b.created_at)),[snapshots]);
  const [beforeId,setBeforeId]=useState("");
  const [afterId,setAfterId]=useState("");
  const [side,setSide]=useState<"before"|"after">("after");
  const before=ordered.find(item=>item.id===beforeId) || ordered[0];
  const after=ordered.find(item=>item.id===afterId) || ordered[ordered.length-1];
  const comparison=useMemo(()=>before && after && before.id!==after.id ? compareSnapshots(before,after) : null,[before,after]);
  const shown=side === "before" ? before : after;
  const kept=snapshots.some(item=>item.id===current.id);
  function proof(item:Delta,version:"before"|"after",kind:"files"|"edges") {
    const snapshot=version === "before" ? before : after;
    const id=(version === "before" ? item.beforeIds : item.afterIds)[0];
    if(!id) return;
    if(kind === "files") onSource(snapshot,id,1,1);
    else {
      const evidence=snapshot.graph?.edges.find(edge=>edge.id===id)?.evidence[0];
      if(evidence) onSource(snapshot,evidence.file_id,evidence.start_line,evidence.end_line);
    }
  }
  function list(items:Delta[],kind:"files"|"edges") {
    return items.length ? <div className="change-list">{items.map(item=><div className="change-row" key={item.key}><span className={`change-label change-${item.status}`}>{item.status === "updated" ? kind === "edges" ? "evidence / relation updated" : "modified" : item.status}</span><strong>{item.label}</strong><div>{item.beforeIds.length > 0 && <button onClick={()=>proof(item,"before",kind)}>Before source ↗</button>}{item.afterIds.length > 0 && <button onClick={()=>proof(item,"after",kind)}>After source ↗</button>}</div></div>)}</div> : <p className="history-note">No {kind === "files" ? "file" : "supported relationship"} changes found in this comparison. This does not establish identical runtime behavior.</p>;
  }
  return <section className="history-view">
    <div className="history-intro"><span className="eyebrow">PRODUCT EVOLUTION</span><h2>See what changed. Keep the context.</h2><p>Compare captured versions of the same codebase. Follow changed files and supported connections back to the source that existed in each version.</p><div className="history-actions"><button className="button primary" onClick={onUpload} disabled={busy}>Upload next version ↗</button><button className="button ghost" onClick={onSampleNext} disabled={busy}>Try updated sample ↗</button>{!kept && <button className="button ghost" disabled={snapshots.length>=8} onClick={onKeep}>Keep current snapshot</button>}</div><p className="history-note">Up to 8 snapshots in this open dashboard; reloading or leaving clears the comparison tray. Saved Supabase scans can be reopened below when configured. These are capture times, not commit dates. Choose versions of the same repository; lineage is not verified.</p>{snapshots.length>=8 && <p className="history-note" role="status">Comparison tray is full. Remove an entry before keeping another snapshot. Saved server scans are unaffected.</p>}</div>
    <ol className="snapshot-timeline" aria-label="Captured snapshot timeline">{ordered.map((snapshot,index)=><li key={snapshot.id}><button className="snapshot-select" aria-pressed={snapshot.id===after?.id} onClick={()=>{setAfterId(snapshot.id);setSide("after");}}><span className="timeline-marker"/><span className="snapshot-number">{String(index+1).padStart(2,"0")}</span><strong>{snapshot.name}</strong><time dateTime={snapshot.created_at}>{captureTime(snapshot)}</time><small>{snapshot.files.length} files · {snapshot.persisted ? "Saved scan" : "Session only"}</small></button><button className="snapshot-remove" aria-label={`Remove ${snapshot.name} from comparison tray`} onClick={()=>onRemove(snapshot.id)}>Remove from tray</button></li>)}</ol>
    {ordered.length<2 ? <div className="product-empty">Keep two versions to begin. Upload a changed ZIP, or try the updated sample to compare it with the original document-app sample. No snapshot is altered by comparison.</div> : <>
      <div className="comparison-controls"><label>Before <select aria-label="Before snapshot" value={before?.id || ""} onChange={event=>setBeforeId(event.target.value)}>{ordered.map((snapshot,index)=><option value={snapshot.id} key={snapshot.id}>{index+1}. {snapshot.name} · {captureTime(snapshot)}</option>)}</select></label><span aria-hidden="true">→</span><label>After <select aria-label="After snapshot" value={after?.id || ""} onChange={event=>setAfterId(event.target.value)}>{ordered.map((snapshot,index)=><option value={snapshot.id} key={snapshot.id}>{index+1}. {snapshot.name} · {captureTime(snapshot)}</option>)}</select></label></div>
      {!comparison ? <p className="product-empty">Choose two different snapshots to compare.</p> : <>
        <div className="comparison-summary" aria-label="Comparison summary">{["added","removed","updated"].map(status=><div key={status}><span>{status === "updated" ? "MODIFIED FILES" : `${status.toUpperCase()} FILES`}</span><strong>{comparison.files.filter(item=>item.status===status).length}</strong></div>)}<div><span>RELATIONSHIP CHANGES</span><strong>{comparison.compatible ? comparison.edges.length : "—"}</strong></div></div>
        {!comparison.compatible && <p className="notice" role="status">Analyzer versions differ or a graph is missing. File hashes can be compared; structural differences are withheld so analyzer changes are not presented as product changes.</p>}
        <p className="history-note">{comparison.files.length ? `${comparison.files.length} file changes found.` : "No file content changes found."} {comparison.compatible && `${comparison.edges.filter(item=>item.status==="added").length} new connections, ${comparison.edges.filter(item=>item.status==="removed").length} removed, ${comparison.edges.filter(item=>item.status==="updated").length} with updated evidence or relationship metadata.`} File renames appear as a removal and an addition. Updated evidence can reflect moved lines or changed source, without proving changed behavior.</p>
        <details className="history-changes" open><summary>Changed files ({comparison.files.length})</summary>{list(comparison.files,"files")}</details>
        {comparison.compatible && <details className="history-changes"><summary>Changed connections ({comparison.edges.length})</summary>{list(comparison.edges,"edges")}</details>}
        <div className="history-map-heading"><div><span className="eyebrow">COMPARE THE ARCHITECTURE</span><p>Added and removed components are labeled; updated cards and connections flag source or evidence changes.</p></div><div className="view-switch"><button aria-pressed={side==="before"} onClick={()=>setSide("before")}>Before map</button><button aria-pressed={side==="after"} onClick={()=>setSide("after")}>After map</button></div></div>
        {shown?.graph?.nodes.length ? <ArchitectureMap key={`${before.id}:${after.id}:${side}`} graph={shown.graph} contents={shown.contents} mode="architecture" audience={audience} title={`${side === "before" ? "Before" : "After"}: ${shown.name}`} changes={side === "before" ? comparison.beforeChanges : comparison.afterChanges} onSource={(id,start,end)=>onSource(shown,id,start,end)}/> : <div className="product-empty">This snapshot has no supported architecture graph. Its file changes are still available.</div>}
        <p className="history-note">Only captured static relationships are compared. Product interpretations remain attached to their own scan; they are not carried forward as verified explanations. No Git history, automatic refresh, feature-level semantic diff or runtime tracing is implied.</p>
      </>}
    </>}
  </section>;
}
