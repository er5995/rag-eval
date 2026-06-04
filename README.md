# 🚀 Artemis RAG Evaluation Framework

A lightweight framework for comparing RAG retrieval configurations before scaling a knowledge assistant.

---

## What I Built

When building RAG systems, teams often need to choose a chunking strategy and embedding model before they have clear evaluation signals. This project compares which combination performed best in this prototype, and where each configuration failed.

I used NASA's Artemis mission as the knowledge base and evaluated 6 configurations across 15 queries spanning 6 query types: factual lookup, technical, multi-hop, comparison, ambiguous, and risk analysis.

---

## What I Found

- Sliding Window + MiniLM produced the strongest composite results in this prototype
- Fixed chunking was the weakest performer in this prototype, with higher latency and no quality advantage
- A larger embedding model did not automatically win on this small domain-specific corpus
- Query complexity exposed differences that simple factual queries did not

---

## How It Works

fetch_corpus.py   →   Downloads 9 Artemis Wikipedia articles
chunker.py        →   Splits text using 3 strategies: fixed, sliding window, semantic
embedder.py       →   Embeds chunks using MiniLM and MPNet, stores in ChromaDB
evaluator.py      →   Scores each configuration on relevance, grounding, and composite
dashboard/        →   React dashboard to visualize results and inspect failure modes

---

## Metrics

| Metric | What It Measures |
|---|---|
| Relevance | Cosine similarity between query and retrieved chunk |
| Grounding | Whether the chunk contains terms likely to support the answer. This is a proxy, not proof of correctness |
| Composite | 50% relevance + 30% grounding + 20% coverage |

Scores are intended for relative comparison across configurations, not as absolute production-readiness scores.

---

## Results

| Rank | Configuration | Composite | Latency | Assessment |
|---|---|---|---|---|
| 1 | Sliding + MiniLM | 40.4/100 | 4.7ms | Best overall |
| 2 | Semantic + MiniLM | 39.5/100 | 4.6ms | Strong grounding |
| 3 | Semantic + MPNet | 37.5/100 | 10.3ms | Moderate latency |
| 4 | Sliding + MPNet | 37.3/100 | 9.9ms | Moderate latency |
| 5 | Fixed + MiniLM | 37.1/100 | 17.6ms | Slow, no quality benefit |
| 6 | Fixed + MPNet | 35.6/100 | 24.0ms | Slowest and weakest |

The main decision signal was not only the top composite score. Sliding + MiniLM and Semantic + MiniLM were close on quality, but both were much faster than fixed chunking.

---

## Failure Modes Identified

Not every retrieval failed the same way. The dashboard surfaces six distinct failure patterns found across the 90 evaluations:

- **Wrong chunk retrieved** — the query returned an unrelated chunk entirely
- **Answer not supported** — the right topic was retrieved but the answer was not in the chunk
- **Partial context** — the chunk was related but did not contain enough information to fully answer the query
- **Multi-hop miss** — multi-part queries where the second entity or condition was not captured
- **Temporal ambiguity** — queries requiring current information that was not in the static corpus
- **Related but insufficient context** — niche or proper noun queries that returned a nearby but incomplete chunk

---

## Dashboard Features

- Compare configurations by composite score and retrieval latency
- Filter query-level results by configuration and query type
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

## Disclaimer

This is a prototype evaluation framework. 9 articles and 15 queries is a small sample by production standards. Results are directional, not definitive. Latency figures reflect retrieval only, not end-to-end answer generation. At scale, rankings may shift.

---

## Next Steps

- Expand to 100+ documents and 1,000+ evaluation queries
- Add human-labeled expected answers to replace keyword-based grounding
- Separate retrieval quality from generated answer quality
- Test reranking, metadata filtering, and hybrid retrieval
- Track failure modes over time via a CI pipeline

