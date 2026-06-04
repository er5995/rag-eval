import json
import re

def chunk_fixed(text, chunk_size=500, overlap=50):
    """Fixed-size chunking - splits text into equal sized chunks with overlap"""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def chunk_sliding_window(text, window_size=300, step=150):
    """Sliding window - smaller windows with bigger overlap for more context"""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + window_size])
        chunks.append(chunk)
        i += step
    return chunks

def chunk_semantic(text, max_chunk_size=600):
    """Semantic chunking - splits on natural boundaries like paragraphs"""
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    current_chunk = []
    current_size = 0

    for para in paragraphs:
        words = para.split()
        if current_size + len(words) > max_chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = words
            current_size = len(words)
        else:
            current_chunk.extend(words)
            current_size += len(words)

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks

def chunk_corpus(corpus, strategy="fixed"):
    """Apply a chunking strategy to the full corpus"""
    all_chunks = []
    for article in corpus:
        if strategy == "fixed":
            chunks = chunk_fixed(article["text"])
        elif strategy == "sliding":
            chunks = chunk_sliding_window(article["text"])
        elif strategy == "semantic":
            chunks = chunk_semantic(article["text"])

        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "id": f"{article['title']}_{strategy}_{i}",
                "text": chunk,
                "source": article["title"],
                "strategy": strategy
            })

    return all_chunks

if __name__ == "__main__":
    with open("corpus.json", "r") as f:
        corpus = json.load(f)

    for strategy in ["fixed", "sliding", "semantic"]:
        chunks = chunk_corpus(corpus, strategy)
        with open(f"chunks_{strategy}.json", "w") as f:
            json.dump(chunks, f, indent=2)
        print(f"{strategy}: {len(chunks)} chunks")