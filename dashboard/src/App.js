import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const C_RELEVANCE = "#3b82f6";
const C_GROUNDING = "#10b981";
const C_COMPOSITE = "#f59e0b";
const ACCENT      = "#8b5cf6";

const CONFIG_COLORS = {
  "fixed_minilm":    "#B23A72",
  "fixed_mpnet":     "#B23A72",
  "sliding_minilm":  "#8b5cf6",
  "sliding_mpnet":   "#8b5cf6",
  "semantic_minilm": "#06b6d4",
  "semantic_mpnet":  "#06b6d4"
};

const FM_COLORS = {
  "Wrong chunk retrieved":     "#ef4444",
  "Answer missing from chunk": "#f97316",
  "Insufficient context":      "#eab308",
  "Partially answered":        "#d946ef",
  "Outdated information":      "#38bdf8",
  "Related but incomplete":    "#fb7185",
  "Adequate retrieval":        "#10b981"
};

const FM_DESCRIPTIONS = {
  "Wrong chunk retrieved":     "Retrieval failed entirely. The returned chunk was unrelated to the query.",
  "Answer missing from chunk": "The right topic was retrieved but the specific answer was not in the chunk.",
  "Insufficient context":      "The chunk was relevant but too narrow to fully answer the question.",
  "Partially answered":        "Multi-part query where only one part of the question was addressed.",
  "Outdated information":      "Query required current or time-sensitive data not in the static corpus.",
  "Related but incomplete":    "Result matched a nearby topic or entity but missed the specific detail being asked.",
  "Adequate retrieval":        "The retrieved chunk contained enough context to support a good answer."
};

const LABELS = {
  "fixed_minilm":    "Fixed + MiniLM",
  "fixed_mpnet":     "Fixed + MPNet",
  "sliding_minilm":  "Sliding + MiniLM",
  "sliding_mpnet":   "Sliding + MPNet",
  "semantic_minilm": "Semantic + MiniLM",
  "semantic_mpnet":  "Semantic + MPNet"
};

const QUERY_TYPES = {
  "Who are the Artemis II crew members?": "Factual lookup",
  "How does the Orion spacecraft life support work?": "Technical",
  "What is the purpose of the Lunar Gateway?": "Factual lookup",
  "When is the Artemis II mission launching?": "Date / status",
  "What rocket does Artemis use?": "Factual lookup",
  "How do the Orion spacecraft and Space Launch System work together and what are the risks if one fails?": "Multi-hop",
  "Compare the roles of Reid Wiseman and Jeremy Hansen on the Artemis II mission": "Comparison",
  "Is Artemis II ready to launch?": "Ambiguous",
  "What could go wrong during the trans-lunar injection burn?": "Risk analysis",
  "How does the Orion crew module handle thermal protection during re-entry?": "Technical",
  "What propulsion systems does the Space Launch System use?": "Technical",
  "What are the key milestones between Artemis I and Artemis III?": "Multi-hop",
  "What happened after the Artemis I splashdown that led to Artemis II?": "Multi-hop",
  "What is Jeremy Hansen's background and why was he selected for Artemis II?": "Proper noun",
  "How does Jeremy Hansen's CSA training differ from NASA astronaut training?": "Comparison"
};

const getFailureMode = (r) => {
  if (r.relevance_score < 0.12)   return "Wrong chunk retrieved";
  if (r.faithfulness_score === 0) return "Answer missing from chunk";
  if (r.faithfulness_score < 0.2) return "Insufficient context";
  if (QUERY_TYPES[r.query] === "Multi-hop"    && r.composite_score < 0.38) return "Partially answered";
  if (QUERY_TYPES[r.query] === "Date / status")                             return "Outdated information";
  if (QUERY_TYPES[r.query] === "Proper noun"  && r.composite_score < 0.38) return "Related but incomplete";
  if (QUERY_TYPES[r.query] === "Comparison"   && r.composite_score < 0.38) return "Partially answered";
  return "Adequate retrieval";
};

const FAILURE_MODES = [
  "Wrong chunk retrieved",
  "Answer missing from chunk",
  "Insufficient context",
  "Partially answered",
  "Outdated information",
  "Related but incomplete",
  "Adequate retrieval"
];

const TABS = ["Overview","Method & Metrics","Recommendation","Results","Failure Analysis","Next Steps"];

const BAR_ORDER = [
  "sliding_minilm",
  "semantic_minilm",
  "fixed_minilm",
  "sliding_mpnet",
  "semantic_mpnet",
  "fixed_mpnet"
];

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0d0d; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .grid-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  @media (max-width: 768px) {
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr; }
    .grid-metrics { grid-template-columns: 1fr; }
    .rec-inner { grid-template-columns: 1fr !important; }
    .rec-stats { flex-direction: row !important; flex-wrap: wrap; gap: 0.5rem !important; }
    .nav-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .nav-tabs button { font-size: 0.72rem !important; padding: 0 0.5rem !important; white-space: nowrap; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    h1 { font-size: 2rem !important; line-height: 1.2 !important; }
  }
`;

const InfoTip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-block", marginLeft:"5px", verticalAlign:"middle" }}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onClick={()=>setShow(s=>!s)}
        style={{ cursor:"help", color:"#64748b", fontSize:"0.7rem", border:"1px solid #333", borderRadius:"50%", width:"14px", height:"14px", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>?</span>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)", background:"#1a1a1a", color:"#e2e8f0", borderRadius:"8px", padding:"10px 12px", fontSize:"0.75rem", lineHeight:1.6, width:"220px", zIndex:200, border:"1px solid #333", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
          {text}
        </div>
      )}
    </span>
  );
};

const FMLegendItem = ({ fm }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", cursor:"help", position:"relative" }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:FM_COLORS[fm], flexShrink:0 }}/>
      <span style={{ fontSize:"0.76rem", color:"#94a3b8" }}>{fm}</span>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:0, background:"#1a1a1a", color:"#e2e8f0", borderRadius:"8px", padding:"10px 12px", fontSize:"0.75rem", lineHeight:1.6, width:"250px", zIndex:200, border:"1px solid #333", boxShadow:"0 8px 32px rgba(0,0,0,0.6)", whiteSpace:"normal" }}>
          <span style={{ color:FM_COLORS[fm], fontWeight:600 }}>{fm}</span><br/>
          {FM_DESCRIPTIONS[fm]}
        </div>
      )}
    </div>
  );
};

const Card = ({ children, style, className }) => (
  <div className={className} style={{ background:"#111", borderRadius:"12px", padding:"1.25rem", border:"1px solid #222", ...style }}>
    {children}
  </div>
);

const Divider = () => <div style={{ borderTop:"1px solid #1a1a1a", margin:"4rem 0" }}/>;
const Label = ({ text }) => <span style={{ color:"#ffffff", fontWeight:700 }}>{text}: </span>;

const ChartLabel = ({ title, subtitle, tip }) => (
  <div style={{ marginBottom:"1rem" }}>
    <div style={{ display:"flex", alignItems:"center" }}>
      <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#ffffff" }}>{title}</span>
      {tip && <InfoTip text={tip}/>}
    </div>
    {subtitle && <p style={{ fontSize:"0.76rem", color:"#94a3b8", margin:"0.25rem 0 0", lineHeight:1.5 }}>{subtitle}</p>}
  </div>
);

const SectionBlock = ({ id, title, subtitle, children, sectionRefs }) => (
  <div id={id} ref={el=>{ if(sectionRefs) sectionRefs.current[id]=el; }} style={{ marginBottom:"5rem", scrollMarginTop:"60px" }}>
    {title && (
      <div style={{ marginBottom:"1.75rem" }}>
        <h2 style={{ fontSize:"1.1rem", fontWeight:700, color:"#ffffff", margin:"0 0 0.4rem", letterSpacing:"0.04em", textTransform:"uppercase" }}>{title}</h2>
        <div style={{ width:"2rem", height:"2px", background:ACCENT, borderRadius:"1px" }}/>
        {subtitle && <p style={{ fontSize:"0.84rem", color:"#94a3b8", margin:"0.75rem 0 0", lineHeight:1.65 }}>{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);

const tooltipStyle = { background:"#1a1a1a", border:"1px solid #333", borderRadius:"8px", fontSize:"0.8rem", color:"#ffffff" };
const PAGE_SIZE = 15;

export default function App() {
  const [summary,  setSummary]  = useState([]);
  const [details,  setDetails]  = useState([]);
  const [selected, setSelected] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [qtFilter, setQtFilter] = useState("all");
  const [fmFilter, setFmFilter] = useState("all");
  const [page,     setPage]     = useState(0);
  const [activeTab,setActiveTab]= useState("Overview");
  const sectionRefs = useRef({});

  useEffect(()=>{
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    fetch("/summary.json").then(r=>r.json()).then(data=>{
      setSummary(data.map(d=>({...d, key:`${d.strategy}_${d.model}`, label:LABELS[`${d.strategy}_${d.model}`]})));
    });
    fetch("/evaluated_results.json").then(r=>r.json()).then(setDetails);
  },[]);

  const sorted  = [...summary].sort((a,b)=>b.avg_composite-a.avg_composite);
  const winner  = sorted[0];
  const fastest = [...summary].sort((a,b)=>a.avg_latency_ms-b.avg_latency_ms)[0];
  const slowest = [...summary].sort((a,b)=>b.avg_latency_ms-a.avg_latency_ms)[0];

  // Bar charts use fixed display order (MiniLM first, then MPNet)
  const barData = BAR_ORDER
    .map(key=>summary.find(s=>s.key===key))
    .filter(Boolean)
    .map(s=>({
      name:      LABELS[s.key],
      Composite: +(s.avg_composite*100).toFixed(1),
      Latency:   +s.avg_latency_ms.toFixed(2),
      color:     CONFIG_COLORS[s.key]
    }));

  // Tradeoff table sorted by actual composite score descending
  const tradeoffData = [...summary]
    .sort((a,b)=>b.avg_composite-a.avg_composite)
    .map(s=>({
      name:      LABELS[s.key],
      Composite: +(s.avg_composite*100).toFixed(1),
      Latency:   +s.avg_latency_ms.toFixed(1),
      color:     CONFIG_COLORS[s.key],
      rank:      0
    }))
    .map((d,i)=>({...d, rank:i+1}));

  const queryTypes = ["all",...Array.from(new Set(Object.values(QUERY_TYPES)))];

  const filtered = details
    .filter(d=>selected==="all"||`${d.strategy}_${d.model}`===selected)
    .filter(d=>qtFilter==="all"||QUERY_TYPES[d.query]===qtFilter)
    .filter(d=>fmFilter==="all"||getFailureMode(d)===fmFilter);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  const typePerf={};
  Object.values(QUERY_TYPES).forEach(t=>{typePerf[t]={scores:[],count:0};});
  details.forEach(d=>{ const t=QUERY_TYPES[d.query]; if(t){typePerf[t].scores.push(d.composite_score);typePerf[t].count++;} });
  const typeBreakdown = Object.entries(typePerf)
    .filter(([,v])=>v.scores.length>0)
    .map(([type,v])=>({ type, avg:+(v.scores.reduce((a,b)=>a+b,0)/v.scores.length*100).toFixed(1) }))
    .sort((a,b)=>b.avg-a.avg);

  const scrollTo = (id) => {
    setActiveTab(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior:"smooth" });
  };

  const selectStyle = {
    background:"#1a1a1a", color:"#e2e8f0", border:"1px solid #333",
    borderRadius:"6px", padding:"0.35rem 0.65rem", fontSize:"0.8rem",
    fontFamily:"inherit", cursor:"pointer"
  };

  const cfgLegend = [
    { color:"#8b5cf6", label:"Sliding" },
    { color:"#06b6d4", label:"Semantic" },
    { color:"#B23A72", label:"Fixed" }
  ];

  // Latency spread — use raw values for accuracy
const latencySpread = fastest && slowest
  ? (Math.floor(slowest.avg_latency_ms / fastest.avg_latency_ms * 10) / 10).toFixed(1)
  : "5.2";

  const findings = winner && fastest ? [
    { title:"Best overall configuration",
      body:`In this prototype, ${winner.label} achieved the highest composite score (${(winner.avg_composite*100).toFixed(1)}/100). The smaller MiniLM model matched or exceeded MPNet on this corpus. Model size does not automatically improve retrieval on small domain-specific corpora.` },
    { title:"Latency spreads wider than quality",
      body:`Composite scores range from ${(sorted[sorted.length-1]?.avg_composite*100).toFixed(1)} to ${(winner.avg_composite*100).toFixed(1)}, a narrow band. Latency ranges from ${fastest.avg_latency_ms.toFixed(1)}ms to ${slowest.avg_latency_ms.toFixed(1)}ms, a ${latencySpread}x spread. Fixed chunking is the slowest with no retrieval-quality advantage.` },
    { title:"Query complexity exposed real differences",
      body:`Simple factual queries showed small differences between configurations. Multi-hop and comparison queries widened the gap significantly. Benchmark against your actual query distribution before selecting a production configuration.` },
    { title:"Low grounding reveals a different problem",
      body:`Low relevance points to retrieval failure. Low grounding with acceptable relevance suggests the chunk may be related but insufficient to support the answer. They are different failure modes requiring different fixes.` }
  ] : [];

  // Assessment labels — consistent, no overclaiming
  const getAssessment = (d, i) => {
    if (i === 0) return { label:"Best overall, high quality, low latency", color:C_GROUNDING };
    if (d.Latency > 15) return { label:"Slow, no retrieval-quality advantage", color:"#ef4444" };
    if (d.Composite >= 39) return { label:"Strong quality, low latency", color:C_GROUNDING };
    if (d.Composite >= 37) return { label:"Moderate quality, moderate latency", color:C_COMPOSITE };
    return { label:"Lower composite, higher latency", color:"#94a3b8" };
  };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif", background:"#0d0d0d", minHeight:"100vh", color:"#e2e8f0" }}>

      {/* Nav */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"#0d0d0d95", backdropFilter:"blur(16px)", borderBottom:"1px solid #1a1a1a" }}>
        <div style={{ maxWidth:"1080px", margin:"0 auto", padding:"0 1.5rem", display:"flex", alignItems:"center", height:"50px" }}>
          <span style={{ fontSize:"1.1rem", marginRight:"1rem", cursor:"pointer", flexShrink:0 }} onClick={()=>scrollTo("Overview")}>🚀</span>
          <div className="nav-tabs" style={{ display:"flex", alignItems:"center", height:"100%", flex:1 }}>
            {TABS.map(tab=>(
              <button key={tab} onClick={()=>scrollTo(tab)} style={{
                background:"none", border:"none",
                color: activeTab===tab ? "#ffffff" : "#64748b",
                fontSize:"0.8rem", fontWeight: activeTab===tab ? 600 : 400,
                cursor:"pointer", padding:"0 0.8rem", height:"100%",
                borderBottom: activeTab===tab ? `2px solid ${ACCENT}` : "2px solid transparent",
                fontFamily:"inherit", transition:"color 0.15s", whiteSpace:"nowrap"
              }}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"1080px", margin:"0 auto", padding:"4rem 1.5rem 6rem" }}>

        {/* Overview */}
        <SectionBlock id="Overview" sectionRefs={sectionRefs}>
          <p style={{ fontSize:"0.72rem", fontWeight:500, color:ACCENT, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"1.25rem" }}>
            RAG Evaluation Framework · 2026
          </p>
          <h1 style={{ fontSize:"3.2rem", fontWeight:700, color:"#ffffff", margin:"0 0 1.5rem", letterSpacing:"-0.04em", lineHeight:1.1 }}>
            🚀 Artemis RAG Evaluation Framework
          </h1>
          <p style={{ fontSize:"1.05rem", color:"#94a3b8", lineHeight:1.85, margin:"0 0 1.25rem" }}>
            A lightweight framework to compare retrieval configurations, identify tradeoffs, inspect failure modes, and choose a practical starting point before scaling a knowledge assistant.
          </p>
          <p style={{ fontSize:"0.9rem", color:"#94a3b8", lineHeight:1.8, margin:"0 0 0.75rem" }}>
            <Label text="Purpose" />RAG systems need repeatable evaluation before scaling. This project measures retrieval quality, latency, and failure modes so configuration decisions are based on evidence, not intuition.
          </p>
          <p style={{ fontSize:"0.9rem", color:"#94a3b8", lineHeight:1.8, margin:"0 0 2rem" }}>
            <Label text="Outcome" />In this prototype, sliding window chunking with MiniLM produced the strongest composite results. Fixed chunking is consistently the weakest, up to 5x slower with no retrieval-quality advantage. Query complexity exposed differences that simple factual queries did not.
          </p>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"2rem" }}>
            {["9 Artemis articles","3 chunking strategies","2 embedding models","15 queries · 8 types","90 evaluations"].map(t=>(
              <span key={t} style={{ background:"#111", border:"1px solid #222", color:"#94a3b8", borderRadius:"20px", padding:"4px 14px", fontSize:"0.76rem" }}>{t}</span>
            ))}
          </div>
          <div style={{ background:"#111", border:"1px solid #222", borderLeft:"3px solid #f59e0b", borderRadius:"10px", padding:"1rem 1.25rem", display:"flex", gap:"0.75rem" }}>
            <span style={{ fontSize:"0.9rem", marginTop:"1px", flexShrink:0 }}>⚠️</span>
            <div>
              <div style={{ fontSize:"0.8rem", fontWeight:600, color:"#fbbf24", marginBottom:"0.25rem" }}>Directional findings — prototype evaluation framework</div>
              <div style={{ fontSize:"0.79rem", color:"#94a3b8", lineHeight:1.7 }}>
                9 articles and 15 queries is a small sample by production standards. Results are directional, not definitive. At scale, rankings may shift. Latency figures reflect <strong style={{ color:"#ffffff" }}>retrieval only</strong>, not end-to-end answer generation.
              </div>
            </div>
          </div>
        </SectionBlock>

        <Divider/>

        {/* Method & Metrics */}
        <SectionBlock id="Method & Metrics" title="Method & Metrics" subtitle="How the evaluation was designed and how scores are calculated." sectionRefs={sectionRefs}>
          <p style={{ fontSize:"0.9rem", color:"#94a3b8", lineHeight:1.8, marginBottom:"1.75rem" }}>
            <Label text="Method" />Compared fixed, sliding window, and semantic chunking using MiniLM and MPNet embeddings across 15 Artemis-related queries spanning 8 query types: factual lookup, technical, multi-hop, comparison, ambiguous, risk analysis, date/status, and proper noun. Each configuration was evaluated across 90 total query runs.
          </p>
          <div className="grid-metrics">
            {[
              { name:"Relevance", color:C_RELEVANCE,
                formula:"Cosine similarity between the query embedding and the retrieved chunk embedding.",
                note:null,
                diagnoses:"Low relevance points to retrieval failure. The wrong chunk came back for this query." },
              { name:"Grounding", color:C_GROUNDING,
                formula:"Keyword overlap between query terms and retrieved chunk, excluding stop words.",
                note:"This is a proxy, not proof of correctness. A more rigorous approach uses an LLM judge or human-labeled ground truth.",
                diagnoses:"Low grounding with acceptable relevance suggests the chunk may be related but insufficient to support the answer." },
              { name:"Composite", color:C_COMPOSITE,
                formula:"50% relevance + 30% grounding + 20% coverage.",
                note:"Coverage rewards chunks substantial enough to answer the query.",
                diagnoses:"One number summarizing overall retrieval quality per query. For relative comparison only." }
            ].map(m=>(
              <Card key={m.name} style={{ borderTop:`2px solid ${m.color}` }}>
                <div style={{ fontSize:"0.7rem", color:m.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.6rem" }}>{m.name}</div>
                <div style={{ fontSize:"0.8rem", color:"#94a3b8", lineHeight:1.65, marginBottom:"0.5rem" }}>{m.formula}</div>
                {m.note && <div style={{ fontSize:"0.76rem", color:"#64748b", fontStyle:"italic", marginBottom:"0.5rem", lineHeight:1.5 }}>{m.note}</div>}
                <div style={{ fontSize:"0.76rem", color:"#64748b", lineHeight:1.6, borderTop:"1px solid #1a1a1a", paddingTop:"0.5rem" }}>{m.diagnoses}</div>
              </Card>
            ))}
          </div>
          <p style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.85rem" }}>
            All scores normalized to 0–100 in charts. Raw scores in the table are 0–1. All scores are relative, not absolute production-readiness measures.
          </p>
          <div style={{ marginTop:"2rem" }}>
            <div style={{ fontSize:"0.72rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.75rem" }}>Configuration color key</div>
            <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
              {cfgLegend.map(l=>(
                <div key={l.label} style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                  <div style={{ width:"12px", height:"12px", borderRadius:"3px", background:l.color, flexShrink:0 }}/>
                  <span style={{ fontSize:"0.8rem", color:"#94a3b8" }}>{l.label} chunking</span>
                </div>
              ))}
            </div>
          </div>
        </SectionBlock>

        <Divider/>

        {/* Recommendation */}
        <SectionBlock id="Recommendation" title="Recommended Configuration" subtitle="Based on composite score, retrieval latency, and grounding across all 15 queries." sectionRefs={sectionRefs}>
          {winner && (
            <>
              <div style={{ background:"#111", border:`1px solid ${CONFIG_COLORS[winner.key]}40`, borderLeft:`3px solid ${CONFIG_COLORS[winner.key]}`, borderRadius:"12px", padding:"2rem", marginBottom:"1rem" }}>
                <div className="rec-inner" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"1.5rem", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:"0.7rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.5rem" }}>Starting point before production scaling</div>
                    <div style={{ fontSize:"1.7rem", fontWeight:700, color:"#ffffff", letterSpacing:"-0.02em", marginBottom:"0.85rem" }}>{winner.label}</div>
                    <div style={{ fontSize:"0.88rem", color:"#94a3b8", lineHeight:1.8 }}>
                      Sliding window chunking preserves context across paragraph boundaries, improving retrieval on complex queries. MiniLM matched or exceeded MPNet on this corpus. Larger models do not automatically outperform on domain-specific content at small scale. Recommended before adding reranking, metadata filtering, or hybrid retrieval.
                    </div>
                  </div>
                  <div className="rec-stats" style={{ display:"flex", flexDirection:"column", gap:"0.65rem", minWidth:"145px" }}>
                    {[
                      { label:"Composite",        value:`${(winner.avg_composite*100).toFixed(1)}/100` },
                      { label:"Grounding",         value:`${(winner.avg_faithfulness*100).toFixed(0)}%` },
                      { label:"Retrieval latency", value:`${winner.avg_latency_ms.toFixed(1)}ms` }
                    ].map(m=>(
                      <div key={m.label} style={{ background:"#0d0d0d", borderRadius:"8px", padding:"0.65rem 1rem", border:"1px solid #1a1a1a" }}>
                        <div style={{ fontSize:"0.65rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.2rem" }}>{m.label}</div>
                        <div style={{ fontSize:"1.25rem", fontWeight:700, color:"#ffffff", letterSpacing:"-0.02em" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ fontSize:"0.78rem", color:"#64748b", lineHeight:1.6 }}>
                <span style={{ color:"#94a3b8", fontWeight:600 }}>Note: </span>Scores are for relative comparison across configurations, not absolute production-readiness scores. A composite of {(winner.avg_composite*100).toFixed(1)}/100 means this configuration outperformed others in this evaluation, not that it is production-ready at this score.
              </p>
            </>
          )}
        </SectionBlock>

        <Divider/>

        {/* Results */}
        <SectionBlock id="Results" title="Results" sectionRefs={sectionRefs}>
          <div className="grid-2" style={{ marginBottom:"1.75rem" }}>
            {findings.map((f,i)=>(
              <Card key={i}>
                <div style={{ fontSize:"0.7rem", fontWeight:700, color:ACCENT, letterSpacing:"0.06em", marginBottom:"0.4rem" }}>0{i+1}</div>
                <div style={{ fontWeight:600, fontSize:"0.88rem", color:"#ffffff", marginBottom:"0.4rem" }}>{f.title}</div>
                <div style={{ fontSize:"0.8rem", color:"#94a3b8", lineHeight:1.7 }}>{f.body}</div>
              </Card>
            ))}
          </div>

          {fastest && slowest && (
            <div className="grid-3" style={{ marginBottom:"1.75rem" }}>
              {[
                { label:"Fastest retrieval", value:`${fastest.avg_latency_ms.toFixed(1)}ms`, sub:fastest.label, color:C_GROUNDING },
                { label:"Slowest retrieval", value:`${slowest.avg_latency_ms.toFixed(1)}ms`, sub:slowest.label, color:"#ef4444" },
                { label:"Latency spread",    value:`${latencySpread}x`, sub:"slowest vs fastest", color:C_COMPOSITE }
              ].map(s=>(
                <div key={s.label} style={{ background:"#111", border:"1px solid #222", borderTop:`2px solid ${s.color}`, borderRadius:"12px", padding:"1.25rem" }}>
                  <div style={{ fontSize:"0.68rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.5rem" }}>{s.label}</div>
                  <div style={{ fontSize:"2.1rem", fontWeight:700, color:s.color, letterSpacing:"-0.03em", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:"0.5rem" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid-2" style={{ marginBottom:"1.75rem" }}>
            <Card>
              <ChartLabel
                title="Composite Score"
                subtitle="Higher is better. Scores are close — latency is the larger differentiator."
                tip="Composite = 50% relevance + 30% grounding + 20% coverage. Shown as 0–100. For relative comparison only."
              />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ right:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a"/>
                  <XAxis type="number" domain={[0,60]} stroke="#333" tick={{ fontSize:10, fill:"#ffffff" }}/>
                  <YAxis type="category" dataKey="name" stroke="#333" tick={{ fontSize:9, fill:"#94a3b8" }} width={135}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Composite" radius={[0,4,4,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartLabel
                title="Retrieval Latency (ms)"
                subtitle="Retrieval only, not end-to-end generation. Fixed chunking is up to 5x slower with no retrieval-quality advantage."
              />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ right:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a"/>
                  <XAxis type="number" stroke="#333" tick={{ fontSize:10, fill:"#ffffff" }}/>
                  <YAxis type="category" dataKey="name" stroke="#333" tick={{ fontSize:9, fill:"#94a3b8" }} width={135}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Latency" radius={[0,4,4,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card style={{ marginBottom:"1.75rem" }}>
            <ChartLabel
              title="Quality vs Latency — Configuration Tradeoff"
              subtitle="Ranked by composite score. The ideal configuration maximizes retrieval quality while minimizing latency."
            />
            <div className="table-wrap">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
                    {["Rank","Configuration","Composite","Latency","Assessment"].map(h=>(
                      <th key={h} style={{ padding:"0.55rem 0.75rem", textAlign:"left", color:"#64748b", fontWeight:500, fontSize:"0.7rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradeoffData.map((d,i)=>{
                    const { label:aLabel, color:aColor } = getAssessment(d, i);
                    return (
                      <tr key={d.name} style={{ borderBottom:"1px solid #111" }}>
                        <td style={{ padding:"0.7rem 0.75rem", color:"#64748b", fontWeight:700 }}>#{d.rank}</td>
                        <td style={{ padding:"0.7rem 0.75rem" }}><span style={{ color:d.color, fontWeight:600 }}>{d.name}</span></td>
                        <td style={{ padding:"0.7rem 0.75rem", color:"#ffffff", fontVariantNumeric:"tabular-nums" }}>{d.Composite}/100</td>
                        <td style={{ padding:"0.7rem 0.75rem", color:"#ffffff", fontVariantNumeric:"tabular-nums" }}>{d.Latency}ms</td>
                        <td style={{ padding:"0.7rem 0.75rem" }}><span style={{ color:aColor, fontSize:"0.79rem" }}>{aLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <ChartLabel
              title="Performance by Query Type"
              subtitle="Average composite score across all configurations per query type. Directional, small sample per query type."
            />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeBreakdown} layout="vertical" margin={{ right:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a"/>
                <XAxis type="number" domain={[0,60]} stroke="#333" tick={{ fontSize:10, fill:"#ffffff" }}/>
                <YAxis type="category" dataKey="type" stroke="#333" tick={{ fontSize:9, fill:"#ffffff" }} width={110}/>
                <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}/100`,"Avg composite"]}/>
                <Bar dataKey="avg" fill={C_RELEVANCE} radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </SectionBlock>

        <Divider/>

        {/* Failure Analysis */}
        <SectionBlock id="Failure Analysis" title="Failure Analysis" subtitle="Click any row to inspect the retrieved chunk. Failure modes are assigned automatically based on score thresholds. Borderline cases may not match human judgment. This is a known limitation of proxy-based evaluation." sectionRefs={sectionRefs}>
          <div style={{ marginBottom:"1.25rem" }}>
            <div style={{ fontSize:"0.72rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.6rem" }}>Failure mode legend — hover for details</div>
            <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
              {FAILURE_MODES.map(fm=><FMLegendItem key={fm} fm={fm}/>)}
            </div>
          </div>

          <Card style={{ padding:0 }}>
            <div style={{ padding:"0.85rem 1.25rem", borderBottom:"1px solid #1a1a1a", display:"flex", gap:"0.6rem", flexWrap:"wrap", alignItems:"center" }}>
              {[
                { value:selected, onChange:e=>{setSelected(e.target.value);setPage(0);setExpanded(null);}, options:[{v:"all",l:"All configurations"},...summary.map(s=>({v:s.key,l:s.label}))] },
                { value:qtFilter, onChange:e=>{setQtFilter(e.target.value);setPage(0);setExpanded(null);}, options:[{v:"all",l:"All query types"},...queryTypes.filter(t=>t!=="all").map(t=>({v:t,l:t}))] },
                { value:fmFilter, onChange:e=>{setFmFilter(e.target.value);setPage(0);setExpanded(null);}, options:[{v:"all",l:"All failure modes"},...FAILURE_MODES.map(f=>({v:f,l:f}))] }
              ].map((sel,i)=>(
                <select key={i} value={sel.value} onChange={sel.onChange} style={selectStyle}>
                  {sel.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ))}
              <button onClick={()=>{setSelected("all");setQtFilter("all");setFmFilter("all");setPage(0);setExpanded(null);}}
                style={{ ...selectStyle, color:"#64748b", marginLeft:"auto" }}>Reset</button>
            </div>
            <div className="table-wrap">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
                    {["Configuration","Type","Query","Relevance","Grounding","Composite","Failure Mode"].map(h=>(
                      <th key={h} style={{ padding:"0.65rem 0.85rem", textAlign:"left", color:"#64748b", fontWeight:500, fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r,i)=>{
                    const key     = `${r.strategy}_${r.model}`;
                    const globalI = page * PAGE_SIZE + i;
                    const isOpen  = expanded===globalI;
                    const fm      = getFailureMode(r);
                    const cfgColor = CONFIG_COLORS[key] || "#64748b";
                    return (
                      <>
                        <tr key={globalI} onClick={()=>setExpanded(isOpen?null:globalI)}
                          style={{ borderBottom:isOpen?"none":"1px solid #111", cursor:"pointer", background:isOpen?"#111":"transparent" }}>
                          <td style={{ padding:"0.75rem 0.85rem" }}>
                            <span style={{ fontSize:"0.78rem", fontWeight:600, color:cfgColor }}>{LABELS[key]}</span>
                          </td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#ffffff", fontSize:"0.77rem" }}>
                            {QUERY_TYPES[r.query]||"Other"}
                          </td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#94a3b8", maxWidth:"200px", lineHeight:1.5 }}>{r.query}</td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#ffffff", fontVariantNumeric:"tabular-nums" }}>{r.relevance_score}</td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#ffffff", fontVariantNumeric:"tabular-nums" }}>{r.faithfulness_score}</td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#ffffff", fontVariantNumeric:"tabular-nums", fontWeight:600 }}>{r.composite_score}</td>
                          <td style={{ padding:"0.75rem 0.85rem" }}>
                            <span style={{ color:FM_COLORS[fm]||"#64748b", fontSize:"0.76rem" }}>{fm}</span>
                            <span style={{ marginLeft:"6px", fontSize:"0.7rem", color:"#ffffff", fontWeight:700 }}>{isOpen?"▲":"▼"}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${globalI}-exp`} style={{ borderBottom:"1px solid #1a1a1a" }}>
                            <td colSpan={7} style={{ padding:"0.75rem 1.1rem 1.1rem", background:"#111" }}>
                              <div style={{ fontSize:"0.67rem", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.4rem" }}>Retrieved chunk</div>
                              <div style={{ fontSize:"0.8rem", color:"#94a3b8", lineHeight:1.8, background:"#0d0d0d", borderRadius:"8px", padding:"0.9rem 1rem", border:"1px solid #1a1a1a" }}>
                                {r.top_chunk}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ padding:"0.85rem 1.25rem", borderTop:"1px solid #1a1a1a", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:"0.78rem", color:"#64748b" }}>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, filtered.length)} of {filtered.length} results
                </span>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <button onClick={()=>{ setPage(p=>p-1); setExpanded(null); }} disabled={page===0}
                    style={{ ...selectStyle, opacity:page===0?0.3:1, cursor:page===0?"not-allowed":"pointer" }}>Previous</button>
                  <button onClick={()=>{ setPage(p=>p+1); setExpanded(null); }} disabled={page>=totalPages-1}
                    style={{ ...selectStyle, opacity:page>=totalPages-1?0.3:1, cursor:page>=totalPages-1?"not-allowed":"pointer" }}>Next</button>
                </div>
              </div>
            )}
          </Card>
        </SectionBlock>

        <Divider/>

        {/* Next Steps */}
        <SectionBlock id="Next Steps" title="Next Steps" subtitle="This is a prototype evaluation framework. Here is what a production-grade version would include." sectionRefs={sectionRefs}>
          <div className="grid-2">
            {[
              { n:"01", title:"Expand to 100+ documents",
                body:"Current 9-article corpus limits generalizability. A larger corpus would stress-test chunking boundaries across more varied content and domains." },
              { n:"02", title:"Add 1,000+ evaluation queries",
                body:"Add synthetic and human-curated queries to stress-test edge cases: temporal, multi-entity, negation, and out-of-scope queries across all types." },
              { n:"03", title:"Build a human-reviewed golden evaluation set",
                body:"Create a human-reviewed golden evaluation set, then use an LLM judge to scale evaluation of answer correctness and groundedness. Human review anchors quality; the LLM scales it." },
              { n:"04", title:"Separate retrieval from generation",
                body:"Add an LLM generation step to measure end-to-end answer quality. Current metrics evaluate retrieval only. Grounding is a proxy, not a full answer-quality signal." },
              { n:"05", title:"Test reranking and hybrid retrieval",
                body:"Add a reranker as a fourth configuration. Test metadata filtering and hybrid retrieval. These often close the gap between chunking strategies in production." },
              { n:"06", title:"Track failure modes over time",
                body:"Wrap the framework in a CI pipeline so retrieval quality is automatically measured on every corpus or configuration change. Failure mode tracking reveals regressions early." }
            ].map(s=>(
              <Card key={s.n}>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:ACCENT, letterSpacing:"0.05em", marginBottom:"0.4rem" }}>{s.n}</div>
                <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#ffffff", marginBottom:"0.35rem" }}>{s.title}</div>
                <div style={{ fontSize:"0.79rem", color:"#94a3b8", lineHeight:1.7 }}>{s.body}</div>
              </Card>
            ))}
          </div>
        </SectionBlock>

        <div style={{ textAlign:"center", color:"#333", fontSize:"0.76rem", paddingTop:"1rem" }}>
          Built by Eman Rashdi · RAG Evaluation Framework · 2026 ·{" "}
          <a href="https://github.com/er5995/rag-eval" style={{ color:ACCENT, textDecoration:"none" }}>GitHub</a>
        </div>

      </div>
    </div>
  );
}