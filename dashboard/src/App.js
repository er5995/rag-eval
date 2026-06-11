import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = {
  "fixed_minilm":    "#6366f1",
  "fixed_mpnet":     "#8b5cf6",
  "sliding_minilm":  "#10b981",
  "sliding_mpnet":   "#0ea5e9",
  "semantic_minilm": "#f59e0b",
  "semantic_mpnet":  "#f87171"
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
  if (r.relevance_score < 0.15)   return "Wrong chunk retrieved";
  if (r.faithfulness_score === 0) return "Answer missing from chunk";
  if (r.faithfulness_score < 0.2) return "Insufficient context";
  if (QUERY_TYPES[r.query] === "Multi-hop"    && r.composite_score < 0.38) return "Partially answered";
  if (QUERY_TYPES[r.query] === "Date / status")                             return "Outdated information";
  if (QUERY_TYPES[r.query] === "Proper noun"  && r.composite_score < 0.38) return "Related but incomplete";
  if (QUERY_TYPES[r.query] === "Comparison"   && r.composite_score < 0.38) return "Partially answered";
  return "Adequate retrieval";
};

const FM_COLORS = {
  "Wrong chunk retrieved":     "#f87171",
  "Answer missing from chunk": "#f87171",
  "Insufficient context":      "#f59e0b",
  "Partially answered":        "#f59e0b",
  "Outdated information":      "#38bdf8",
  "Related but incomplete":    "#f59e0b",
  "Adequate retrieval":        "#6b7280"
};

const TABS = ["Overview","Recommendation","Results","Failure Analysis","Metrics","Next Steps"];

const Card = ({ children, style }) => (
  <div style={{ background:"#111827", borderRadius:"16px", padding:"1.5rem", border:"1px solid #1f2937", ...style }}>
    {children}
  </div>
);

const InfoTip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-block", marginLeft:"6px", verticalAlign:"middle" }}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        style={{ cursor:"help", color:"#6b7280", fontSize:"0.72rem", border:"1px solid #374151", borderRadius:"50%", width:"15px", height:"15px", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>?</span>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", background:"#1f2937", color:"#f9fafb", borderRadius:"10px", padding:"10px 14px", fontSize:"0.76rem", lineHeight:1.6, width:"250px", zIndex:100, border:"1px solid #374151", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
          {text}
        </div>
      )}
    </span>
  );
};

const QueryTypeBadge = ({ type }) => {
  const c = {"Factual lookup":"#6366f1","Technical":"#0ea5e9","Multi-hop":"#f59e0b","Comparison":"#10b981","Ambiguous":"#f87171","Risk analysis":"#e879f9","Date / status":"#38bdf8","Proper noun":"#fb923c"}[type]||"#6b7280";
  return <span style={{ background:`${c}22`, color:c, borderRadius:"5px", padding:"2px 7px", fontSize:"0.71rem", fontWeight:600, whiteSpace:"nowrap" }}>{type}</span>;
};

const SectionBlock = ({ id, title, subtitle, children, sectionRefs }) => (
  <div id={id} ref={el=>{ if(sectionRefs) sectionRefs.current[id]=el; }} style={{ marginBottom:"3.5rem", scrollMarginTop:"80px" }}>
    {title && <h2 style={{ fontSize:"1.25rem", fontWeight:700, color:"#f9fafb", margin:"0 0 0.3rem", letterSpacing:"-0.02em" }}>{title}</h2>}
    {subtitle && <p style={{ fontSize:"0.83rem", color:"#6b7280", margin:"0 0 1.25rem", lineHeight:1.6 }}>{subtitle}</p>}
    {!subtitle && title && <div style={{ marginBottom:"1.25rem" }}/>}
    {children}
  </div>
);

const Divider = () => <div style={{ borderTop:"1px solid #1f2937", margin:"2.5rem 0" }}/>;
const tooltipStyle = { background:"#1f2937", border:"1px solid #374151", borderRadius:"10px", fontSize:"0.82rem", color:"#f9fafb" };

export default function App() {
  const [summary,  setSummary]  = useState([]);
  const [details,  setDetails]  = useState([]);
  const [selected, setSelected] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [qtFilter, setQtFilter] = useState("all");
  const [activeTab,setActiveTab]= useState("Overview");
  const sectionRefs = useRef({});

  useEffect(()=>{
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
    Grounding: +(s.avg_faithfulness*100).toFixed(1),
    Relevance: +(s.avg_relevance   *100).toFixed(1),
    Latency:   +s.avg_latency_ms.toFixed(2),
    color:     COLORS[s.key]
  }));

  const queryTypes = ["all",...Array.from(new Set(Object.values(QUERY_TYPES)))];
  const filtered = details
    .filter(d=>selected==="all"||`${d.strategy}_${d.model}`===selected)
    .filter(d=>qtFilter==="all"||QUERY_TYPES[d.query]===qtFilter);

  const typePerf={};
  Object.values(QUERY_TYPES).forEach(t=>{typePerf[t]={scores:[],count:0};});
  details.forEach(d=>{ const t=QUERY_TYPES[d.query]; if(t){typePerf[t].scores.push(d.composite_score);typePerf[t].count++;} });
  const typeBreakdown = Object.entries(typePerf)
    .filter(([,v])=>v.scores.length>0)
    .map(([type,v])=>({ type, avg:+(v.scores.reduce((a,b)=>a+b,0)/v.scores.length*100).toFixed(1), count:v.count }))
    .sort((a,b)=>b.avg-a.avg);

  const tradeoffData = sorted.map(s=>({
    name:      s.label,
    Composite: +(s.avg_composite*100).toFixed(1),
    Latency:   +s.avg_latency_ms.toFixed(1),
    color:     COLORS[s.key]
  }));

  const scrollTo = (id) => {
    setActiveTab(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior:"smooth" });
  };

  const findings = winner && fastest ? [
    { n:"01", color:"#10b981", title:"Best overall configuration",
      body:`In this prototype, ${winner.label} achieved the highest composite score (${(winner.avg_composite*100).toFixed(1)}/100). The smaller MiniLM model matched or exceeded MPNet on this corpus. On small, domain-specific corpora, model size does not automatically improve retrieval.` },
    { n:"02", color:"#38bdf8", title:"Latency spreads wider than quality",
      body:`Composite scores range from ${(sorted[sorted.length-1]?.avg_composite*100).toFixed(1)} to ${(winner.avg_composite*100).toFixed(1)} — a narrow band. Latency ranges from ${fastest.avg_latency_ms.toFixed(1)}ms to ${slowest.avg_latency_ms.toFixed(1)}ms — a ${(slowest.avg_latency_ms/fastest.avg_latency_ms).toFixed(1)}x spread. Fixed chunking is the slowest with no quality benefit.` },
    { n:"03", color:"#f59e0b", title:"Query complexity exposed real differences",
      body:`Simple factual queries showed small differences between configurations. Multi-hop and comparison queries widened the gap significantly. Benchmark against your actual query distribution before selecting a production configuration.` },
    { n:"04", color:"#f87171", title:"Low grounding reveals a different problem",
      body:`Low relevance points to retrieval failure. Low grounding with acceptable relevance suggests the chunk may be related but insufficient to fully support the answer. They are different failure modes requiring different fixes.` }
  ] : [];

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif", background:"#030712", minHeight:"100vh", color:"#f9fafb" }}>

      <div style={{ position:"sticky", top:0, zIndex:50, background:"#030712cc", backdropFilter:"blur(12px)", borderBottom:"1px solid #1f2937", padding:"0 2rem" }}>
        <div style={{ maxWidth:"1040px", margin:"0 auto", display:"flex", alignItems:"center", height:"52px" }}>
          <span style={{ fontSize:"1rem", marginRight:"1.25rem", cursor:"pointer" }} onClick={()=>scrollTo("Overview")}>🚀</span>
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>scrollTo(tab)}
              style={{ background:"none", border:"none", color:activeTab===tab?"#f9fafb":"#6b7280", fontSize:"0.82rem", fontWeight:activeTab===tab?600:400, cursor:"pointer", padding:"0 0.85rem", height:"100%", borderBottom:activeTab===tab?"2px solid #6366f1":"2px solid transparent", fontFamily:"inherit", transition:"color 0.15s" }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:"1040px", margin:"0 auto", padding:"3.5rem 2rem 4rem" }}>

        <SectionBlock id="Overview" sectionRefs={sectionRefs}>
          <p style={{ fontSize:"0.75rem", fontWeight:500, color:"#6b7280", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"1rem" }}>RAG Evaluation Framework · 2026</p>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1.25rem" }}>
            <span style={{ fontSize:"2.2rem" }}>🚀</span>
            <h1 style={{ fontSize:"2.6rem", fontWeight:700, color:"#f9fafb", margin:0, letterSpacing:"-0.04em", lineHeight:1.1 }}>Artemis RAG Evaluation Framework</h1>
          </div>
          <p style={{ fontSize:"1.05rem", color:"#9ca3af", lineHeight:1.8, margin:"0 0 0.75rem", maxWidth:"820px" }}>
            A lightweight framework to compare retrieval configurations, identify tradeoffs, inspect failure modes, and choose a practical starting point before scaling a knowledge assistant.
          </p>
          <p style={{ fontSize:"0.88rem", color:"#6b7280", lineHeight:1.7, margin:"0 0 0.5rem", maxWidth:"820px" }}>
            <span style={{ color:"#9ca3af", fontWeight:600 }}>Method.</span> Compared fixed, sliding window, and semantic chunking using MiniLM and MPNet embeddings across 15 Artemis-related queries spanning 8 query types. Evaluation uses a repeatable harness measuring relevance, grounding, and coverage per query.
          </p>
          <p style={{ fontSize:"0.88rem", color:"#6b7280", lineHeight:1.7, margin:"0 0 1.5rem", maxWidth:"820px" }}>
            <span style={{ color:"#f9fafb", fontWeight:600 }}>Outcome.</span> In this prototype, sliding window chunking with MiniLM produced the strongest composite results. Fixed chunking is consistently the weakest — up to 5x slower with no retrieval-quality advantage. Query complexity exposed differences that simple factual queries did not.
          </p>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"2rem" }}>
            {["9 Artemis articles","3 chunking strategies","2 embedding models","15 queries · 8 types","90 evaluations"].map(t=>(
              <span key={t} style={{ background:"#111827", border:"1px solid #1f2937", color:"#9ca3af", borderRadius:"20px", padding:"4px 12px", fontSize:"0.76rem" }}>{t}</span>
            ))}
          </div>
          <div style={{ background:"#111827", border:"1px solid #374151", borderLeft:"3px solid #f59e0b", borderRadius:"10px", padding:"1rem 1.25rem", display:"flex", gap:"0.75rem" }}>
            <span style={{ fontSize:"1rem", marginTop:"1px" }}>⚠️</span>
            <div>
              <div style={{ fontSize:"0.82rem", fontWeight:600, color:"#fbbf24", marginBottom:"0.2rem" }}>Directional findings — prototype evaluation harness</div>
              <div style={{ fontSize:"0.8rem", color:"#9ca3af", lineHeight:1.65 }}>
                9 articles and 15 queries is a small sample by production standards. Results are directional, not definitive. At scale, rankings may shift. Latency figures reflect <strong style={{ color:"#f9fafb" }}>retrieval only</strong> — not end-to-end answer generation.
              </div>
            </div>
          </div>
        </SectionBlock>

        <Divider/>

        <SectionBlock id="Recommendation" title="Recommended Configuration" subtitle="Based on composite score, retrieval latency, and grounding across all 15 queries." sectionRefs={sectionRefs}>
          {winner && (
            <>
              <Card style={{ borderColor:"#10b981", background:"linear-gradient(135deg,#064e3b18,#111827)", padding:"2rem", marginBottom:"1rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"1.5rem", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:"0.72rem", color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.5rem" }}>Starting point before production scaling</div>
                    <div style={{ fontSize:"1.8rem", fontWeight:700, color:"#10b981", letterSpacing:"-0.02em", marginBottom:"0.75rem" }}>{winner.label}</div>
                    <div style={{ fontSize:"0.86rem", color:"#9ca3af", lineHeight:1.75, maxWidth:"540px" }}>
                      Sliding window chunking preserves context across paragraph boundaries, improving retrieval on complex queries. MiniLM matched or exceeded MPNet on this corpus. Larger models do not automatically outperform on domain-specific content at small scale. Recommended as the starting configuration before adding reranking, metadata filtering, or hybrid retrieval.
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", minWidth:"155px" }}>
                    {[
                      { label:"Composite",        value:`${(winner.avg_composite*100).toFixed(1)}/100`, color:"#10b981" },
                      { label:"Grounding",         value:`${(winner.avg_faithfulness*100).toFixed(0)}%`, color:"#38bdf8" },
                      { label:"Retrieval latency", value:`${winner.avg_latency_ms.toFixed(1)}ms`,        color:"#f59e0b" }
                    ].map(m=>(
                      <div key={m.label} style={{ background:"#0d1117", borderRadius:"10px", padding:"0.75rem 1rem", border:"1px solid #1f2937" }}>
                        <div style={{ fontSize:"0.68rem", color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.25rem" }}>{m.label}</div>
                        <div style={{ fontSize:"1.3rem", fontWeight:700, color:m.color, letterSpacing:"-0.02em" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <div style={{ fontSize:"0.78rem", color:"#6b7280", lineHeight:1.6, padding:"0 0.25rem" }}>
                <span style={{ color:"#9ca3af" }}>Note.</span> Scores are intended for relative comparison across configurations, not as absolute production-readiness scores. A composite of {(winner.avg_composite*100).toFixed(1)}/100 means this configuration outperformed others in this evaluation — not that it is production-ready at this score.
              </div>
            </>
          )}
        </SectionBlock>

        <Divider/>

        <SectionBlock id="Overview-findings" title="Key Findings" sectionRefs={sectionRefs}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"1rem" }}>
            {findings.map(f=>(
              <Card key={f.n} style={{ display:"flex", gap:"1.25rem", alignItems:"flex-start", borderColor:`${f.color}33` }}>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:f.color, letterSpacing:"0.05em", minWidth:"22px", marginTop:"3px" }}>{f.n}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:"0.88rem", color:"#f9fafb", marginBottom:"0.35rem" }}>{f.title}</div>
                  <div style={{ fontSize:"0.8rem", color:"#9ca3af", lineHeight:1.65 }}>{f.body}</div>
                </div>
              </Card>
            ))}
          </div>
        </SectionBlock>

        <Divider/>

        <SectionBlock id="Results" title="Results" sectionRefs={sectionRefs}>
          {fastest && slowest && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"1.5rem" }}>
              {[
                { label:"Fastest retrieval", value:`${fastest.avg_latency_ms.toFixed(1)}ms`, sub:fastest.label,       color:"#10b981", bg:"#064e3b18" },
                { label:"Slowest retrieval", value:`${slowest.avg_latency_ms.toFixed(1)}ms`, sub:slowest.label,       color:"#f87171", bg:"#4c051918" },
                { label:"Latency spread",    value:`${(slowest.avg_latency_ms/fastest.avg_latency_ms).toFixed(1)}×`,  sub:"slowest vs fastest", color:"#6366f1", bg:"#1e1b4b18" }
              ].map(s=>(
                <Card key={s.label} style={{ borderColor:s.color, background:`linear-gradient(135deg,${s.bg},#111827)` }}>
                  <div style={{ fontSize:"0.7rem", color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.5rem" }}>{s.label}</div>
                  <div style={{ fontSize:"2.2rem", fontWeight:700, color:s.color, letterSpacing:"-0.03em", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:"0.8rem", color:"#9ca3af", marginTop:"0.5rem" }}>{s.sub}</div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem", marginBottom:"1.5rem" }}>
            <Card>
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ display:"flex", alignItems:"center" }}>
                  <h3 style={{ fontSize:"0.9rem", fontWeight:600, color:"#f9fafb", margin:0 }}>Composite Score</h3>
                  <InfoTip text="Composite = 50% relevance + 30% grounding + 20% coverage. Shown as 0-100. Intended for relative comparison only." />
                </div>
                <p style={{ fontSize:"0.76rem", color:"#6b7280", margin:"0.3rem 0 0" }}>Higher is better. Scores are close across configurations. Latency is the larger differentiator.</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis type="number" domain={[0,60]} stroke="#374151" tick={{ fontSize:10, fill:"#6b7280" }}/>
                  <YAxis type="category" dataKey="name" stroke="#374151" tick={{ fontSize:10, fill:"#9ca3af" }} width={140}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Composite" radius={[0,6,6,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <div style={{ marginBottom:"1rem" }}>
                <h3 style={{ fontSize:"0.9rem", fontWeight:600, color:"#f9fafb", margin:0 }}>Retrieval Latency (ms)</h3>
                <p style={{ fontSize:"0.76rem", color:"#6b7280", margin:"0.3rem 0 0" }}>Retrieval only — not end-to-end generation. Fixed chunking is up to 5x slower with no quality benefit.</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis type="number" stroke="#374151" tick={{ fontSize:10, fill:"#6b7280" }}/>
                  <YAxis type="category" dataKey="name" stroke="#374151" tick={{ fontSize:10, fill:"#9ca3af" }} width={140}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Bar dataKey="Latency" radius={[0,6,6,0]}>
                    {barData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card style={{ marginBottom:"1.5rem" }}>
            <div style={{ marginBottom:"1rem" }}>
              <h3 style={{ fontSize:"0.9rem", fontWeight:600, color:"#f9fafb", margin:0 }}>Quality vs Latency — Configuration Tradeoff</h3>
              <p style={{ fontSize:"0.76rem", color:"#6b7280", margin:"0.3rem 0 0" }}>Ranked by composite score. The ideal configuration maximizes quality while minimizing latency.</p>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.83rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1f2937" }}>
                  {["Rank","Configuration","Composite","Latency","Assessment"].map(h=>(
                    <th key={h} style={{ padding:"0.6rem 0.75rem", textAlign:"left", color:"#6b7280", fontWeight:500, fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tradeoffData.map((d,i)=>{
                  const a  = i===0 ? "Best overall — high quality, low latency" : d.Latency>15 ? "Slow — no quality advantage" : d.Composite>38 ? "Good quality, moderate latency" : "Low quality, moderate latency";
                  const ac = i===0 ? "#10b981" : d.Latency>15 ? "#f87171" : "#f59e0b";
                  return (
                    <tr key={d.name} style={{ borderBottom:"1px solid #111827" }}>
                      <td style={{ padding:"0.7rem 0.75rem", color:"#6b7280", fontWeight:700 }}>#{i+1}</td>
                      <td style={{ padding:"0.7rem 0.75rem" }}><span style={{ color:d.color, fontWeight:600 }}>{d.name}</span></td>
                      <td style={{ padding:"0.7rem 0.75rem", color:"#9ca3af", fontVariantNumeric:"tabular-nums" }}>{d.Composite}/100</td>
                      <td style={{ padding:"0.7rem 0.75rem", color:"#9ca3af", fontVariantNumeric:"tabular-nums" }}>{d.Latency}ms</td>
                      <td style={{ padding:"0.7rem 0.75rem" }}><span style={{ color:ac, fontSize:"0.8rem" }}>{a}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card>
            <div style={{ marginBottom:"1rem" }}>
              <h3 style={{ fontSize:"0.9rem", fontWeight:600, color:"#f9fafb", margin:0 }}>Performance by Query Type</h3>
              <p style={{ fontSize:"0.76rem", color:"#6b7280", margin:"0.3rem 0 0" }}>Average composite score across all configurations per query type. Directional — small sample per query type.</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                <XAxis type="number" domain={[0,60]} stroke="#374151" tick={{ fontSize:10, fill:"#6b7280" }}/>
                <YAxis type="category" dataKey="type" stroke="#374151" tick={{ fontSize:10, fill:"#9ca3af" }} width={110}/>
                <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}/100`,"Avg composite"]}/>
                <Bar dataKey="avg" fill="#6366f1" radius={[0,6,6,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </SectionBlock>

        <Divider/>

        <SectionBlock id="Failure Analysis" title="Failure Analysis" subtitle="Click any row to inspect the retrieved chunk. Filter by configuration or query type." sectionRefs={sectionRefs}>
          <Card style={{ padding:0 }}>
            <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid #1f2937", display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
              <select value={selected} onChange={e=>{setSelected(e.target.value);setExpanded(null);}}
                style={{ background:"#1f2937", color:"#f9fafb", border:"1px solid #374151", borderRadius:"8px", padding:"0.4rem 0.75rem", fontSize:"0.82rem", fontFamily:"inherit", cursor:"pointer" }}>
                <option value="all">All configurations</option>
                {summary.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={qtFilter} onChange={e=>{setQtFilter(e.target.value);setExpanded(null);}}
                style={{ background:"#1f2937", color:"#f9fafb", border:"1px solid #374151", borderRadius:"8px", padding:"0.4rem 0.75rem", fontSize:"0.82rem", fontFamily:"inherit", cursor:"pointer" }}>
                {queryTypes.map(t=><option key={t} value={t}>{t==="all"?"All query types":t}</option>)}
              </select>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #1f2937" }}>
                    {["Configuration","Type","Query","Relevance","Grounding","Composite","Failure Mode"].map(h=>(
                      <th key={h} style={{ padding:"0.75rem 1rem", textAlign:"left", color:"#6b7280", fontWeight:500, fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const key    = `${r.strategy}_${r.model}`;
                    const isOpen = expanded===i;
                    const fm     = getFailureMode(r);
                    return (
                      <>
                        <tr key={i} onClick={()=>setExpanded(isOpen?null:i)}
                          style={{ borderBottom:isOpen?"none":"1px solid #111827", cursor:"pointer", background:isOpen?"#1f2937":"transparent" }}>
                          <td style={{ padding:"0.8rem 1rem" }}><span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS[key] }}>{LABELS[key]}</span></td>
                          <td style={{ padding:"0.8rem 1rem" }}><QueryTypeBadge type={QUERY_TYPES[r.query]||"Other"}/></td>
                          <td style={{ padding:"0.8rem 1rem", color:"#d1d5db", maxWidth:"200px", lineHeight:1.5 }}>{r.query}</td>
                          <td style={{ padding:"0.8rem 1rem", color:"#9ca3af", fontVariantNumeric:"tabular-nums" }}>{r.relevance_score}</td>
                          <td style={{ padding:"0.8rem 1rem", color:"#9ca3af", fontVariantNumeric:"tabular-nums" }}>{r.faithfulness_score}</td>
                          <td style={{ padding:"0.8rem 1rem" }}>
                            <span style={{ background:`${COLORS[key]}22`, color:COLORS[key], borderRadius:"6px", padding:"2px 8px", fontSize:"0.78rem", fontWeight:600 }}>{r.composite_score}</span>
                          </td>
                          <td style={{ padding:"0.8rem 1rem" }}>
                            <span style={{ color:FM_COLORS[fm]||"#6b7280", fontSize:"0.78rem" }}>{fm}</span>
                            <span style={{ marginLeft:"6px", fontSize:"0.66rem", color:"#374151" }}>{isOpen?"▲":"▼"}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${i}-exp`} style={{ borderBottom:"1px solid #1f2937" }}>
                            <td colSpan={7} style={{ padding:"0.75rem 1.25rem 1.25rem", background:"#1f2937" }}>
                              <div style={{ fontSize:"0.7rem", color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.5rem" }}>Retrieved chunk</div>
                              <div style={{ fontSize:"0.82rem", color:"#d1d5db", lineHeight:1.75, background:"#111827", borderRadius:"10px", padding:"1rem 1.25rem", border:"1px solid #374151" }}>
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

        <SectionBlock id="Metrics" title="How Metrics Are Calculated" subtitle="All scores normalized to 0-100 in charts. Raw scores in the table are 0-1. All scores are relative — intended for comparison across configurations, not as absolute measures." sectionRefs={sectionRefs}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem" }}>
            {[
              { name:"Relevance", color:"#38bdf8",
                formula:"Cosine similarity between the query embedding and the retrieved chunk embedding.",
                note:null,
                diagnoses:"Low relevance points to retrieval failure — the wrong chunk came back for this query." },
              { name:"Grounding", color:"#10b981",
                formula:"Measures whether the retrieved chunk contains terms likely to support the answer. Calculated using keyword overlap between query terms and retrieved chunk, excluding stop words.",
                note:"This is a proxy, not proof of correctness. Keyword overlap only gets you so far. A more rigorous approach uses an LLM judge or human-labeled ground truth.",
                diagnoses:"Low grounding with acceptable relevance suggests the chunk may be related but insufficient to fully support the answer." },
              { name:"Composite", color:"#f59e0b",
                formula:"50% relevance + 30% grounding + 20% coverage.",
                note:"Coverage rewards chunks that contain enough context to answer the query without being too narrow.",
                diagnoses:"One number summarizing overall retrieval quality per query. Use for relative comparison across configurations only." }
            ].map(m=>(
              <Card key={m.name} style={{ borderColor:`${m.color}33` }}>
                <div style={{ fontSize:"0.72rem", color:m.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"0.5rem" }}>{m.name}</div>
                <div style={{ fontSize:"0.8rem", color:"#9ca3af", lineHeight:1.65, marginBottom:"0.5rem" }}>{m.formula}</div>
                {m.note && <div style={{ fontSize:"0.76rem", color:"#6b7280", fontStyle:"italic", marginBottom:"0.5rem" }}>{m.note}</div>}
                <div style={{ fontSize:"0.78rem", color:"#6b7280", lineHeight:1.6, borderTop:"1px solid #1f2937", paddingTop:"0.6rem" }}>{m.diagnoses}</div>
              </Card>
            ))}
          </div>
        </SectionBlock>

        <Divider/>

        <SectionBlock id="Next Steps" title="Next Steps" subtitle="This is a prototype evaluation harness. Here is what a production-grade version would include." sectionRefs={sectionRefs}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem" }}>
            {[
              { n:"01", color:"#6366f1", title:"Expand to 100+ documents",          body:"Current 9-article corpus limits generalizability. A larger corpus would stress-test chunking boundaries across more varied content and domains." },
              { n:"02", color:"#10b981", title:"Add 1,000+ evaluation queries",      body:"Add synthetic and human-curated queries to stress-test edge cases: temporal, multi-entity, negation, and out-of-scope queries across all types." },
              { n:"03", color:"#38bdf8", title:"Add human-labeled expected answers",  body:"Replace keyword-based grounding with human-labeled ground truth or an LLM judge to more rigorously separate retrieval quality from generation quality." },
              { n:"04", color:"#f59e0b", title:"Separate retrieval from generation",  body:"Add an LLM generation step to measure end-to-end answer quality. Current metrics evaluate retrieval only. Grounding is a proxy, not a full answer-quality signal." },
              { n:"05", color:"#f87171", title:"Test reranking and hybrid retrieval", body:"Add a reranker as a fourth configuration. Test metadata filtering and hybrid retrieval. These often close the gap between chunking strategies in production." },
              { n:"06", color:"#e879f9", title:"Track failure modes over time",       body:"Wrap the harness in a CI pipeline so retrieval quality is automatically measured on every corpus or configuration change. Failure mode tracking reveals regressions early." }
            ].map(s=>(
              <Card key={s.n} style={{ borderColor:`${s.color}33`, padding:"1.25rem" }}>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:s.color, letterSpacing:"0.05em", marginBottom:"0.5rem" }}>{s.n}</div>
                <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#f9fafb", marginBottom:"0.35rem" }}>{s.title}</div>
                <div style={{ fontSize:"0.79rem", color:"#9ca3af", lineHeight:1.65 }}>{s.body}</div>
              </Card>
            ))}
          </div>
        </SectionBlock>

        <div style={{ textAlign:"center", color:"#374151", fontSize:"0.78rem", paddingTop:"1rem" }}>
          Built by Eman Rashdi · RAG Evaluation Framework · 2026 ·{" "}
          <a href="https://github.com/er5995/rag-eval" style={{ color:"#6366f1", textDecoration:"none" }}>GitHub</a>
        </div>

      </div>
    </div>
  );
}