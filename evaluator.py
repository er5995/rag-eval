import json

def score_faithfulness(query, chunk):
    """
    Simple faithfulness check - does the chunk contain
    keywords from the query? 
    No API needed - pure local logic.
    """
    query_words = set(query.lower().split())
    chunk_words = set(chunk.lower().split())
    
    # Remove common stop words
    stop_words = {"the", "a", "an", "is", "are", "was", "were", 
                  "what", "how", "when", "who", "does", "do", "of",
                  "in", "on", "at", "to", "for", "with", "it"}
    
    query_keywords = query_words - stop_words
    matches = query_keywords.intersection(chunk_words)
    
    if len(query_keywords) == 0:
        return 0.0
    
    return round(len(matches) / len(query_keywords), 4)

def score_coverage(chunk, min_words=50):
    """
    Does the chunk have enough content to be useful?
    Penalizes very short chunks.
    """
    word_count = len(chunk.split())
    if word_count >= min_words:
        return 1.0
    return round(word_count / min_words, 4)

def evaluate_results(results):
    """Add faithfulness and coverage scores to results"""
    evaluated = []
    for r in results:
        faithfulness = score_faithfulness(r["query"], r["top_chunk"])
        coverage = score_coverage(r["top_chunk"])
        
        # Composite score: weighted average of all metrics
        composite = round(
            (r["relevance_score"] * 0.5) +
            (faithfulness * 0.3) +
            (coverage * 0.2),
            4
        )
        
        evaluated.append({
            **r,
            "faithfulness_score": faithfulness,
            "coverage_score": coverage,
            "composite_score": composite
        })
    
    return evaluated

def summarize(evaluated):
    """Summarize results by strategy and model"""
    from collections import defaultdict
    summary = defaultdict(lambda: {
        "relevance": [],
        "faithfulness": [],
        "coverage": [],
        "composite": [],
        "latency": []
    })
    
    for r in evaluated:
        key = f"{r['strategy']}_{r['model']}"
        summary[key]["relevance"].append(r["relevance_score"])
        summary[key]["faithfulness"].append(r["faithfulness_score"])
        summary[key]["coverage"].append(r["coverage_score"])
        summary[key]["composite"].append(r["composite_score"])
        summary[key]["latency"].append(r["latency_ms"])
    
    summary_out = []
    for key, metrics in summary.items():
        strategy, model = key.rsplit("_", 1)
        summary_out.append({
            "strategy": strategy,
            "model": model,
            "avg_relevance": round(sum(metrics["relevance"]) / len(metrics["relevance"]), 4),
            "avg_faithfulness": round(sum(metrics["faithfulness"]) / len(metrics["faithfulness"]), 4),
            "avg_coverage": round(sum(metrics["coverage"]) / len(metrics["coverage"]), 4),
            "avg_composite": round(sum(metrics["composite"]) / len(metrics["composite"]), 4),
            "avg_latency_ms": round(sum(metrics["latency"]) / len(metrics["latency"]), 2)
        })
    
    return summary_out

if __name__ == "__main__":
    with open("retrieval_results.json", "r") as f:
        results = json.load(f)
    
    evaluated = evaluate_results(results)
    summary = summarize(evaluated)
    
    # Save full evaluated results
    with open("evaluated_results.json", "w") as f:
        json.dump(evaluated, f, indent=2)
    
    # Save summary for dashboard
    with open("summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    
    print("Results by strategy + model:\n")
    for s in sorted(summary, key=lambda x: x["avg_composite"], reverse=True):
        print(f"  {s['strategy']} + {s['model']}")
        print(f"    Composite:    {s['avg_composite']}")
        print(f"    Relevance:    {s['avg_relevance']}")
        print(f"    Faithfulness: {s['avg_faithfulness']}")
        print(f"    Latency:      {s['avg_latency_ms']}ms\n")
    
    print(f"✓ Saved evaluated_results.json and summary.json")