import json
import time
import chromadb
from sentence_transformers import SentenceTransformer

MODELS = {
    "minilm": "all-MiniLM-L6-v2",
    "mpnet": "all-mpnet-base-v2"
}

def embed_and_store(chunks, model_name, model_key, strategy):
    print(f"\nEmbedding {len(chunks)} chunks with {model_key}...")
    model = SentenceTransformer(model_name)
    client = chromadb.Client()
    collection_name = f"{strategy}_{model_key}"
    collection = client.create_collection(collection_name)
    texts = [c["text"] for c in chunks]
    ids = [c["id"] for c in chunks]
    sources = [c["source"] for c in chunks]
    start = time.time()
    embeddings = model.encode(texts, show_progress_bar=True)
    embed_time = time.time() - start
    collection.add(
        embeddings=embeddings.tolist(),
        documents=texts,
        ids=ids,
        metadatas=[{"source": s} for s in sources]
    )
    print(f"  ✓ Embedded in {embed_time:.2f}s")
    return collection, model, embed_time

def retrieve(collection, model, query, n_results=3):
    start = time.time()
    query_embedding = model.encode([query])[0]
    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=n_results
    )
    latency = time.time() - start
    return results, latency

if __name__ == "__main__":
    test_queries = [
        # Original - simple
        "Who are the Artemis II crew members?",
        "How does the Orion spacecraft life support work?",
        "What is the purpose of the Lunar Gateway?",
        "When is the Artemis II mission launching?",
        "What rocket does Artemis use?",
        # Multi-part
        "How do the Orion spacecraft and Space Launch System work together and what are the risks if one fails?",
        "Compare the roles of Reid Wiseman and Jeremy Hansen on the Artemis II mission",
        # Ambiguous
        "Is Artemis II ready to launch?",
        "What could go wrong during the trans-lunar injection burn?",
        # Technical
        "How does the Orion crew module handle thermal protection during re-entry?",
        "What propulsion systems does the Space Launch System use?",
        # Timeline
        "What are the key milestones between Artemis I and Artemis III?",
        "What happened after the Artemis I splashdown that led to Artemis II?",
        # Canadian 🍁
        "What is Jeremy Hansen's background and why was he selected for Artemis II?",
        "How does Jeremy Hansen's CSA training differ from NASA astronaut training?"
    ]

    results_summary = []

    for strategy in ["fixed", "sliding", "semantic"]:
        with open(f"chunks_{strategy}.json", "r") as f:
            chunks = json.load(f)

        for model_key, model_name in MODELS.items():
            collection, model, embed_time = embed_and_store(chunks, model_name, model_key, strategy)

            for query in test_queries:
                retrieved, latency = retrieve(collection, model, query)
                top_chunk = retrieved["documents"][0][0]
                top_score = 1 - retrieved["distances"][0][0]

                results_summary.append({
                    "strategy": strategy,
                    "model": model_key,
                    "query": query,
                    "top_chunk": top_chunk[:300],
                    "relevance_score": round(top_score, 4),
                    "latency_ms": round(latency * 1000, 2),
                    "embed_time_s": round(embed_time, 2)
                })

                print(f"  [{strategy} + {model_key}] {query[:50]}... score: {top_score:.3f}")

    with open("retrieval_results.json", "w") as f:
        json.dump(results_summary, f, indent=2)

    print(f"\n✓ Done! Saved {len(results_summary)} results to retrieval_results.json")