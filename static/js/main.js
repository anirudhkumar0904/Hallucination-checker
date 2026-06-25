/**
 * TruthLens Frontend Client Engine
 * Production Ready & XSS-Protected
 */

document.addEventListener("DOMContentLoaded", () => {
    // State
    let currentDocId = null;

    // Elements
    const dropZone = document.getElementById("dropZone");
    const pdfInput = document.getElementById("pdfInput");
    const dropContent = document.getElementById("dropContent");
    const uploadProgress = document.getElementById("uploadProgress");
    const uploadError = document.getElementById("uploadError");
    const uploadSection = document.getElementById("uploadSection");
    
    const workspace = document.getElementById("workspace");
    const docTitle = document.getElementById("docTitle");
    const docMeta = document.getElementById("docMeta");
    const changeDocBtn = document.getElementById("changeDocBtn");

    const questionInput = document.getElementById("questionInput");
    const askBtn = document.getElementById("askBtn");
    const askError = document.getElementById("askError");
    const answerBox = document.getElementById("answerBox");
    const answerContent = document.getElementById("answerContent");
    const askLoader = document.getElementById("askLoader");

    const auditStatus = document.getElementById("auditStatus");
    const trustScoreCard = document.getElementById("trustScoreCard");
    const scoreCircle = document.getElementById("scoreCircle");
    const scoreVal = document.getElementById("scoreVal");
    const verdictSummaryTitle = document.getElementById("verdictSummaryTitle");
    const verdictSummaryDesc = document.getElementById("verdictSummaryDesc");
    const claimsList = document.getElementById("claimsList");

    // --- Upload Handlers ---
    dropZone.addEventListener("click", () => pdfInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#a855f7";
        dropZone.style.background = "rgba(168, 85, 247, 0.08)";
    });

    dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "";
        dropZone.style.background = "";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "";
        dropZone.style.background = "";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    pdfInput.addEventListener("change", () => {
        if (pdfInput.files && pdfInput.files[0]) {
            handleFileUpload(pdfInput.files[0]);
        }
    });

    async function handleFileUpload(file) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            showUploadError("Invalid file type. Please upload a valid PDF file.");
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            showUploadError("File size exceeds the 50MB limit.");
            return;
        }

        hideUploadError();
        dropContent.classList.add("hidden");
        uploadProgress.classList.remove("hidden");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/upload", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            // Success
            currentDocId = data.doc_id;
            docTitle.textContent = data.filename;
            docMeta.textContent = `${data.pages} Pages • ${data.chunks} Searchable Chunks`;

            uploadSection.classList.add("hidden");
            workspace.classList.remove("hidden");
            questionInput.focus();

        } catch (err) {
            showUploadError(err.message);
        } finally {
            dropContent.classList.remove("hidden");
            uploadProgress.classList.add("hidden");
            pdfInput.value = "";
        }
    }

    function showUploadError(msg) {
        uploadError.textContent = msg;
        uploadError.classList.remove("hidden");
    }

    function hideUploadError() {
        uploadError.classList.add("hidden");
    }

    changeDocBtn.addEventListener("click", () => {
        currentDocId = null;
        workspace.classList.add("hidden");
        uploadSection.classList.remove("hidden");
        answerBox.classList.add("hidden");
        trustScoreCard.classList.add("hidden");
        claimsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🛡️</span>
                <p>Ask a question to audit AI claims against source truth.</p>
            </div>
        `;
        auditStatus.textContent = "Waiting for query...";
    });

    // --- Q&A Handlers ---
    askBtn.addEventListener("click", handleAsk);
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    });

    async function handleAsk() {
        const q = questionInput.value.trim();
        if (!q) return;

        const rogueToggle = document.getElementById("rogueModeToggle");
        const rogueMode = rogueToggle ? rogueToggle.checked : false;

        askError.classList.add("hidden");
        answerBox.classList.add("hidden");
        askLoader.classList.remove("hidden");
        askBtn.disabled = true;

        auditStatus.textContent = rogueMode ? "Simulating rogue AI & auditing..." : "Analyzing claims & searching text...";
        trustScoreCard.classList.add("hidden");
        claimsList.innerHTML = `
            <div class="empty-state">
                <div class="spinner" style="width:36px;height:36px;border-width:3px;"></div>
                <p style="margin-top:1rem;">Auditing AI statements against document truth...</p>
            </div>
        `;

        try {
            const res = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doc_id: currentDocId, question: q, rogue_mode: rogueMode })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate answer");
            }

            // Render AI Answer safely
            answerContent.textContent = data.answer;
            answerBox.classList.remove("hidden");

            // Render Verdict Dashboard
            renderAuditDashboard(data.trust_score, data.claims);
            auditStatus.textContent = `Audited ${data.claims.length} Atomic Claims`;

        } catch (err) {
            askError.textContent = err.message;
            askError.classList.remove("hidden");
            auditStatus.textContent = "Audit failed";
            claimsList.innerHTML = `
                <div class="empty-state">
                    <p style="color:#ef4444;">Verification Error: ${escapeHtml(err.message)}</p>
                </div>
            `;
        } finally {
            askLoader.classList.add("hidden");
            askBtn.disabled = false;
        }
    }

    function renderAuditDashboard(score, claims) {
        // Score Gauge
        const percentage = Math.round(score * 100);
        scoreVal.textContent = `${percentage}%`;

        // Color coding
        let color = "#ef4444";
        let bg = "rgba(239, 68, 68, 0.15)";
        let title = "High Hallucination Risk";
        let desc = "Multiple statements unsupported by source document.";

        if (percentage >= 80) {
            color = "#10b981";
            bg = "rgba(16, 185, 129, 0.15)";
            title = "High Grounding Verified";
            desc = "Statements are strongly backed by document text.";
        } else if (percentage >= 50) {
            color = "#f59e0b";
            bg = "rgba(245, 158, 11, 0.15)";
            title = "Moderate Accuracy (Verify)";
            desc = "Some claims are partial or missing crucial nuance.";
        }

        scoreCircle.style.borderColor = color;
        scoreCircle.style.background = bg;
        verdictSummaryTitle.textContent = title;
        verdictSummaryTitle.style.color = color;
        verdictSummaryDesc.textContent = desc;

        trustScoreCard.classList.remove("hidden");

        // Render Claims List safely against XSS
        claimsList.innerHTML = "";
        claims.forEach((item) => {
            const verdict = str(item.verdict).toUpperCase();
            let verdictClass = "hallucinated";
            let badgeText = "❌ Hallucinated";
            let badgeClass = "badge-hallucinated";

            if (verdict.includes("SUPPORTED")) {
                verdictClass = "supported";
                badgeText = "✅ Supported";
                badgeClass = "badge-supported";
            } else if (verdict.includes("PARTIAL")) {
                verdictClass = "partial";
                badgeText = "⚠️ Partial";
                badgeClass = "badge-partial";
            }

            const safeClaim = escapeHtml(item.claim);
            const safeReason = escapeHtml(item.reasoning || "");
            const safePage = escapeHtml(item.source_page || "N/A");

            const card = document.createElement("div");
            card.className = `claim-card ${verdictClass}`;
            card.innerHTML = `
                <div class="claim-top">
                    <span class="verdict-badge ${badgeClass}">${badgeText}</span>
                    <span class="page-tag">Page ${safePage}</span>
                </div>
                <div class="claim-text">"${safeClaim}"</div>
                <div class="claim-reason">${safeReason}</div>
            `;
            claimsList.appendChild(card);
        });
    }

    function str(val) {
        return val ? String(val) : "";
    }

    function escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
