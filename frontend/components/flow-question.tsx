"use client";

import { useState } from "react";
import type { ProductMeaning, SourceContext } from "./product-views";

type Answer = {status:string; answer:string; feature_index:number|null; flow_index:number|null; view:string; evidence_ids:string[]; provider:string};
export default function FlowQuestion({context,meaning,configured,onOpen,onSource}:{context:SourceContext;meaning:ProductMeaning;configured:boolean;onOpen:(feature:number,flow:number,view:string)=>void;onSource:(id:string,start:number,end:number)=>void}) {
  const [question,setQuestion] = useState("");
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [answer,setAnswer] = useState<Answer|null>(null);
  const sample = meaning.provider === "annotated_sample";
  async function ask(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");setAnswer(null);
    try {
      const response = await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,meaning:{features:meaning.features,gaps:meaning.gaps},question,consent,example:sample})});
      const result = await response.json();
      if(!response.ok) throw new Error(result.detail || "The question could not be answered.");
      setAnswer(result);
    } catch(error) {setError((error as Error).message);} finally {setBusy(false);}
  }
  return <section className="flow-question"><span className="eyebrow">ASK YOUR CODEBASE</span><h2>Find the flow behind a question.</h2><p>{sample ? "Limited sample flow finder · no AI call. Try upload or fingerprinting; add ‘data’ for information flow." : "OpenAI uses this reviewed source bundle and existing interpretation. Answers are inferred and may be incomplete."}</p><form onSubmit={ask}><label htmlFor="flow-question">What would you like to understand?</label><div className="question-input"><input id="flow-question" value={question} onChange={event=>setQuestion(event.target.value)} minLength={3} maxLength={500} required placeholder="Show me everything involved when a customer uploads a document"/><button className="button primary" disabled={busy || question.trim().length < 3 || (!sample && (!configured || !consent))}>{busy ? "Finding evidence…" : "Explore flow ↗"}</button></div><button type="button" className="question-example" onClick={()=>setQuestion("Show me everything involved when a customer uploads a document")}>Try: customer uploads a document</button>{!sample && <label className="ai-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>Send my question, interpretation and reviewed source excerpts to OpenAI. Uses store=false; provider retention may still apply.</label>}</form>{error && <p role="alert" className="modal-error">{error}</p>}{answer && <div className="question-answer" role="status"><span className="confidence inferred">{answer.provider === "sample_finder" ? "Sample finder · no AI" : "OpenAI · inferred"}</span><p>{answer.answer}</p>{answer.status === "answered" && answer.feature_index !== null && <button className="button ghost" onClick={()=>onOpen(answer.feature_index!,answer.flow_index || 0,answer.view)}>Open this flow ↗</button>}<div className="answer-evidence">{answer.evidence_ids.map(id=>{const source=context.snippets.find(item=>item.id===id);return source && <button key={id} onClick={()=>onSource(source.file_id,source.start_line,source.end_line)}>{source.path}:{source.start_line}–{source.end_line} ↗</button>;})}</div></div>}</section>;
}
