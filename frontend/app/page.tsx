"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData } from "@/components/architecture-map";
import type { ProductMeaning, SourceContext } from "@/components/product-views";
const ProductViews = dynamic(() => import("@/components/product-views"), { ssr: false });
const ArchitectureMap = dynamic(() => import("@/components/architecture-map"), { ssr: false });

type SourceFile = { id: string; path: string; language: string; size: number; lines: number; hash: string };
type Summary = { file_count: number; total_bytes: number; line_count: number; languages: Record<string, number>; frameworks: string[]; skipped_count: number; skip_reasons: Record<string, number>; coverage: string };
type Project = { id: string; name: string; files: SourceFile[]; summary: Summary; contents: Record<string, string>; persisted: boolean; graph?: GraphData; ai_context?: SourceContext; meaning?: ProductMeaning; sample?: boolean; warning?: string; created_at: string };
type SavedProject = Pick<Project, "id" | "name" | "summary" | "created_at">;
const layerModes = ["architecture", "journeys", "data", "features", "dependencies", "history"];
const layerNames:Record<string,string> = {overview:"Overview",architecture:"Architecture",journeys:"User journeys",data:"Data flows",features:"Feature relationships",dependencies:"Dependencies"};
const layers = ["Product architecture", "User journeys", "Data flows", "Feature relationships", "Dependencies", "Live changes"];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></>,
    branch: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 14h4a6 6 0 0 0 6-4"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
    file: <><path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h6"/></>,
    search: <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    folder: <path d="M3 6h7l2 3h9v12H3z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.branch}</svg>;
}

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [saved, setSaved] = useState<SavedProject[]>([]);
  const [storage, setStorage] = useState("connecting");
  const [ai,setAi] = useState({configured:false,model:"gpt-6.1-sol"});
  const [modal, setModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("");
  const [selected, setSelected] = useState<SourceFile | null>(null);
  const [sourcePage, setSourcePage] = useState(0);
  const [view, setView] = useState("map");
  const [mode, setMode] = useState("overview");
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const [limit, setLimit] = useState(60);
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef<AbortController | null>(null);

  async function refreshSaved() {
    const response = await fetch("/api/projects");
    if (response.ok) setSaved(await response.json());
  }
  useEffect(() => {
    let active = true;
    fetch("/api/health").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      if (active) { setStorage(data.storage); setAi({configured:!!data.ai_configured,model:data.ai_model || "gpt-6.1-sol"}); await refreshSaved(); }
    }).catch(error => { if (active) { setStorage("unavailable"); setError(error.message); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  useEffect(() => { setLimit(60); }, [search, folder]);

  function openProject(value: Project) {
    setProject(value); setSelected(null); setFolder(""); setSearch(""); setView("map"); setMode("architecture");
  }
  async function scan(sample = false) {
    if (!sample && !file) return;
    setModal(false); setError(""); setBusy(sample ? "Opening sample repository" : "Uploading repository");
    abort.current = new AbortController();
    try {
      const response = await fetch(sample ? "/api/sample" : "/api/scan", {
        method: "POST", signal: abort.current.signal,
        headers: sample ? {} : { "Content-Type": "application/zip", "x-project-name": encodeURIComponent(file!.name.replace(/\.zip$/i, "")) },
        body: sample ? undefined : file,
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.detail || "Scan failed."); }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let pending = "", complete = false;
      for (;;) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n"); pending = lines.pop() || "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.stage === "error") throw new Error(event.message);
          if (event.stage === "complete") { openProject(event.project); complete = true; }
          else setBusy(event.stage);
        }
        if (done) break;
      }
      if (!complete) throw new Error("The scan was interrupted. Please retry.");
      await refreshSaved();
    } catch (error) {
      if ((error as Error).name !== "AbortError") setError((error as Error).message);
    } finally { setBusy(""); abort.current = null; }
  }
  async function load(id: string) {
    setError(""); setBusy("Opening saved scan");
    try {
      const response = await fetch(`/api/projects/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      openProject(data);
    } catch (error) { setError((error as Error).message); } finally { setBusy(""); }
  }
  function chooseFile(value?: File) {
    if (!value) return;
    if (!value.name.toLowerCase().endsWith(".zip") || value.size > 3 * 1024 * 1024) {
      setError("Choose a repository ZIP smaller than 3 MiB."); return;
    }
    setError(""); setFile(value);
  }
  const groups = project ? Object.entries(project.files.reduce<Record<string, number>>((result, source) => {
    const directory = source.path.includes("/") ? source.path.split("/")[0] : "Root files";
    result[directory] = (result[directory] || 0) + 1; return result;
  }, {})).sort((a, b) => b[1] - a[1]) : [];
  const filtered = project?.files.filter(source => source.path.toLowerCase().includes(search.toLowerCase()) &&
    (!folder || (folder === "Root files" ? !source.path.includes("/") : source.path.startsWith(folder + "/")))) || [];
  function openSource(id:string,start:number,end:number) {
    const source = project?.files.find(file=>file.id === id);
    if(source){setSelected(source);setSourcePage(Math.floor((start-1)/200));setHighlight({start,end});}
  }
  const content = selected ? project?.contents[selected.id] || "" : "";
  const sourceLines = content ? content.replace(/\r?\n$/, "").split(/\r\n|\n|\r/) : [];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Architect home"><span className="brand-mark">A<span/></span>architect<span className="beta">MVP</span></a>
      <div className="workspace-label"><span className="avatar">W</span><div>Your workspace<small>Personal exploration</small></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <button className={`nav-item ${mode === "overview" ? "active" : ""}`} onClick={() => { setMode("overview"); setSelected(null); setFolder(""); }}><Icon name="grid"/>Overview<span className="nav-dot"/></button>
      <div className="nav-caption layer-caption">EXPLORE YOUR PRODUCT</div>
      {layers.map((layer,i) => <button key={layer} className={`nav-item ${i === 5 ? "future" : ""} ${mode === layerModes[i] ? "active" : ""}`} disabled={i === 5 || !project} title={i === 5 ? "Available in Phase 5" : "Explore this product perspective"} onClick={()=>{setMode(layerModes[i]);setSelected(null);}}><Icon name={i === 5 ? "clock" : "branch"}/>{layer}{i === 5 && <span className="soon">Soon</span>}</button>)}
      <div className="sidebar-bottom"><div className="status-line"><span className={`status-dot ${storage === "supabase" ? "connected" : ""}`}/>{storage === "supabase" ? "Supabase configured" : storage === "preview" ? "Temporary preview" : "Connecting services"}</div><p>{storage === "supabase" ? "Saved scans belong to this browser workspace." : "Scans disappear on reload. Connect Supabase to save them."}</p><div className="version">Phase 03 <span>Product meaning</span></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>{layerNames[mode]}</strong></div><span className="top-label"><span className="tiny-dot"/> Evidence starts with code</span><button className="button primary small" onClick={() => { setFile(null); setModal(true); }} disabled={!!busy}><Icon name="upload" size={15}/>Upload repository</button></header>
      <div className="main-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR SOFTWARE, IN PERSPECTIVE</div><h1>{project ? project.name : "See the bigger picture."}</h1><p>{project ? "Static relationships, linked to the code that supports them." : "Start with your code. Build a clearer understanding of how it fits together."}</p></div><span className="phase-tag">03 / PRODUCT MEANING</span></div>
        {error && <div className="notice error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close"/></button></div>}
        {project?.warning && <div className="notice" role="status">{project.warning}</div>}
        {busy && <div className="notice progress" role="status"><span className="spinner"/>{busy}<button onClick={() => { abort.current?.abort(); setBusy(""); }}>Stop waiting</button></div>}
        {!project ? <>
          <section className="welcome-card">
            <div className="canvas-top"><span><span className="tiny-dot"/> THE STARTING POINT</span><span>From source to understanding</span></div>
            <div className="welcome-flow"><div className="flow-node selected-node"><Icon name="upload"/><span>Your repository<small>A ZIP of your source files</small></span></div><div className="flow-edge"><Icon name="arrow"/></div><div className="flow-node"><Icon name="file"/><span>Source inventory<small>Files, languages & frameworks</small></span></div><div className="flow-edge"><Icon name="arrow"/></div><div className="flow-node"><Icon name="branch"/><span>Connected insights<small>Imports, routes & source evidence</small></span></div></div>
            <div className="welcome-copy"><h2>Every great map starts<br/>with a place to begin.</h2><p>Bring a small repository or explore our sample.<br/>We’ll scan the source without running its code.</p><div className="actions"><button className="button primary" onClick={() => { setFile(null); setModal(true); }} disabled={!!busy}>Upload your repository<Icon name="arrow" size={16}/></button><button className="button ghost" onClick={() => scan(true)} disabled={!!busy}>Explore sample <span>↗</span></button></div><div className="fine-print">ZIP up to 3 MiB · No GitHub connection required</div></div>
          </section>
          <div className="section-heading"><h2>One product. Six perspectives.</h2><span>CONNECTED PERSPECTIVES</span></div>
          <div className="perspective-grid">{[{title:"How it’s built",body:"Architecture & dependencies",number:"01 / 05"},{title:"How it works",body:"Journeys, data & features",number:"02 / 03 / 04"},{title:"How it evolves",body:"Changes & product history",number:"06"}].map(item => <div className="perspective" key={item.title}><span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p></div>)}</div>
        </> : <>
          <label className="mobile-view-switch">Explore <select value={mode} onChange={event => {setMode(event.target.value);setSelected(null);}} aria-label="Workspace view"><option value="architecture">Architecture</option><option value="journeys">User journeys</option><option value="data">Data flows</option><option value="features">Feature relationships</option><option value="dependencies">Dependencies</option><option value="overview">File inventory</option></select></label>
          <div className="stats">{[["SOURCE FILES",project.summary.file_count.toLocaleString()],["LINES OF SOURCE",project.summary.line_count.toLocaleString()],["LANGUAGES",Object.keys(project.summary.languages).length],["FRAMEWORKS",project.summary.frameworks.join(" · ") || "None detected"]].map(([label,value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          {["journeys","data","features"].includes(mode) ? <ProductViews key={project.id} context={project.ai_context || {snippets:[],total_files:project.files.length}} meaning={project.meaning} onMeaning={meaning=>setProject(value=>value?.id === project.id ? {...value,meaning} : value)} mode={mode} configured={ai.configured} model={ai.model} sample={!!project.sample} contents={project.contents} onSource={openSource}/> : mode !== "overview" && project.graph?.nodes ? <ArchitectureMap key={`${project.id}:${mode}`} graph={project.graph} contents={project.contents} mode={mode} onSource={openSource}/> : <section className="explorer"><div className="explorer-toolbar"><h2>Repository overview <span className="count">{project.summary.file_count}</span></h2><div className="view-switch" aria-label="Overview view"><button onClick={() => setView("map")} aria-pressed={view === "map"}>Folders</button><button onClick={() => setView("list")} aria-pressed={view === "list"}>File list</button></div></div>
            {view === "map" && <div className="inventory-map"><div className="map-label">DIRECTORY CONTAINMENT <span>Connections show folders, not runtime dependencies.</span></div><button className={`repo-node ${!folder ? "selected-node" : ""}`} onClick={() => setFolder("")}><Icon name="folder"/><strong>{project.name.replace(" · sample", "")}</strong><small>{project.summary.file_count} files</small></button><div className="tree-trunk"/><div className="folder-nodes">{groups.slice(0, 12).map(([name,count]) => <button key={name} className={`folder-node ${folder === name ? "selected-node" : ""}`} onClick={() => setFolder(folder === name ? "" : name)}><Icon name="folder"/><span>{name}</span><small>{count} files</small></button>)}</div>{groups.length > 12 && <small className="map-overflow">Showing the 12 largest groups. Use the file list to explore all {groups.length} groups.</small>}</div>}
            <div className="file-area"><div className="file-toolbar"><label className="search"><Icon name="search" size={16}/><input placeholder="Find a file…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Find a source file"/></label><span>{filtered.length} files {folder && <button className="filter-chip" onClick={() => setFolder("")}>{folder} ×</button>}</span></div><div className="file-table"><div className="file-row table-heading"><span>FILE / PATH</span><span>LANGUAGE</span><span>LINES</span><span/></div>{filtered.slice(0, limit).map(source => <button className={`file-row ${selected?.id === source.id ? "chosen" : ""}`} key={source.id} onClick={() => { setSelected(source); setSourcePage(0); setHighlight(null); }}><span><Icon name="file" size={16}/>{source.path}</span><span>{source.language}</span><span>{source.lines}</span><Icon name="arrow" size={16}/></button>)}{!filtered.length && <p className="empty-list">No files match this search.</p>}{filtered.length > limit && <button className="button ghost load-more" onClick={() => setLimit(limit + 60)}>Show more files</button>}</div></div>
          </section>}
          <div className="analysis-notes"><div><span className="tiny-dot"/>{project.persisted ? "Saved to Supabase" : "Temporary preview · disappears on reload"}</div><div>{project.summary.skipped_count} excluded entries · {Object.keys(project.summary.skip_reasons).join(", ") || "No scan exclusions"}</div><p>{project.summary.coverage} Known secret patterns are masked in source previews; detection is best effort.</p></div>
        </>}
        {saved.length > 0 && <section className="saved-projects"><div className="section-heading"><h2>Saved scans</h2><span>THIS BROWSER WORKSPACE</span></div>{saved.map(item => <button key={item.id} className="saved-row" onClick={() => load(item.id)} disabled={!!busy}><Icon name="folder"/><span>{item.name}</span><small>{item.summary.file_count} files · {new Date(item.created_at).toLocaleDateString()}</small><Icon name="arrow"/></button>)}</section>}
        <footer>ARCHITECT<span>Understand what you’re building.</span><span>Hackathon MVP · Phase 3</span></footer>
      </div>
    </main>
    <dialog ref={dialog} onCancel={() => setModal(false)} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
      <div className="modal-header"><span className="eyebrow">A NEW PERSPECTIVE</span><button aria-label="Close upload" onClick={() => setModal(false)}><Icon name="close"/></button></div><h2>Bring your codebase.</h2><p>Upload a repository ZIP. We’ll discover its source files, languages, and frameworks.</p>
      <label className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]); }}><Icon name="upload" size={28}/><strong>{file ? file.name : "Choose a ZIP or drop it here"}</strong><span>{file ? `${(file.size / 1024).toFixed(0)} KiB · ready to scan` : "Up to 3 MiB compressed · 20 MiB expanded"}</span><input type="file" accept=".zip,application/zip" onChange={e => chooseFile(e.target.files?.[0])} aria-label="Choose repository ZIP"/></label>
      <div className="upload-disclosure"><strong>Before uploading</strong><p>Remove secrets and private credentials from the ZIP. The entire archive is sent to the analysis server. Known secret files are skipped during analysis, which cannot undo their upload.</p><p>{storage === "supabase" ? "Captured, masked source previews are saved in your configured Supabase project." : "Supabase is not connected: source previews stay in this page until reload. The server uses temporary files during scanning."} No OpenAI requests are made in this phase.</p></div>
      {error && <p role="alert" className="modal-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={() => setModal(false)}>Cancel</button><button className="button primary" disabled={!file || !!busy} onClick={() => scan()}>Upload & scan<Icon name="arrow" size={16}/></button></div>
    </dialog>
    {selected && <aside className="source-panel" aria-label="Source evidence"><div className="source-header"><div><span className="eyebrow">CAPTURED SOURCE</span><h2>{selected.path}</h2></div><button onClick={() => setSelected(null)} aria-label="Close source"><Icon name="close"/></button></div><div className="source-meta">{selected.language} · {selected.lines} lines · SHA256 {selected.hash.slice(0,12)}…<p>Read-only snapshot. Known secret patterns masked.</p></div><div className="code-scroll"><pre>{sourceLines.slice(sourcePage * 200, (sourcePage + 1) * 200).map((line,index) => <div className={`code-line ${highlight && sourcePage * 200 + index + 1 >= highlight.start && sourcePage * 200 + index + 1 <= highlight.end ? "evidence-line" : ""}`} key={index}><span>{sourcePage * 200 + index + 1}</span><code>{line || " "}</code></div>)}</pre></div><div className="source-pagination"><button disabled={!sourcePage} onClick={() => setSourcePage(sourcePage - 1)}>Previous</button><span>Lines {sourceLines.length ? sourcePage * 200 + 1 : 0}–{Math.min((sourcePage + 1) * 200,sourceLines.length)}</span><button disabled={(sourcePage + 1) * 200 >= sourceLines.length} onClick={() => setSourcePage(sourcePage + 1)}>Next</button></div></aside>}
  </div>;
}
