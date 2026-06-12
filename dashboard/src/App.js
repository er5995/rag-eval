import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Single accent color system — electric blue on deep black
const ACCENT = "#3b82f6";
const ACCENT_DIM = "#1d4ed8";

const CONFIG_STYLES = {
  "fixed_minilm":    { color:"#94a3b8", shape:"circle" },
  "fixed_mpnet":     { color:"#94a3b8", shape:"square" },
  "sliding_minilm":  { color:"#3b82f6", shape:"circle" },
  "sliding_mpnet":   { color:"#3b82f6", shape:"square" },
  "semantic_minilm": { color:"#e2e8f0", shape:"circle" },
  "semantic_mpnet":  { color:"#e2e8f0", shape:"square" }
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

const FM_COLORS = {
  "Wrong chunk retrieved":     "#ef4444",
  "Answer missing from chunk": "#ef4444",
  "Insufficient context":      "#f59e0b",
  "Partially answered":        "#f59e0b",
  "Outdated information":      "#3b82f6",
  "Related but incomplete":    "#f59e0b",
  "Adequate retrieval":        "#475569"
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

const QT_COLORS = {
  "Factual lookup": "#3b82f6",
  "Technical":      "#8b5cf6",
  "Multi-hop":      "#f59e0b",
  "Comparison":     "#10b981",
  "Ambiguous":      "#ef4444",
  "Risk analysis":  "#ec4899",
  "Date / status":  "#06b6d4",
  "Proper noun":    "#f97316"
};

const TABS = ["Overview","Method & Metrics","Recommendation","Results","Failure Analysis","Next Steps"];

// CSS injected once for responsive + global styles
const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #000; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .grid-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  @media (max-width: 768px) {
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr; }
    .grid-metrics { grid-template-columns: 1fr; }
    .rec-inner { grid-template-columns: 1fr !important; }
    .nav-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .nav-tabs button { font-size: 0.75rem !important; padding: 0 0.6rem !important; white-space: nowrap; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    h1 { font-size: 1.8rem !important; }
  }
`;

const InfoTip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-block", marginLeft:"5px", verticalAlign:"middle" }}>
      <span
        onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        onClick={()=>setShow(s=>!s)}
        style={{ cursor:"help", color:"#475569", fontSize:"0.7rem", border:"1px solid #1e293b", borderRadius:"50%", width:"14px", height:"14px", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>?</span>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)", background:"#0f172a", color:"#cbd5e1", borderRadius:"8px", padding:"10px 12px", fontSize:"0.75rem", lineHeight:1.6, width:"220px", zIndex:200, border:"1px solid #1e293b", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
          {text}
        </div>
      )}
    </span>
  );
};

const QueryTypeBadge = ({ type }) => {
  const c = QT_COLORS[type] || "#475569";
  return <span style={{ background:`${c}18`, color:c, borderRadius:"4px", padding:"2px 6px", fontSize:"0.7rem", fontWeight:600, whiteSpace:"nowrap", border:`1px solid ${c}30` }}>{type}</span>;
};

const Card = ({ children, style, className }) => (
  <div className={className} style={{ background:"#0a0a0a", borderRadius:"12px", padding:"1.25rem", border:"1px solid #1e293b", ...style }}>
    {children}
  </div>
);

const Divider = () => <div style={{ borderTop:"1px solid #0f172a", margin:"3rem 0" }}/>;

const Label = ({ text }) => (
  <span style={{ color:"#f1f5f9", fontWeight:600 }}>{text}: </span>
);

const ChartLabel = ({ title, subtitle, tip }) => (
  <div style={{ marginBottom:"1rem" }}>
    <div style={{ display:"flex", alignItems:"center" }}>
      <span style={{ fontSize:"0.85rem", fontWeight:600, color:"#f1f5f9" }}>{title}</span>
      {tip && <InfoTip text={tip}/>}
    </div>
    {subtitle && <p style={{ fontSize:"0.74rem", color:"#475569", margin:"0.2rem 0 0", lineHeight:1.5 }}>{subtitle}</p>}
  </div>
);

const SectionBlock = ({ id, title, subtitle, children, sectionRefs }) => (
  <div id={id} ref={el=>{ if(sectionRefs) sectionRefs.current[id]=el; }} style={{ marginBottom:"4rem", scrollMarginTop:"60px" }}>
    {title && (
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ fontSize:"1.1rem", fontWeight:700, color:"#f1f5f9", margin:"0 0 0.3rem", letterSpacing:"0.02em", textTransform:"uppercase" }}>{title}</h2>
        <div style={{ width:"2rem", height:"2px", background:ACCENT, borderRadius:"1px" }}/>
        {subtitle && <p style={{ fontSize:"0.82rem", color:"#475569", margin:"0.75rem 0 0", lineHeight:1.6 }}>{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);

const tooltipStyle = { background:"#0f172a", border:"1px solid #1e293b", borderRadius:"8px", fontSize:"0.8rem", color:"#f1f5f9" };

export default function App() {
  const [summary,  setSummary]  = useState([]);
  const [details,  setDetails]  = useState([]);
  const [selected, setSelected] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [qtFilter, setQtFilter] = useState("all");
  const [fmFilter, setFmFilter] = useState("all");
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

  const barData = sorted.map(s=>({
    name:      s.label,
    Composite: +(s.avg_composite   *100).toFixed(1),
    Latency:   +s.avg_latency_ms.toFixed(2),
    color:     CONFIG_STYLES[s.key]?.color || "#3b82f6"
  }));

  const queryTypes = ["all",...Array.from(new Set(Object.values(QUERY_TYPES)))];

  const filtered = details
    .filter(d=>selected==="all"||`${d.strategy}_${d.model}`===selected)
    .filter(d=>qtFilter==="all"||QUERY_TYPES[d.query]===qtFilter)
    .filter(d=>fmFilter==="all"||getFailureMode(d)===fmFilter);

  const typePerf={};
  Object.values(QUERY_TYPES).forEach(t=>{typePerf[t]={scores:[],count:0};});
  details.forEach(d=>{ const t=QUERY_TYPES[d.query]; if(t){typePerf[t].scores.push(d.composite_score);typePerf[t].count++;} });
  const typeBreakdown = Object.entries(typePerf)
    .filter(([,v])=>v.scores.length>0)
    .map(([type,v])=>({ type, avg:+(v.scores.reduce((a,b)=>a+b,0)/v.scores.length*100).toFixed(1) }))
    .sort((a,b)=>b.avg-a.avg);

  const tradeoffData = sorted.map(s=>({
    name:      s.label,
    Composite: +(s.avg_composite*100).toFixed(1),
    Latency:   +s.avg_latency_ms.toFixed(1),
    color:     CONFIG_STYLES[s.key]?.color || "#3b82f6"
  }));

  const scrollTo = (id) => {
    setActiveTab(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior:"smooth" });
  };

  const selectStyle = {
    background:"#0a0a0a", color:"#cbd5e1", border:"1px solid #1e293b",
    borderRadius:"6px", padding:"0.35rem 0.65rem", fontSize:"0.8rem",
    fontFamily:"inherit", cursor:"pointer"
  };

  const findings = winner && fastest ? [
    { title:"Best overall configuration",
      body:`In this prototype, ${winner.label} achieved the highest composite score (${(winner.avg_composite*100).toFixed(1)}/100). The smaller MiniLM model matched or exceeded MPNet on this corpus. Model size does not automatically improve retrieval on small domain-specific corpora.` },
    { title:"Latency spreads wider than quality",
      body:`Composite scores range from ${(sorted[sorted.length-1]?.avg_composite*100).toFixed(1)} to ${(winner.avg_composite*100).toFixed(1)}, a narrow band. Latency ranges from ${fastest?.avg_latency_ms.toFixed(1)}ms to ${slowest?.avg_latency_ms.toFixed(1)}ms, a ${(slowest?.avg_latency_ms/fastest?.avg_latency_ms).toFixed(1)}x spread. Fixed chunking is the slowest with no quality benefit.` },
    { title:"Query complexity exposed real differences",
      body:`Simple factual queries showed small differences between configurations. Multi-hop and comparison queries widened the gap significantly. Benchmark against your actual query distribution before selecting a production configuration.` },
    { title:"Low grounding reveals a different problem",
      body:`Low relevance points to retrieval failure. Low grounding with acceptable relevance suggests the chunk may be related but insufficient to support the answer. They are different failure modes requiring different fixes.` }
  ] : [];

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif", background:"#000", minHeight:"100vh", color:"#cbd5e1" }}>

      {/* Nav */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"#00000095", backdropFilter:"blur(16px)", borderBottom:"1px solid #0f172a" }}>
        <div style={{ maxWidth:"1080px", margin:"0 auto", padding:"0 1.5rem", display:"flex", alignItems:"center", height:"50px" }}>
          <span style={{ fontSize:"0.9rem", marginRight:"1rem", cursor:"pointer", flexShrink:0 }} onClick={()=>scrollTo("Overview")}>🚀</span>
          <div className="nav-tabs" style={{ display:"flex", alignItems:"center", height:"100%", flex:1 }}>
            {TABS.map(tab=>(
              <button key={tab} onClick={()=>scrollTo(tab)} style={{
                background:"none", border:"none",
                color: activeTab===tab ? "#f1f5f9" : "#475569",
                fontSize:"0.8rem", fontWeight: activeTab===tab ? 600 : 400,
                cursor:"pointer", padding:"0 0.8rem", height:"100%",
                borderBottom: activeTab===tab ? `2px solid ${ACCENT}` : "2px solid transparent",
                fontFamily:"inherit", transition:"color 0.15s", whiteSpace:"nowrap"
              }}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"1080px", margin:"0 auto", padding:"3rem 1.5rem 5rem" }}>

        {/* Overview */}
        <SectionBlock id="Overview" sectionRefs={sectionRefs}>
          <div style={{ marginBottom:"3rem" }}>
            <p style={{ fontSize:"0.72rem", fontWeight:500, color:"#3b82f6", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"1rem" }}>
              RAG Evaluation Framework · 2026
            </p>
            <h1 style={{ fontSize:"2.4rem", fontWeight:700, color:"#f1f5f9", margin:"0 0 1.25rem", letterSpacing:"-0.03em", lineHeight:1.15 }}>
              Artemis RAG<br/>Evaluation Framework
            </h1>
            <p style={{ fontSize:"1rem", color:"#64748b", lineHeight:1.8, margin:"0 0 1rem", maxWidth:"640px" }}>
              A lightweight framework to compare retrieval configurations, identify tradeoffs, inspect failure modes, and choose a practical starting point before scaling a knowledge assistant.
            </p>
            <p style={{ fontSize:"0.85rem", color:"#475569", lineHeight:1.75, margin:"0 0 0.5rem", maxWidth:"640px" }}>
              <Label text="Purpose" />As a Technical Program Manager, evaluation is not optional. It is essential to have a repeatable framework to measure, visualize, and understand failures for decision making. This project builds that framework for RAG retrieval.
            </p>
            <p style={{ fontSize:"0.85rem", color:"#475569", lineHeight:1.75, margin:"0 0 2rem", maxWidth:"640px" }}>
              <Label text="Outcome" />In this prototype, sliding window chunking with MiniLM produced the strongest composite results. Fixed chunking is consistently the weakest, up to 5x slower with no retrieval-quality advantage. Query complexity exposed differences that simple factual queries did not.
            </p>
            <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"2rem" }}>
              {["9 Artemis articles","3 chunking strategies","2 embedding models","15 queries · 8 types","90 evaluations"].map(t=>(
                <span key={t} style={{ background:"#0a0a0a", border:"1px solid #1e293b", color:"#64748b", borderRadius:"20px", padding:"4px 12px", fontSize:"0.74rem" }}>{t}</span>
              ))}
            </div>
            <div style={{ background:"#0a0a0a", border:"1px solid #1e293b", borderLeft:`3px solid #f59e0b`, borderRadius:"8px", padding:"1rem 1.25rem", display:"flex", gap:"0.75rem", maxWidth:"640px" }}>
              <span style={{ fontSize:"0.9rem", marginTop:"1px", flexShrink:0 }}>⚠️</span>
              <div>
                <div style={{ fontSize:"0.8rem", fontWeight:600, color:"#fbbf24", marginBottom:"0.2rem" }}>Directional findings — prototype evaluation framework</div>
                <div style={{ fontSize:"0.77rem", color:"#475569", lineHeight:1.65 }}>
                  9 articles and 15 queries is a small sample by production standards. Results are directional, not definitive. At scale, rankings may shift. Latency figures reflect <strong style={{ color:"#94a3b8" }}>retrieval only</strong>, not end-to-end answer generation.
                </div>
              </div>
            </div>
          </div>
        </SectionBlock>

        <Divider/>

        {/* Method & Metrics */}
        <SectionBlock id="Method & Metrics" title="Method & Metrics" subtitle="How the evaluation was designed and how scores are calculated." sectionRefs={sectionRefs}>
          <p style={{ fontSize:"0.85rem", color:"#475569", lineHeight:1.8, marginBottom:"1.5rem", maxWidth:"680px" }}>
            <Label text="Method" />Compared fixed, sliding window, and semantic chunking using MiniLM and MPNet embeddings across 15 Artemis-related queries spanning 8 query types: factual lookup, technical, multi-hop, comparison, ambiguous, risk analysis, date/status, and proper noun. Each configuration was evaluated across 90 total query runs.
          </p>
          <div className="grid-metrics">
            {[
              { name:"Relevance", color:"#3b82f6",
                formula:"Cosine similarity between the query embedding and the retrieved chunk embedding.",
                note:null,
                diagnoses:"Low relevance points to retrieval failure. The wrong chunk came back for this query." },
              { name:"Grounding", color:"#10b981",
                formula:"Keyword overlap between query terms and retrieved chunk, excluding stop words.",
                note:"This is a proxy, not proof of correctness. A more rigorous approach uses an LLM judge or human-labeled ground truth.",
                diagnoses:"Low grounding with acceptable relevance suggests the chunk may be related but insufficient to support the answer." },
              { name:"Composite", color:"#f59e0b",
                formula:"50% relevance + 30% grounding + 20% coverage.",
                note:"Coverage rewards chunks substantial enough to answer the query.",
                diagnoses:"One number summarizing overall retrieval quality per query. For relative comparison only." }
            ].map(m=>(
              <Card key={m.name} style={{ borderTop:`2px solid ${m.color}`, borderRadius:"8px" }}>
                <div style={{ fontSize:"0.7rem", color:m.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.6rem" }}>{m.name}</div>
                <div style={{ fontSize:"0.78rem", color:"#64748b", lineHeight:1.65, marginBottom:"0.5rem" }}>{m.formula}</div>
                {m.note && <div style={{ fontSize:"0.74rem", color:"#334155", fontStyle:"italic", marginBottom:"0.5rem", lineHeight:1.5 }}>{m.note}</div>}
                <div style={{ fontSize:"0.74rem", color:"#334155", lineHeight:1.6, borderTop:"1px solid #0f172a", paddingTop:"0.5rem" }}>{m.diagnoses}</div>
              </Card>
            ))}
          </div>
          <p style={{ fontSize:"0.74rem", color:"#334155", marginTop:"0.75rem" }}>
            All scores normalized to 0–100 in charts. Raw scores in the table are 0–1. All scores are relative, not absolute production-readiness measures.
          </p>
        </SectionBlock>

        <Divider/>

        {/* Recommendation */}
        <SectionBlock id="Recommendation" title="Recommended Configuration" subtitle="Based on composite score, retrieval latency, and grounding across all 15 queries." sectionRefs={sectionRefs}>
          {winner && (
            <>
              <div style={{ background:"#0a0a0a", border:`1px solid ${ACCENT}30`, borderLeft:`3px solid ${ACCENT}`, borderRadius:"10px", padding:"1.75rem", marginBottom:"1rem" }}>
                <div className="rec-inner" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"1.5rem", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:"0.7rem", color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.5rem" }}>Starting point before production scaling</div>
                    <div style={{ fontSize:"1.6rem", fontWeight:700, color:ACCENT, letterSpacing:"-0.02em", marginBottom:"0.75rem" }}>{winner.label}</div>
                    <div style={{ fontSize:"0.83rem", color:"#64748b", lineHeight:1.75, maxWidth:"500px" }}>
                      Sliding window chunking preserves context across paragraph boundaries, improving retrieval on complex queries. MiniLM matched or exceeded MPNet on this corpus. Larger models do not automatically outperform on domain-specific content at small scale. Recommended before adding reranking, metadata filtering, or hybrid retrieval.
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem", minWidth:"140px" }}>
                    {[
                      { label:"Composite",        value:`${(winner.avg_composite*100).toFixed(1)}/100`, color:ACCENT },
                      { label:"Grounding",         value:`${(winner.avg_faithfulness*100).toFixed(0)}%`, color:"#10b981" },
                      { label:"Retrieval latency", value:`${winner.avg_latency_ms.toFixed(1)}ms`,        color:"#f59e0b" }
                    ].map(m=>(
                      <div key={m.label} style={{ background:"#000", borderRadius:"8px", padding:"0.6rem 0.9rem", border:"1px solid #0f172a" }}>
                        <div style={{ fontSize:"0.65rem", color:"#334155", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.2rem" }}>{m.label}</div>
                        <div style={{ fontSize:"1.2rem", fontWeight:700, color:m.color, letterSpacing:"-0.02em" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ fontSize:"0.75rem", color:"#334155", lineHeight:1.6 }}>
                <span style={{ color:"#64748b", fontWeight:600 }}>Note: </span>Scores are for relative comparison across configurations, not absolute production-readiness scores. A composite of {(winner.avg_composite*100).toFixed(1)}/100 means this configuration outperformed others in this evaluation, not that it is production-ready at this score.
              </p>
            </>
          )}
        </SectionBlock>

        <Divider/>

        {/* Results */}
        <SectionBlock id="Results" title="Results" sectionRefs={sectionRefs}>

          {/* Findings */}
          <div className="grid-2" style={{ marginBottom:"1.5rem" }}>
            {findings.map((f,i)=>(
              <Card key={i}>
                <div style={{ fontSize:"0.7rem", fontWeight:700, color:ACCENT, letterSpacing:"0.06em", marginBottom:"0.4rem" }}>0{i+1}</div>
                <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#e2e8f0", marginBottom:"0.35rem" }}>{f.title}</div>
                <div style={{ fontSize:"0.78rem", color:"#475569", lineHeight:1.65 }}>{f.body}</div>
              </Card>
            ))}
          </div>

          {/* Latency stats */}
          {fastest && slowest && (
            <div className="grid-3" style={{ marginBottom:"1.5rem" }}>
              {[
                { label:"Fastest retrieval", value:`${fastest.avg_latency_ms.toFixed(1)}ms`, sub:fastest.label, color:"#10b981" },
                { label:"Slowest retrieval", value:`${slowest.avg_latency_ms.toFixed(1)}ms`, sub:slowest.label, color:"#ef4444" },
                { label:"Latency spread",    value:`${(slowest.avg_latency_ms/fastest.avg_latency_ms).toFixed(1)}x`, sub:"slowest vs fastest", color:ACCENT }
              ].map(s=>(
                <div key={s.label} style={{ background:"#0a0a0a", border:"1px solid #1e293b", borderTop:`2px solid ${s.color}`, borderRadius:"10px", padding:"1.1rem" }}>
                  <div style={{ fontSize:"0.68rem", color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.4rem" }}>{s.label}</div>
                  <div style={{ fontSize:"2rem", fontWeight:700, color:s.color, letterSpacing:"-0.03em", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:"0.76rem", color:"#475569", marginTop:"0.4rem" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid-2" style={{ marginBottom:"1.5rem" }}>
            <Card>
              <ChartLabel title="Composite Score" subtitle="Higher is better. Scores are close — latency is the larger differentiator." tip="Composite = 50% relevance + 30% grounding + 20% coverage. Shown as 0–100. For relative comparison only."/>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a"/>
                  <XAxis type="number" domain={[0,60]} stroke="#1e293b" tick={{ fontSize:10, fill:"#334155" }}/>
                  <YAxis type="category" dataKey="name" stroke="#1e293b" tick={{ fontSize:9, fill:"#64748b" }} width={135}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Composite" radius={[0,4,4,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartLabel title="Retrieval Latency (ms)" subtitle="Retrieval only, not end-to-end generation. Fixed chunking is up to 5x slower with no quality benefit."/>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a"/>
                  <XAxis type="number" stroke="#1e293b" tick={{ fontSize:10, fill:"#334155" }}/>
                  <YAxis type="category" dataKey="name" stroke="#1e293b" tick={{ fontSize:9, fill:"#64748b" }} width={135}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Latency" radius={[0,4,4,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Tradeoff table */}
          <Card style={{ marginBottom:"1.5rem" }}>
            <ChartLabel title="Quality vs Latency — Configuration Tradeoff" subtitle="Ranked by composite score. The ideal configuration maximizes quality while minimizing latency."/>
            <div className="table-wrap">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #0f172a" }}>
                    {["Rank","Configuration","Composite","Latency","Assessment"].map(h=>(
                      <th key={h} style={{ padding:"0.55rem 0.75rem", textAlign:"left", color:"#334155", fontWeight:500, fontSize:"0.69rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradeoffData.map((d,i)=>{
                    const a  = i===0 ? "Best overall, high quality, low latency" : d.Latency>15 ? "Slow, no quality advantage" : d.Composite>38 ? "Good quality, moderate latency" : "Low quality, moderate latency";
                    const ac = i===0 ? "#10b981" : d.Latency>15 ? "#ef4444" : "#f59e0b";
                    return (
                      <tr key={d.name} style={{ borderBottom:"1px solid #0a0a0a" }}>
                        <td style={{ padding:"0.65rem 0.75rem", color:"#334155", fontWeight:700 }}>#{i+1}</td>
                        <td style={{ padding:"0.65rem 0.75rem" }}><span style={{ color:d.color, fontWeight:600 }}>{d.name}</span></td>
                        <td style={{ padding:"0.65rem 0.75rem", color:"#64748b", fontVariantNumeric:"tabular-nums" }}>{d.Composite}/100</td>
                        <td style={{ padding:"0.65rem 0.75rem", color:"#64748b", fontVariantNumeric:"tabular-nums" }}>{d.Latency}ms</td>
                        <td style={{ padding:"0.65rem 0.75rem" }}><span style={{ color:ac, fontSize:"0.77rem" }}>{a}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Query type chart */}
          <Card>
            <ChartLabel title="Performance by Query Type" subtitle="Average composite score across all configurations per query type. Directional, small sample per query type."/>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a"/>
                <XAxis type="number" domain={[0,60]} stroke="#1e293b" tick={{ fontSize:10, fill:"#334155" }}/>
                <YAxis type="category" dataKey="type" stroke="#1e293b" tick={{ fontSize:9, fill:"#64748b" }} width={105}/>
                <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}/100`,"Avg composite"]}/>
                <Bar dataKey="avg" fill={ACCENT} radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </SectionBlock>

        <Divider/>

        {/* Failure Analysis */}
        <SectionBlock id="Failure Analysis" title="Failure Analysis" subtitle="Click any row to inspect the retrieved chunk. Failure modes are assigned automatically based on score thresholds. Borderline cases may not match human judgment. This is a known limitation of proxy-based evaluation." sectionRefs={sectionRefs}>
          <Card style={{ padding:0 }}>
            <div style={{ padding:"0.85rem 1.25rem", borderBottom:"1px solid #0f172a", display:"flex", gap:"0.6rem", flexWrap:"wrap" }}>
              {[
                { value:selected, onChange:e=>{setSelected(e.target.value);setExpanded(null);}, options:[{v:"all",l:"All configurations"},...summary.map(s=>({v:s.key,l:s.label}))] },
                { value:qtFilter, onChange:e=>{setQtFilter(e.target.value);setExpanded(null);}, options:[{v:"all",l:"All query types"},...queryTypes.filter(t=>t!=="all").map(t=>({v:t,l:t}))] },
                { value:fmFilter, onChange:e=>{setFmFilter(e.target.value);setExpanded(null);}, options:[{v:"all",l:"All failure modes"},...FAILURE_MODES.map(f=>({v:f,l:f}))] }
              ].map((sel,i)=>(
                <select key={i} value={sel.value} onChange={sel.onChange} style={selectStyle}>
                  {sel.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ))}
            </div>
            <div className="table-wrap">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.79rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #0f172a" }}>
                    {["Configuration","Type","Query","Relevance","Grounding","Composite","Failure Mode"].map(h=>(
                      <th key={h} style={{ padding:"0.65rem 0.85rem", textAlign:"left", color:"#334155", fontWeight:500, fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const key    = `${r.strategy}_${r.model}`;
                    const isOpen = expanded===i;
                    const fm     = getFailureMode(r);
                    const cfg    = CONFIG_STYLES[key] || { color:"#64748b" };
                    return (
                      <>
                        <tr key={i} onClick={()=>setExpanded(isOpen?null:i)}
                          style={{ borderBottom:isOpen?"none":"1px solid #0a0a0a", cursor:"pointer", background:isOpen?"#0a0a0a":"transparent" }}>
                          <td style={{ padding:"0.75rem 0.85rem" }}><span style={{ fontSize:"0.77rem", fontWeight:600, color:cfg.color }}>{LABELS[key]}</span></td>
                          <td style={{ padding:"0.75rem 0.85rem" }}><QueryTypeBadge type={QUERY_TYPES[r.query]||"Other"}/></td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#94a3b8", maxWidth:"200px", lineHeight:1.5 }}>{r.query}</td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#475569", fontVariantNumeric:"tabular-nums" }}>{r.relevance_score}</td>
                          <td style={{ padding:"0.75rem 0.85rem", color:"#475569", fontVariantNumeric:"tabular-nums" }}>{r.faithfulness_score}</td>
                          <td style={{ padding:"0.75rem 0.85rem" }}>
                            <span style={{ background:`${cfg.color}15`, color:cfg.color, borderRadius:"4px", padding:"2px 7px", fontSize:"0.75rem", fontWeight:600 }}>{r.composite_score}</span>
                          </td>
                          <td style={{ padding:"0.75rem 0.85rem" }}>
                            <span style={{ color:FM_COLORS[fm]||"#475569", fontSize:"0.75rem" }}>{fm}</span>
                            <span style={{ marginLeft:"5px", fontSize:"0.64rem", color:"#1e293b" }}>{isOpen?"▲":"▼"}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${i}-exp`} style={{ borderBottom:"1px solid #0f172a" }}>
                            <td colSpan={7} style={{ padding:"0.75rem 1.1rem 1.1rem", background:"#0a0a0a" }}>
                              <div style={{ fontSize:"0.67rem", color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.4rem" }}>Retrieved chunk</div>
                              <div style={{ fontSize:"0.79rem", color:"#94a3b8", lineHeight:1.75, background:"#000", borderRadius:"8px", padding:"0.85rem 1rem", border:"1px solid #0f172a" }}>
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
          </Card>
        </SectionBlock>

        <Divider/>

        {/* Next Steps */}
        <SectionBlock id="Next Steps" title="Next Steps" subtitle="This is a prototype evaluation framework. Here is what a production-grade version would include." sectionRefs={sectionRefs}>
          <div className="grid-2">
            {[
              { n:"01", title:"Expand to 100+ documents",          body:"Current 9-article corpus limits generalizability. A larger corpus would stress-test chunking boundaries across more varied content and domains." },
              { n:"02", title:"Add 1,000+ evaluation queries",      body:"Add synthetic and human-curated queries to stress-test edge cases: temporal, multi-entity, negation, and out-of-scope queries across all types." },
              { n:"03", title:"Add human-labeled expected answers",  body:"Replace keyword-based grounding with human-labeled ground truth or an LLM judge to more rigorously separate retrieval quality from generation quality." },
              { n:"04", title:"Separate retrieval from generation",  body:"Add an LLM generation step to measure end-to-end answer quality. One approach: generate a golden evaluation set with an LLM, then have a human reviewer validate it. LLM-generated sets can miss edge cases, so incorporating real search results and user queries closes that gap further." },
              { n:"05", title:"Test reranking and hybrid retrieval", body:"Add a reranker as a fourth configuration. Test metadata filtering and hybrid retrieval. These often close the gap between chunking strategies in production." },
              { n:"06", title:"Track failure modes over time",       body:"Wrap the framework in a CI pipeline so retrieval quality is automatically measured on every corpus or configuration change. Failure mode tracking reveals regressions early." }
            ].map(s=>(
              <Card key={s.n}>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:ACCENT, letterSpacing:"0.05em", marginBottom:"0.4rem" }}>{s.n}</div>
                <div style={{ fontWeight:600, fontSize:"0.83rem", color:"#e2e8f0", marginBottom:"0.3rem" }}>{s.title}</div>
                <div style={{ fontSize:"0.77rem", color:"#475569", lineHeight:1.65 }}>{s.body}</div>
              </Card>
            ))}
          </div>
        </SectionBlock>

        <div style={{ textAlign:"center", color:"#1e293b", fontSize:"0.75rem", paddingTop:"1rem" }}>
          Built by Eman Rashdi · RAG Evaluation Framework · 2026 ·{" "}
          <a href="https://github.com/er5995/rag-eval" style={{ color:ACCENT, textDecoration:"none" }}>GitHub</a>
        </div>

      </div>
    </div>
  );
}