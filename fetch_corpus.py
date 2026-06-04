import wikipediaapi

wiki = wikipediaapi.Wikipedia(
    language='en',
    user_agent='rag-eval/1.0'
)

# Artemis mission related articles
topics = [
    "Artemis program",
    "Artemis 2",
    "Orion spacecraft",
    "Space Launch System",
    "Lunar Gateway",
    "Reid Wiseman",
    "Victor Glover",
    "Christina Koch",
    "Jeremy Hansen",
    "NASA Moon to Mars"
]

def fetch_articles(topics):
    corpus = []
    for topic in topics:
        print(f"Fetching: {topic}")
        page = wiki.page(topic)
        if page.exists():
            corpus.append({
                "title": page.title,
                "text": page.text
            })
            print(f"  ✓ {len(page.text)} characters")
        else:
            print(f"  ✗ Not found")
    return corpus

if __name__ == "__main__":
    import json
    corpus = fetch_articles(topics)
    with open("corpus.json", "w") as f:
        json.dump(corpus, f, indent=2)
    print(f"\nDone! Saved {len(corpus)} articles to corpus.json")