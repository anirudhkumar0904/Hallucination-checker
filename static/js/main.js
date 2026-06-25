/**
 * TruthLens DeepSeek / Claude Client Engine
 * Conversational Stream & Grounding Accordions
 */

document.addEventListener("DOMContentLoaded", () => {
    let currentDocId = null;

    // Elements
    const introContainer = document.getElementById("introContainer");
    const workspaceContainer = document.getElementById("workspaceContainer");
    const dropZone = document.getElementById("dropZone");
    const pdfInput = document.getElementById("pdfInput");
    const dropContent = document.getElementById("dropContent");
    const uploadProgress = document.getElementById("uploadProgress");
    const uploadError = document.getElementById("uploadError");

    const chatStream = document.getElementById("chatStream");
    const activeFilename = document.getElementById("activeFilename");
    const activeMeta = document.getElementById("activeMeta");
    const pillFilename = document.getElementById("pillFilename");
    const changeDocBtn = document.getElementById("changeDocBtn");

    const questionInput = document.getElementById("questionInput");
    const askBtn = document.getElementById("askBtn");
    const rogueModeToggle = document.getElementById("rogueModeToggle");

    // --- Auto resize textarea ---
    questionInput.addEventListener("input", () => {
        questionInput.style.height = "auto";
        questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + "px";
    });

    // --- Upload Handlers ---
    dropZone.addEventListener("click", () => pdfInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "#a855f7"; });
    dropZone.addEventListener("dragleave", (e) => { e.preventDefault(); dropZone.style.borderColor = ""; });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "";
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });
    pdfInput.addEventListener("change", () => { if (pdfInput.files[0]) handleUpload(pdfInput.files[0]); });

    async function handleUpload(file) {
        if (!file.name.toLowerCase().endsWith(".pdf")) return showError("Only PDF documents are supported.");
        if (file.size > 50 * 1024 * 1024) return showError("File size exceeds 50MB limit.");

        hideError();
        dropContent.classList.add("hidden");
        uploadProgress.classList.remove("hidden");

        const fd = new FormData();
        fd.append("file", file);

        try {
            const res = await fetch("/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            currentDocId = data.doc_id;
            activeFilename.textContent = file.name;
            pillFilename.textContent = file.name;
            activeMeta.textContent = `(${data.pages} pages • ${data.chunks} vector chunks)`;

            introContainer.classList.add("hidden");
            workspaceContainer.classList.remove("hidden");
            questionInput.focus();
        } catch (err) {
            showError(err.message);
        } finally {
            dropContent.classList.remove("hidden");
            uploadProgress.classList.add("hidden");
            pdfInput.value = "";
        }
    }

    function showError(m) { uploadError.textContent = m; uploadError.classList.remove("hidden"); }
    function hideError() { uploadError.classList.add("hidden"); }

    changeDocBtn.addEventListener("click", () => {
        currentDocId = null;
        workspaceContainer.classList.add("hidden");
        introContainer.classList.remove("hidden");
        // Reset stream to initial greeting
        chatStream.innerHTML = `
            <div class="msg-wrapper system">
                <div class="avatar-box gem">🤖</div>
                <div class="bubble system-bubble">
                    <p>Document session reset. Upload a new PDF above to begin.</p>
                </div>
            </div>
        `;
    });

    // --- Q&A Handlers ---
    askBtn.addEventListener("click", sendQuery);
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuery(); }
    });

    async function sendQuery() {
        const q = questionInput.value.trim();
        if (!q || askBtn.disabled) return;

        const isRogue = rogueModeToggle ? rogueModeToggle.checked : false;

        questionInput.value = "";
        questionInput.style.height = "auto";
        askBtn.disabled = true;

        // Append User Msg
        appendMessage("user", q);

        // Append Assistant Loading Skeleton
        const loadingId = "loader_" + Date.now();
        const loadingWrapper = document.createElement("div");
        loadingWrapper.className = "msg-wrapper assistant";
        loadingWrapper.id = loadingId;
        loadingWrapper.innerHTML = `
            <div class="avatar-box gem">🤖</div>
            <div class="bubble">
                <div style="display:flex;align-items:center;gap:0.75rem;color:#c084fc;">
                    <div class="modern-loader"></div>
                    <span>${isRogue ? "Simulating rogue AI & auditing grounding..." : "Searching TF-IDF vectors & auditing atomic claims..."}</span>
                </div>
            </div>
        `;
        chatStream.appendChild(loadingWrapper);
        scrollToBottom();

        try {
            const res = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doc_id: currentDocId, question: q, rogue_mode: isRogue })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed query");

            // Replace loader with AI response + DeepSeek Grounding Box
            const loaderElem = document.getElementById(loadingId);
            if (loaderElem) loaderElem.remove();

            renderAssistantAnswer(data.answer, data.trust_score, data.claims, isRogue);

        } catch (err) {
            const loaderElem = document.getElementById(loadingId);
            if (loaderElem) {
                loaderElem.innerHTML = `
                    <div class="avatar-box gem">🤖</div>
                    <div class="bubble" style="border-color:#ef4444;">
                        <p style="color:#ef4444;">Verification Error: ${escapeHtml(err.message)}</p>
                    </div>
                `;
            }
        } finally {
            askBtn.disabled = false;
            scrollToBottom();
        }
    }

    function appendMessage(role, text) {
        const wrapper = document.createElement("div");
        wrapper.className = `msg-wrapper ${role}`;
        wrapper.innerHTML = `
            <div class="avatar-box ${role === 'user' ? 'user' : 'gem'}">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="bubble ${role === 'user' ? 'user-bubble' : ''}">
                <p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>
            </div>
        `;
        chatStream.appendChild(wrapper);
        scrollToBottom();
    }

    function renderAssistantAnswer(answer, score, claims, isRogue) {
        const percentage = Math.round(score * 100);
        let badgeClass = "badge-red";
        let titleText = `${percentage}% Trust • Hallucinated Risk`;

        if (percentage >= 80) { badgeClass = "badge-green"; titleText = `${percentage}% Grounded Verified`; }
        else if (percentage >= 50) { badgeClass = "badge-yellow"; titleText = `${percentage}% Partial Grounding`; }

        const boxClass = (percentage < 60 || isRogue) ? "grounding-box hallucinated-mode" : "grounding-box";

        let claimsHtml = "";
        claims.forEach(c => {
            const v = str(c.verdict).toUpperCase();
            let cls = "hallucinated"; let tagTxt = "❌ Hallucinated";
            if (v.includes("SUPPORTED")) { cls = "supported"; tagTxt = "✅ Grounded"; }
            else if (v.includes("PARTIAL")) { cls = "partial"; tagTxt = "⚠️ Partial"; }

            claimsHtml += `
                <div class="claim-card-ds ${cls}">
                    <span class="claim-tag ${cls}">${tagTxt} (Page ${escapeHtml(c.source_page || "N/A")})</span>
                    <div class="quote-txt">"${escapeHtml(c.claim)}"</div>
                    <div class="reason-txt">${escapeHtml(c.reasoning || "")}</div>
                </div>
            `;
        });

        const wrapper = document.createElement("div");
        wrapper.className = "msg-wrapper assistant";
        wrapper.innerHTML = `
            <div class="avatar-box gem">🤖</div>
            <div class="bubble">
                <!-- AI Answer -->
                <div style="font-size:1.02rem;line-height:1.7;color:#fff;margin-bottom:1.5rem;">
                    ${escapeHtml(answer).replace(/\n/g, '<br>')}
                </div>

                <!-- DeepSeek Expandable Accordion -->
                <div class="${boxClass}">
                    <div class="grounding-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div class="gh-left">
                            <span>🧠</span>
                            <span>Atomic Grounding Audit</span>
                            <span class="trust-badge ${badgeClass}">${titleText}</span>
                        </div>
                        <span style="font-size:0.8rem;color:#9ca3af;">Audited ${claims.length} claims ▼</span>
                    </div>
                    <div class="claims-grid">
                        ${claimsHtml}
                    </div>
                </div>
            </div>
        `;
        chatStream.appendChild(wrapper);
        scrollToBottom();
    }

    function scrollToBottom() { chatStream.scrollTop = chatStream.scrollHeight; }
    function str(v) { return v ? String(v) : ""; }
    function escapeHtml(t) {
        if (!t) return "";
        return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});
