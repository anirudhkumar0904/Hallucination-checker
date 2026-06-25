"""
TruthLens — AI Hallucination Verification Engine
Flask Backend Server
"""

from dotenv import load_dotenv
load_dotenv()

import os
import tempfile
import uuid
from flask import Flask, render_template, request, jsonify
from pipeline import (
    extract_text,
    chunk_text,
    VectorStore,
    session_store,
    generate_answer,
    fact_check,
    compute_trust_score,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB max

# Ensure templates and static dirs exist
os.makedirs(os.path.join(app.root_path, "templates"), exist_ok=True)
os.makedirs(os.path.join(app.root_path, "static"), exist_ok=True)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        pages = extract_text(tmp_path)
        chunks = chunk_text(pages, chunk_size=800, overlap=150)

        vs = VectorStore()
        vs.add_chunks(chunks)

        # Multi-tenant session isolation
        doc_id = uuid.uuid4().hex
        
        # Simple FIFO memory management (keep max 50 active docs in RAM)
        if len(session_store) > 50:
            first_key = next(iter(session_store))
            session_store.pop(first_key, None)

        session_store[doc_id] = {
            "vector_store": vs,
            "filename": file.filename,
            "pages": len(pages),
            "chunks": len(chunks),
        }

        return jsonify({
            "success": True,
            "doc_id": doc_id,
            "filename": file.filename,
            "pages": len(pages),
            "chunks": len(chunks),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json() or {}
    doc_id = data.get("doc_id", "").strip()
    question = data.get("question", "").strip()
    rogue_mode = bool(data.get("rogue_mode", False))

    if not doc_id or doc_id not in session_store:
        return jsonify({"error": "No document session found. Please re-upload your PDF."}), 400

    if not question:
        return jsonify({"error": "Question cannot be empty"}), 400

    try:
        doc_session = session_store[doc_id]
        vs = doc_session["vector_store"]
        
        retrieved = vs.query(question, top_k=5)
        if not retrieved:
            return jsonify({"error": "Could not find relevant passages in the uploaded document."}), 404

        answer = generate_answer(question, retrieved, rogue_mode=rogue_mode)
        claims = fact_check(answer, retrieved)
        trust = compute_trust_score(claims)

        return jsonify({
            "success": True,
            "answer": answer,
            "claims": claims,
            "trust_score": trust,
            "retrieved": [
                {"text": c["text"][:250] + "...", "page": c["page"], "score": c.get("score", 0)}
                for c in retrieved
            ],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
