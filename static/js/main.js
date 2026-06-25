/**
 * TruthLens Enterprise Client Engine
 * SOC2 & Compliance Stream UI
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

    // Textarea resize
    questionInput.addEventListener("input", () => {
        questionInput.style.height = "auto";
        questionInput.style.height = Math.min(questionInput.scrollHeight, 140) + "px";
    });

    // Upload
    dropZone.addEventListener("click", () => pdfInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "#525866"; });
    dropZone.addEventListener("dragleave", (e) => { e.preventDefault(); dropZone.style.borderColor = ""; });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault(); dropZone.style.borderColor = "";
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    pdfInput.addEventListener("change", () => { if (pdfInput.files[0]) processFile(pdfInput.files[0]); });

    async function processFile(file) {
        if (!file.name.toLowerCase().endsWith(".pdf")) return showError("Invalid file type. Only PDF documents are accepted.");
        if (file.size > 50 * 1024 * 1024) return showError("File exceeds 50MB payload limit.");

        hideError();
        dropContent.classList.add("hidden");
        uploadProgress.classList.remove("hidden");

        const fd = new FormData();
        fd.append("file", file);

        try {
            const res = await fetch("/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Processing failure");

            currentDocId = data.doc_id;
            activeFilename.textContent = file.name;
            pillFilename.textContent = file.name;
            activeMeta.textContent = `(${data.pages} pages • ${data.chunks} indexed chunks)`;

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
        chatStream.innerHTML = `
            <div class="msg-row system">
                <div class="icon-avatar sys">⚡</div>
                <div class="card system-card">
                    <p>Session reset. Select a document above to evaluate.</p>
                </div>
            </div>
        `;
    });

    // Q&A
    askBtn.addEventListener("click", executeQuery);
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeQuery(); }
    });

    async function executeQuery() {
        const q = questionInput.value.trim();
        if (!q || askBtn.disabled) return;

        const isRogue = rogueModeToggle ? rogueModeToggle.checked : false;

        questionInput.value = "";
        questionInput.style.height = "auto";
        askBtn.disabled = true;

        appendRow("usr", q);

        const loaderId = "ldr_" + Date.now();
        const ldrRow = document.createElement("div");
        ldrRow.className = "msg-row assistant";
        ldrRow.id = loaderId;
        ldrRow.innerHTML = `
            <div class="icon-avatar">AI</div>
            <div class="card">
                <div class="loading-state" style="justify-content:flex-start;color:#ededed;">
                    <div class="spinner-zinc"></div>
                    <span>${isRogue ? "Simulating unverified response & checking compliance..." : "Retrieving passages & auditing atomic claims..."}</span>
                </div>
            </div>
        `;
        chatStream.appendChild(ldrRow);
        scrollBottom();

        try {
            const res = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doc_id: currentDocId, question: q, rogue_mode: isRogue })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Execution error");

            const ldrElem = document.getElementById(loaderId);
            if (ldrElem) ldrElem.remove();

            renderComplianceCard(data.answer, data.trust_score, data.claims, isRogue);

        } catch (err) {
            const ldrElem = document.getElementById(loaderId);
            if (ldrElem) {
                ldrElem.innerHTML = `
                    <div class="icon-avatar">AI</div>
                    <div class="card" style="border-color:#ef4444;color:#ef4444;">
                        <p>System Error: ${escapeHtml(err.message)}</p>
                    </div>
                `;
            }
        } finally {
            askBtn.disabled = false;
            scrollBottom();
        }
    }

    function appendRow(role, txt) {
        const row = document.createElement("div");
        row.className = `msg-row ${role === 'usr' ? 'user' : 'assistant'}`;
        row.innerHTML = `
            <div class="icon-avatar ${role === 'usr' ? 'usr' : ''}">${role === 'usr' ? 'U' : 'AI'}</div>
            <div class="card ${role === 'usr' ? 'user-card' : ''}">
                <p>${escapeHtml(txt).replace(/\n/g, '<br>')}</p>
            </div>
        `;
        chatStream.appendChild(row);
        scrollBottom();
    }

    function renderComplianceCard(ans, score, claims, isRogue) {
        const pct = Math.round(score * 100);
        let pillCls = "pill-red"; let pillTxt = `${pct}% COMPLIANT • UNVERIFIED`;

        if (pct >= 80) { pillCls = "pill-green"; pillTxt = `${pct}% COMPLIANT • VERIFIED`; }
        else if (pct >= 50) { pillCls = "pill-amber"; pillTxt = `${pct}% COMPLIANT • REVIEW`; }

        const boxCls = (pct < 60 || isRogue) ? "compliance-box hallucinated" : "compliance-box";

        let claimsHtml = "";
        claims.forEach(c => {
            const v = str(c.verdict).toUpperCase();
            let rowCls = "hallucinated"; let hdrTxt = "❌ Hallucinated";
            if (v.includes("SUPPORTED")) { rowCls = "supported"; hdrTxt = "✅ Supported"; }
            else if (v.includes("PARTIAL")) { rowCls = "partial"; hdrTxt = "⚠️ Partial"; }

            claimsHtml += `
                <div class="claim-row ${rowCls}">
                    <div class="claim-hdr ${rowCls}">
                        <span>${hdrTxt}</span>
                        <span>Page ${escapeHtml(c.source_page || "N/A")}</span>
                    </div>
                    <div class="q-text">"${escapeHtml(c.claim)}"</div>
                    <div class="r-text">${escapeHtml(c.reasoning || "")}</div>
                </div>
            `;
        });

        const row = document.createElement("div");
        row.className = "msg-row assistant";
        row.innerHTML = `
            <div class="icon-avatar">AI</div>
            <div class="card">
                <div style="margin-bottom:1.25rem;">
                    ${escapeHtml(ans).replace(/\n/g, '<br>')}
                </div>

                <div class="${boxCls}">
                    <div class="cb-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div class="cb-left">
                            <span>🛡️</span>
                            <span>Sentence Attribution & Audit Log</span>
                            <span class="status-pill-ent ${pillCls}">${pillTxt}</span>
                        </div>
                        <span style="color:#878c93;font-size:0.75rem;">${claims.length} claims ▼</span>
                    </div>
                    <div class="cb-content">
                        ${claimsHtml}
                    </div>
                </div>
            </div>
        `;
        chatStream.appendChild(row);
        scrollBottom();
    }

    function scrollBottom() { chatStream.scrollTop = chatStream.scrollHeight; }
    function str(v) { return v ? String(v) : ""; }
    function escapeHtml(t) {
        if (!t) return "";
        return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});
