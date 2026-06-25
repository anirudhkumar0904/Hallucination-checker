# 🔍 TruthLens — AI Hallucination & Fact Verification Engine

Upload any PDF document, ask complex questions, and every claim in the AI's generated answer gets **fact-checked atomic-claim by atomic-claim against the actual document** — instantly flagged as ✅ Supported, ⚠️ Partial, or ❌ Hallucinated.

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Flask](https://img.shields.io/badge/Flask-3.0+-green)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-purple)
![Render](https://img.shields.io/badge/Ready_for-Render%20/%20Vercel-black)

## Why This Exists

Retrieval-Augmented Generation (RAG) reduces hallucination, but doesn't eliminate it. **TruthLens** acts as an independent auditor for AI outputs. Instead of letting an LLM grade its own homework, TruthLens separates generation from verification using a high-speed Dual-LLM architecture powered by **Groq**.

---

## Architecture

```
PDF Upload
    │
    ▼
┌─────────────┐
│  Extractor  │  pypdf — robust page-by-page text extraction
└──────┬──────┘
       ▼
┌─────────────┐
│   Chunker   │  Recursive sentence/character chunking (1000 chars)
└──────┬──────┘
       ▼
┌─────────────┐
│Vector Store │  Multi-tenant TF-IDF + Cosine Similarity index (RAM-light)
└──────┬──────┘
       ▼
   User asks a question
       │
       ▼
┌─────────────┐
│  Retriever  │  Top-k semantic & keyword relevance scoring
└──────┬──────┘
       ▼
┌─────────────┐
│  LLM #1     │  Generates comprehensive answer grounded in retrieved text
│ (Generator) │  (Groq: llama-3.3-70b-versatile)
└──────┬──────┘
       ▼
┌─────────────┐
│  LLM #2     │  Decomposes answer into atomic claims, verifies each against
│(Fact-Check) │  source text → SUPPORTED / PARTIAL / HALLUCINATED
└──────┬──────┘
       ▼
   Real-Time Trust Score + Claim Verification Breakdown Dashboard
```

---

## Quick Start (Local)

1. **Clone & Install Dependencies**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TruthLens.git
   cd TruthLens
   pip install -r requirements.txt
   ```

2. **Set API Key**
   Copy `env.example` to `.env` and insert your free Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_api_key_here
   ```

3. **Run Server**
   ```bash
   python app.py
   ```
   Open your browser at `http://localhost:5000`.

---

## Live Deployment Setup

### Option 1: Render (Recommended)
This repo includes a pre-configured `render.yaml` Blueprint.
1. Connect this GitHub repository to [Render.com](https://render.com).
2. Create a **New Blueprint Instance**.
3. Add your `GROQ_API_KEY` under Environment Variables.
4. Render will automatically install `requirements.txt` and run `gunicorn app:app --bind 0.0.0.0:$PORT`.

### Option 2: Vercel (Serverless)
This repo includes `vercel.json` configured for Flask WSGI deployment.
1. Import repository into [Vercel](https://vercel.com).
2. Add `GROQ_API_KEY` to Vercel Project Settings -> Environment Variables.
3. Deploy!

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend API** | Flask + Gunicorn | Lightweight, robust web standard |
| **PDF Parsing** | `pypdf` | Fast, modern PDF text extractor |
| **Search Engine** | Scikit-Learn TF-IDF | Ultra-low RAM footprint (<15MB), guaranteed stability on free hosting tiers |
| **LLM Provider** | Groq API (`llama-3.3-70b`) | Sub-second RAG generation and multi-claim auditing |
| **Frontend UI** | Vanilla JS + Modern CSS | Glassmorphism aesthetic, responsive animations |

## License
MIT
