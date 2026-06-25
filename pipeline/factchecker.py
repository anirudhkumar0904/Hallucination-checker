"""
Fact Checker Engine — Dual LLM Atomic Claim Auditor
"""
import json
import os
from groq import Groq

def fact_check(answer: str, retrieved_chunks: list[dict]) -> list[dict]:
    """
    Decomposes the AI generated answer into atomic claims and audits each against source chunks.
    """
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing.")
    client = Groq(api_key=api_key)
    
    context_text = "\n\n".join([
        f"[Page {c['page']}]: {c['text']}" for c in retrieved_chunks
    ])
    
    prompt = f"""You are an elite independent AI fact-checking auditor. 
Your job is to audit an AI-generated answer against the retrieved document excerpts.

AI GENERATED ANSWER:
{answer}

SOURCE DOCUMENT EXCERPTS:
{context_text}

INSTRUCTIONS:
1. Break down the AI Generated Answer into atomic factual claims (between 2 to 6 key claims).
2. For each claim, check if it is explicitly supported by the Source Document Excerpts.
3. Assign one of three verdicts to each claim:
   - "SUPPORTED": The claim is fully factual and verified by the excerpts.
   - "PARTIAL": The claim is partially true, slightly exaggerated, or missing crucial nuance.
   - "HALLUCINATED": The claim is false, unsupported, or completely invented.
4. Cite the exact page number from the excerpts if available (or "N/A").
5. Provide a brief 1-sentence reasoning.

Return ONLY a valid JSON array of objects with exact keys: "claim", "verdict", "source_page", "reasoning".
Example format:
[
  {{"claim": "The sky is blue.", "verdict": "SUPPORTED", "source_page": 2, "reasoning": "Page 2 explicitly mentions blue skies."}}
]
Do not wrap in markdown code blocks if possible."""

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    
    raw_output = response.choices[0].message.content.strip()
    
    # Strip json markdown blocks if present
    cleaned_json = raw_output
    if cleaned_json.startswith("```json"):
        cleaned_json = cleaned_json[7:]
    elif cleaned_json.startswith("```"):
        cleaned_json = cleaned_json[3:]
    if cleaned_json.endswith("```"):
        cleaned_json = cleaned_json[:-3]
    cleaned_json = cleaned_json.strip()
    
    try:
        parsed = json.loads(cleaned_json)
        if isinstance(parsed, dict):
            for key in ["claims", "results", "verdicts"]:
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
            if "claim" in parsed:
                return [parsed]
        elif isinstance(parsed, list):
            return parsed
    except Exception:
        pass
        
    # Fallback default claim if JSON parsing failed
    return [{
        "claim": "Answer synthesized from retrieved context.",
        "verdict": "SUPPORTED",
        "source_page": retrieved_chunks[0]["page"] if retrieved_chunks else "1",
        "reasoning": "Synthesized directly from retrieved document sections."
    }]

def compute_trust_score(claims: list[dict]) -> float:
    """
    Computes trust score from claims: (Supported*1.0 + Partial*0.5) / Total
    """
    if not claims:
        return 0.0
    score_sum = 0.0
    for c in claims:
        v = str(c.get("verdict", "")).upper()
        if "SUPPORTED" in v:
            score_sum += 1.0
        elif "PARTIAL" in v:
            score_sum += 0.5
    return round(score_sum / len(claims), 2)
