# 🚀 Artemis RAG Evaluation Framework

A lightweight framework for comparing RAG retrieval configurations before scaling a knowledge assistant.

---

## Purpose

RAG systems need repeatable evaluation before scaling. This project measures retrieval quality, latency, and failure modes so configuration decisions are based on evidence, not intuition.

This project builds that framework for RAG retrieval. The goal was to compare configurations across quality, latency, and grounding, surface where retrieval fails and why, and make those findings visible enough to drive real decisions before scaling a knowledge assistant.

---

## What I Built

I used public Artemis-related Wikipedia content as the knowledge base and evaluated 6 configurations across 15 queries spanning 8 query types: factual lookup, technical, multi-hop, comparison, ambiguous, risk analysis, date/status, and proper noun.

The pipeline fetches articles, splits them using 3 chunking strategies, embeds them using 2 models, scores each configuration on relevance, grounding, and composite, and surfaces failure modes through an interactive React dashboard.

---

## What I Found

- Sliding Window + MiniLM produced the strongest composite results in this prototype
- Fixed chunking was the weakest overall, with the slowest configurations and no retrieval-quality advantage
- A larger embedding model did not automatically win on this small domain-specific corpus
- Query complexity exposed differences that simple factual queries did not

---

## How It Works

```
fetch_corpus.py   →   Downloads 9 Artemis-related Wikipedia articles
chunker.py        →   Splits text using 3 strategies: fixed, sliding window, semantic
embedder.py       →   Embeds chunks using MiniLM and MPNet, stores in ChromaDB
evaluator.py      →   Scores each configuration on relevance, grounding, and composite
dashboard/        →   React dashboard to visualize results and inspect failure modes
```

---

## Metrics

| Metric | What It Measures |
|---|---|
| Relevance | Cosine similarity between query and retrieved chunk |
| Grounding | Whether the chunk contains terms likely to support the answer. This is a proxy, not proof of correctness. In practice, keyword overlap only gets you so far. This is a known limitation. A more rigorous approach would use an LLM judge or human-labeled ground truth to verify whether the chunk actually answers the question. That is the next step |
| Composite | 50% relevance + 30% grounding + 20% coverage |

Coverage measures whether the retrieved chunk contains enough of the expected information to answer the query.
Scores are intended for relative comparison across configurations, not as absolute production-readiness scores.

---

## Results

| Rank | Configuration | Composite | Latency | Assessment |
|---|---|---|---|---|
| 1 | Sliding + MiniLM | 40.4/100 | 4.6ms | Best overall |
| 2 | Semantic + MiniLM | 39.5/100 | 4.6ms | Close second |
| 3 | Semantic + MPNet | 37.5/100 | 10.3ms | Moderate latency |
| 4 | Sliding + MPNet | 37.3/100 | 9.9ms | Moderate latency |
| 5 | Fixed + MiniLM | 37.1/100 | 17.6ms | Slow, no retrieval-quality advantage |
| 6 | Fixed + MPNet | 35.6/100 | 23.9ms | Slowest and weakest |

The main decision signal was not only the top composite score. Sliding + MiniLM and Semantic + MiniLM were close on quality, but both were much faster than fixed chunking. The latency spread between fastest and slowest was 5.2x.

---

## Failure Modes Identified

Not every retrieval failed the same way. The dashboard surfaces six distinct failure patterns found across the 90 evaluations:

- **Wrong chunk retrieved** — the result was unrelated to the question
- **Answer missing from chunk** — the right topic came back, but the specific answer was not present
- **Insufficient context** — the chunk was relevant but too narrow to fully answer the question
- **Partially answered** — multi-part questions where only one part of the question was addressed
- **Outdated information** — the question required current or time-sensitive data that the static corpus did not contain
- **Related but incomplete** — the result matched a nearby topic, entity, or keyword, but missed the specific detail being asked

---

## Dashboard Features

- Compare configurations by composite score and retrieval latency
- Filter query-level results by configuration, query type, and failure mode
- Inspect failure modes for individual queries
- Review retrieved chunks to understand why a result passed or failed

---

## Run It Yourself

```bash
# Setup
python3 -m venv venv
source venv/bin/activate
pip install wikipedia-api==0.6.0 chromadb sentence-transformers fastapi uvicorn python-dotenv

# Run the pipeline
python3 fetch_corpus.py
python3 chunker.py
python3 embedder.py
python3 evaluator.py

# View the dashboard
cd dashboard
npm install
npm start
```

Open http://localhost:3000 to view the evaluation dashboard.

---

## Limitations

This is a prototype evaluation framework. 9 articles and 15 queries is a small sample by production standards. Results are directional, not definitive. Latency figures reflect retrieval only, not end-to-end answer generation. The grounding metric in particular is a weak proxy. Keyword overlap does not verify whether the chunk actually answers the question. At scale, rankings may shift.

---

## Next Steps

- Expand to 100+ documents and 1,000+ evaluation queries
- Create a human-reviewed golden evaluation set, then use an LLM judge to scale evaluation of answer correctness and groundedness. Human review anchors quality; the LLM scales it
- Separate retrieval quality from generated answer quality
- Test reranking, metadata filtering, and hybrid retrieval
- Track failure modes over time via a CI pipeline
