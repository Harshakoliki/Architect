"use client";

import FlowQuestion from "./flow-question";
import { useState } from "react";
import ArchitectureMap, { type Evidence, type GraphData, type GraphNode, type GraphEdge } from "./architecture-map";

type Snippet = Omit<Evidence,"extractor"> & {id:string; content:string};
export type SourceContext = {snippets:Snippet[]; total_files:number};
type Step = {id:string; title:string; description:string; evidence_ids:string[]};
type Flow = {title:string; steps:Step[]; transitions:{source:string; target:string; label:string; evidence_ids:string[]}[]};
type Feature = {title:string; summary:string; evidence_ids:string[]; journeys:Flow[]; data_flows:Flow[]};
export type ProductMeaning = {features:Feature[]; gaps:string[]; provider:string; model:string; version:string; evidence:Snippet[]; usage:{input_tokens?:number; output_tokens?:number}};

export default function ProductViews({context, meaning, onMeaning, mode, configured, model, sample, contents, onSource, audience, onMode}:{
  context:SourceContext; meaning?:ProductMeaning; onMeaning:(value:ProductMeaning)=>void; mode:string;
  configured:boolean; model:string; sample:boolean; contents:Record<string,string>;
  onSource:(id:string,start:number,end:number)=>void; audience:"technical"|"plain"; onMode:(mode:string)=>void;
}) {
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [featureIndex,setFeatureIndex] = useState(0);
  const [flowIndex,setFlowIndex] = useState(0);
  async function generate(example=false) {
    setBusy(true);setError("");
    try {
      const response = await fetch("/api/interpret",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,consent,example})});
      const result = await response.json();
      if(!response.ok) throw new Error(result.detail || "Interpretation failed. Your source map is still available.");
      onMeaning(result);setFeatureIndex(0);setFlowIndex(0);
    } catch(error) {setError((error as Error).message);} finally {setBusy(false);}
  }
  const proof = (ids:string[]):Evidence[] => ids.map(id => meaning!.evidence.find(item => item.id === id)!).filter(Boolean).map(item => ({...item,extractor:meaning!.provider === "openai" ? "AI interpretation · source excerpt" : "Annotated sample · source excerpt"}));
  const feature = meaning?.features[featureIndex];
  const flows = (mode === "journeys" ? feature?.journeys : feature?.data_flows) || [];
  const flow = flows[Math.min(flowIndex,Math.max(0,flows.length-1))];
  const nodes:GraphNode[] = [], edges:GraphEdge[] = [];
  if(meaning && mode === "features") {
    meaning.features.forEach((item,index) => {
      const evidence = proof(item.evidence_ids);
      nodes.push({id:`feature-${index}`,kind:"feature",label:item.title,description:item.summary,confidence:"inferred",evidence});
      for(const citation of evidence) {
        if(!nodes.some(node => node.id === citation.file_id)) nodes.push({id:citation.file_id,kind:"file",label:citation.path,file_id:citation.file_id,line:citation.start_line,description:"Captured supporting source"});
        if(!edges.some(edge => edge.source === `feature-${index}` && edge.target === citation.file_id)) edges.push({id:`support-${index}-${citation.file_id}`,source:`feature-${index}`,target:citation.file_id,kind:"supported_by",label:"cites source",confidence:"inferred",evidence:[citation]});
      }
    });
  } else if(flow) {
    flow.steps.forEach(step => nodes.push({id:step.id,kind:"step",label:step.title,description:step.description,confidence:"inferred",evidence:proof(step.evidence_ids)}));
    flow.transitions.forEach((item,index) => edges.push({id:`transition-${index}`,source:item.source,target:item.target,kind:"proposed_flow",label:item.label,confidence:"inferred",evidence:proof(item.evidence_ids)}));
  }
  const graph:GraphData = {nodes,edges,gaps:[],parsed_files:meaning?.evidence.length || 0,analyzer_version:meaning?.version || "",coverage:"Product interpretations are inferred and require human review."};
  const title = mode === "features" ? "Features and their shared source." : mode === "journeys" ? "Follow the user’s journey." : "Follow the information.";
  return <div className="product-views">
    <section className="interpretation-panel">
      <div><span className="eyebrow">PRODUCT MEANING</span><h2>{meaning ? "From code to a clearer story." : "Give your code a product perspective."}</h2><p>Feature groupings and flow steps are interpretations. Every card and connection links back to captured source.</p></div>
      {meaning ? <div className="meaning-status"><span className="confidence inferred">{meaning.provider === "openai" ? "OpenAI interpretation" : "Annotated sample · no AI call"}</span><p>{meaning.provider === "openai" ? `${meaning.model} · ${meaning.usage.input_tokens || 0} input / ${meaning.usage.output_tokens || 0} output tokens` : "Hand-authored from the bundled sample. It demonstrates the views and evidence checks."}<br/>Cached in this open scan only. Reloading clears these product views.</p></div> : <p className="inspector-note">{configured ? `OpenAI ready · ${model}` : "OpenAI is not configured. Add the server key privately to .env and restart to analyze your own repository."}</p>}
      <details className="generation-settings" open={!meaning}><summary>{meaning ? "Review source or regenerate" : "Build these product views"}</summary>
      <details className="context-preview"><summary>Review the source bundle · {context.snippets.length} excerpts from {context.total_files} files</summary><p>Up to 12 excerpts / 48 KB, with known secret patterns masked. This is partial source coverage. Filenames and code excerpts leave this device when you use OpenAI. Masking is best effort.</p>{context.snippets.map(item => <details key={item.id}><summary>{item.path}:{item.start_line}–{item.end_line}</summary><pre>{item.content}</pre></details>)}<a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">OpenAI data controls ↗</a><p>Requests use store=false. This does not guarantee zero provider retention.</p></details>
      <label className="ai-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy}/>I agree to send these source excerpts to OpenAI for this interpretation.</label>
      <div className="meaning-actions"><button className="button primary" disabled={!configured || !consent || busy || !context.snippets.length} onClick={()=>generate()}>{busy ? "Building product views…" : meaning ? "Regenerate with OpenAI" : "Build product views with OpenAI"}</button>{sample && !meaning && <button className="button ghost" disabled={busy} onClick={()=>generate(true)}>Explore annotated sample ↗</button>}</div>
      {busy && <p className="meaning-progress" role="status"><span className="spinner"/>Preparing the interpretation and checking evidence. Your source map remains available.</p>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      </details>
    </section>
    {meaning && <>
      <FlowQuestion key={meaning.provider+meaning.version} context={context} meaning={meaning} configured={configured} onSource={onSource} onOpen={(feature,flow,view)=>{setFeatureIndex(feature);setFlowIndex(flow);onMode(view);}}/>
      <div className="feature-picker"><div><span className="eyebrow">FEATURES FOUND</span><p>{meaning.features.length} candidate features · all interpretations are inferred</p></div>{mode !== "features" && <label>Feature <select aria-label="Product feature" value={featureIndex} onChange={event=>{setFeatureIndex(Number(event.target.value));setFlowIndex(0);}}>{meaning.features.map((item,index)=><option key={index} value={index}>{item.title}</option>)}</select></label>}</div>
      {mode !== "features" && feature && <div className="flow-picker"><h3>{feature.title}</h3><p>{feature.summary}</p><div role="group" aria-label="Available flows">{flows.map((item,index)=><button key={index} aria-pressed={index === Math.min(flowIndex,flows.length-1)} onClick={()=>setFlowIndex(index)}>{item.title}</button>)}</div></div>}
      {nodes.length ? <ArchitectureMap key={`${mode}:${featureIndex}:${flowIndex}:${meaning.provider}`} graph={graph} contents={contents} mode="product" audience={audience} title={title} onSource={onSource}/> : <div className="product-empty">{meaning.features.length ? "No supported flow was proposed for this feature in this view. Try another feature or inspect the known gaps." : "Not enough source evidence to propose a product feature. The architecture view remains available."}</div>}
      <details className="relationship-list product-gaps" open><summary>Interpretation gaps and limits ({meaning.gaps.length})</summary>{meaning.gaps.map((gap,index)=><p key={index}>{gap}</p>)}<p>Valid citations establish where the explanation came from. They do not prove the explanation is correct or that a flow ran in production.</p></details>
    </>}
  </div>;
}
