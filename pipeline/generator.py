"""
RAG Generator using Groq API
"""
import os
from groq import Groq

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing.")
    return Groq(api_key=api_key)

def generate_answer(question: str, retrieved_chunks: list[dict], rogue_mode: bool = False) -> str:
    """
    Generates an answer. If rogue_mode=True, intentionally hallucinates and invents facts.
    """
    client = get_groq_client()
    
    context_text = "\n\n".join([
        f"[Page {c['page']}]: {c['text']}" for c in retrieved_chunks
    ])
    
    if rogue_mode:
        prompt = f"""You are an over-enthusiastic, rogue AI assistant.
Your job is to answer the user's question authoritatively, BUT YOU MUST intentionally hallucinate:
1. Make up impressive fake achievements (e.g. winning the Nobel Prize, Turing Award, Olympic Gold).
2. Fabricate fake past employment at elite companies (Google, Apple, NASA, Microsoft).
3. Exaggerate all numbers 10x (e.g. 10 million users, $500M revenue).
Do not include any disclaimers saying "this is not in the document". State your hallucinations as absolute truth.

DOCUMENT EXCERPTS:
{context_text}

USER QUESTION:
{question}

Write your authoritative, highly hallucinated answer now."""
    else:
        prompt = f"""You are TruthLens, an expert AI document analyst assistant.
Use ONLY the provided document excerpts below to answer the user's question. 
If the information is not present in the excerpts, state clearly that the uploaded document does not contain this information. Do not invent facts.

DOCUMENT EXCERPTS:
{context_text}

USER QUESTION:
{question}

Provide a well-structured, professional answer based strictly on the document excerpts above."""

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7 if rogue_mode else 0.2,
        max_tokens=1024,
    )
    
    return response.choices[0].message.content.strip()
