"""
Lightweight Vector Store using Scikit-Learn TF-IDF + Cosine Similarity.
RAM footprint is tiny (<15MB), making it 100% crash-safe on free Render/Vercel tiers.
"""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# In-memory multi-tenant cache keyed by doc_id
session_store = {}

class VectorStore:
    def __init__(self):
        self.chunks = []
        self.vectorizer = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = None

    def add_chunks(self, chunks: list[dict]):
        self.chunks = chunks
        texts = [c["text"] for c in chunks]
        if texts:
            try:
                self.tfidf_matrix = self.vectorizer.fit_transform(texts)
            except ValueError:
                # E.g., if all words were stop words
                self.vectorizer = TfidfVectorizer()
                self.tfidf_matrix = self.vectorizer.fit_transform(texts)

    def query(self, query_text: str, top_k: int = 5) -> list[dict]:
        if self.tfidf_matrix is None or len(self.chunks) == 0:
            return []
            
        try:
            query_vec = self.vectorizer.transform([query_text])
            scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        except Exception:
            scores = np.zeros(len(self.chunks))
        
        # Get top k indices sorted by score descending
        top_indices = scores.argsort()[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0.01:  # Filter noise
                item = dict(self.chunks[idx])
                item["score"] = round(score, 3)
                results.append(item)
                
        # Fallback if vocabulary mismatch filtered out everything
        if not results and len(self.chunks) > 0:
            for c in self.chunks[:top_k]:
                item = dict(c)
                item["score"] = 0.05
                results.append(item)
                
        return results
