(() => {
  if (window.__CTV_AI_DIRECTOR_LOADED__) return;
  window.__CTV_AI_DIRECTOR_LOADED__ = true;

  const DEFAULT_PROXY_URL = "https://URL-WORKER-KAMU.workers.dev/generate";
  const STORAGE_KEY = "ctv_ai_director_config_v1";

  const DEFAULT_CFG = {
    mode: "proxy",
    proxyUrl: DEFAULT_PROXY_URL,
    byokProvider: "gemini",
    geminiKey: "",
    geminiModel: "gemini-2.5-flash",
    openrouterKey: "",
    openrouterModel: "google/gemini-2.5-flash"
  };

  const state = {
    cfg: loadConfig(),
    view: "creator",
    panelTab: "create",
    aspect: "9:16",
    duration: 30,
    style: "Cinematic Storytelling",
    busy: false,
    skillContract: "",
    history: [],
    historyIndex: -1
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign({}, DEFAULT_CFG, JSON.parse(raw)) : Object.assign({}, DEFAULT_CFG);
    } catch (_) {
      return Object.assign({}, DEFAULT_CFG);
    }
  }

  function saveConfig() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cfg)); } catch (_) {}
  }

  async function loadSkillContract() {
    const candidates = ["../docs/skill.md", "docs/skill.md", "/assets/docs/skill.md", "skill.md"];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await fetch(candidates[i]);
        if (res.ok) {
          const txt = await res.text();
          if (txt && txt.length > 80) {
            state.skillContract = txt;
            return;
          }
        }
      } catch (_) {}
    }
    state.skillContract = [
      "Engine: Code-to-Video Studio Deterministic Canvas 2D WebWorker.",
      "Output HANYA satu blok kode JavaScript siap tempel diawali komentar /* studio-meta { JSON } */.",
      "Gunakan variabel injeksi read-only: ctx, W, H, S, t, D, p, frame, fps, P, ease.",
      "WAJIB 100% deterministik: DILARANG Math.random(), Date.now(), setTimeout, window, document, fetch, Image.",
      "WAJIB buat seeded hash lokal, isolasi ctx.save()/restore(), dan hindari ctx.filter/shadowBlur dalam loop.",
      "Pastikan tidak ada radius/scale negatif atau NaN, dan terapkan word-wrap serta safe area 9:16."
    ].join("\n");
  }

  function findEditorInput() {
    return (
      document.querySelector("#code-editor") ||
      document.querySelector("#editor-textarea") ||
      document.querySelector("textarea[data-code]") ||
      document.querySelector("#tab-editor textarea") ||
      document.querySelector("textarea")
    );
  }

  function getCurrentCode() {
    const el = findEditorInput();
    return el ? String(el.value || "") : "";
  }

  function injectCodeToApp(code, pushSnapshot) {
    const el = findEditorInput();
    if (el) {
      el.value = code;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (typeof window.applyCompositionCode === "function") {
      try { window.applyCompositionCode(code); } catch (_) {}
    }
    if (pushSnapshot) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(code);
      if (state.history.length > 10) state.history.shift();
      state.historyIndex = state.history.length - 1;
      updateUndoUI();
    }
    const runBtn =
      document.querySelector("#btn-run") ||
      document.querySelector("#btn-preview") ||
      document.querySelector("[data-action='run']");
    if (runBtn) runBtn.click();
  }

  function triggerNativeRender() {
    document.body.classList.add("ctv-rendering-safe");
    setCreatorOpen(false);
    if (typeof window.switchTab === "function") {
      try { window.switchTab("render"); } catch (_) {}
    } else {
      const tabRender = document.querySelector("#tab-render") || document.querySelector("[data-tab='render']");
      if (tabRender) tabRender.click();
    }
    setTimeout(() => {
      const observer = new MutationObserver(() => {
        const busy = document.querySelector(".rendering, [data-rendering='true']");
        if (!busy) document.body.classList.remove("ctv-rendering-safe");
      });
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class", "data-rendering"] });
    }, 800);
  }

  function extractJsCode(rawText) {
    const text = String(rawText || "").trim();
    const fence = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) return fence[1].trim();
    return text;
  }

  function validateDeterministicCode(code) {
    if (!code || code.length < 40) return "Kode terlalu pendek atau kosong.";
    const banned = [
      { re: /\bMath\.random\s*\(/, msg: "Menggunakan Math.random() yang dilarang (harus seeded hash)." },
      { re: /\b(window|document)\s*\./, msg: "Mengakses DOM (window/document) yang dilarang di WebWorker." },
      { re: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, msg: "Menggunakan timer non-deterministik." },
      { re: /\b(fetch|XMLHttpRequest)\b/, msg: "Mengakses jaringan di dalam kode render." },
      { re: /\bimport\s+.*\bfrom\b|\bexport\s+default\b/, msg: "Mengandung import/export ES module." }
    ];
    for (let i = 0; i < banned.length; i++) {
      if (banned[i].re.test(code)) return banned[i].msg;
    }
    try {
      new Function("ctx", "W", "H", "S", "t", "D", "p", "frame", "fps", "P", "ease", "ui", "fx", "d3", code);
    } catch (err) {
      return "SyntaxError: " + (err && err.message ? err.message : String(err));
    }
    return null;
  }

  async function callAI(systemPrompt, userPrompt) {
    const cfg = state.cfg;

    if (cfg.mode === "proxy") {
      if (!cfg.proxyUrl || cfg.proxyUrl.includes("USERNAME-KAMU")) {
        throw new Error("URL Proxy Mode Instan belum diisi. Buka ⚙️ AI untuk pasang URL Proxy atau pindah ke Mode Kunci Sendiri (BYOK).");
      }
      const res = await fetch(cfg.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userPrompt })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Server Mode Instan sibuk (HTTP " + res.status + ").");
      return data.text || "";
    }

    if (cfg.byokProvider === "gemini") {
      const key = (cfg.geminiKey || "").trim();
      if (!key) throw new Error("API Key Gemini belum diisi. Buka ⚙️ AI lalu tempel API Key gratis dari Google AI Studio.");
      const model = (cfg.geminiModel || "gemini-2.5-flash").trim();
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.55 }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error && data.error.message) || "Gagal panggil Gemini (HTTP " + res.status + ").");
      const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      return parts ? parts.map((x) => x.text || "").join("\n") : "";
    }

    const orKey = (cfg.openrouterKey || "").trim();
    if (!orKey) throw new Error("API Key OpenRouter belum diisi di ⚙️ AI.");
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + orKey,
        "HTTP-Referer": "https://codetovideostudio.app",
        "X-Title": "Code-to-Video Studio"
      },
      body: JSON.stringify({
        model: (cfg.openrouterModel || "google/gemini-2.5-flash").trim(),
        temperature: 0.55,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || "Gagal panggil OpenRouter (HTTP " + res.status + ").");
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  }

  function buildSystemPrompt() {
    return [
      "Kamu adalah Creative Coder & Motion Graphics Engineer khusus engine Code-to-Video Studio.",
      "TUGAS: Tulis HANYA SATU blok kode JavaScript murni siap tempel untuk Canvas 2D WebWorker deterministik.",
      "ATURAN ENGINE WAJIB:",
      state.skillContract,
      "",
      "STANDAR VISUAL:",
      "- Zero static holds (selalu ada micro-motion, camera drift, breathing, atau partikel deterministik).",
      "- Gunakan easing halus, kontras tipografi tinggi, word-wrap otomatis, dan safe area margin.",
      "- Jangan beri penjelasan panjang di luar blok kode."
    ].join("\n");
  }

  async function runGenerationFlow({ isRevision, promptText }) {
    if (state.busy) return;
    const cleanPrompt = String(promptText || "").trim();
    if (!cleanPrompt) {
      setStatus("Tulis dulu ide cerita atau instruksi revisinya ya.", "error");
      return;
    }

    state.busy = true;
    syncBusyUI(true);

    try {
      const sys = buildSystemPrompt();
      let userMsg = "";
      if (isRevision) {
        const curCode = getCurrentCode();
        if (!curCode || curCode.length < 30) throw new Error("Belum ada video aktif untuk direvisi. Buat video pertama dulu.");
        userMsg = [
          "Berikut kode video Code-to-Video Studio saat ini:",
          "```javascript",
          curCode,
          "```",
          "",
          "PERMINTAAN REVISI PENGGUNA:",
          cleanPrompt,
          "",
          "Pertahankan bagian yang sudah bagus, terapkan revisi dengan rapi, dan kembalikan SATU blok kode JavaScript penuh yang valid & deterministik."
        ].join("\n");
        setStatus("✨ Menerapkan revisi pada video...", "info");
      } else {
        userMsg = [
          "BUAT VIDEO BARU BERDASARKAN BRIEF PENGGUNA:",
          "- Rasio Aspek: " + state.aspect,
          "- Durasi: " + state.duration + " detik (30 FPS)",
          "- Gaya Visual: " + state.style,
          "- Cerita / Naskah / Ide Pengguna:",
          cleanPrompt,
          "",
          "Kembalikan HANYA satu blok kode JavaScript lengkap siap render."
        ].join("\n");
        setStatus("🎬 Merancang storyboard & animasi video...", "info");
      }

      let raw = await callAI(sys, userMsg);
      let code = extractJsCode(raw);

      for (let attempt = 1; attempt <= 2; attempt++) {
        const issue = validateDeterministicCode(code);
        if (!issue) break;
        setStatus("🛠️ Merapikan kode otomatis (Auto-Heal " + attempt + "/2)...", "info");
        const fixPrompt = [
          "Kode berikut gagal validasi WebWorker engine karena:",
          issue,
          "",
          "KODE YANG PERLU DIPERBAIKI:",
          "```javascript",
          code,
          "```",
          "",
          "Perbaiki error tersebut tanpa menghapus animasi utamanya. Kembalikan HANYA satu blok kode JavaScript valid."
        ].join("\n");
        raw = await callAI(sys, fixPrompt);
        code = extractJsCode(raw);
      }

      const finalIssue = validateDeterministicCode(code);
      if (finalIssue) throw new Error("Kode masih bermasalah setelah Auto-Heal: " + finalIssue);

      injectCodeToApp(code, true);
      setStatus("✅ Video siap diputar! Kamu bisa langsung revisi lewat chat di bawah atau Render MP4.", "ok");
      setTimeout(() => { if (!state.busy) setCreatorOpen(false); }, 1100);
    } catch (err) {
      setStatus("⚠️ " + (err && err.message ? err.message : String(err)), "error");
    } finally {
      state.busy = false;
      syncBusyUI(false);
    }
  }

  let els = {};

  function setStatus(msg, type) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.className = "ctv-status show" + (type === "error" ? " error" : type === "ok" ? " ok" : "");
  }

  function syncBusyUI(busy) {
    if (els.genBtn) {
      els.genBtn.disabled = busy;
      els.genBtn.textContent = busy ? "Sedang Meracik Video..." : "✨ Buat Video Sekarang";
    }
    if (els.revBtn) els.revBtn.disabled = busy;
  }

  function updateUndoUI() {
    if (!els.undoBtn) return;
    els.undoBtn.disabled = state.historyIndex <= 0;
    els.undoBtn.textContent = "↩️ Undo (" + Math.max(0, state.historyIndex) + ")";
  }

  function setCreatorOpen(open) {
    if (!els.overlay) return;
    if (open) {
      els.overlay.classList.add("open");
      if (els.miniBar) els.miniBar.classList.remove("show");
    } else {
      els.overlay.classList.remove("open");
      if (els.miniBar && state.view === "creator") els.miniBar.classList.add("show");
    }
  }

  function escapeAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function renderSettingsView() {
    const isProxy = state.cfg.mode === "proxy";
    const isGemini = state.cfg.byokProvider === "gemini";

    els.body.innerHTML = `
      <span class="ctv-label">Pilih Cara Kerja AI</span>
      <div class="ctv-arch-grid">
        <button class="ctv-arch-card ${isProxy ? "active" : ""}" id="ctv-opt-proxy" type="button">
          <h4>⚡ Mode Instan</h4>
          <p>Langsung pakai tanpa isi API Key. Cocok buat langsung bikin video tanpa ribet.</p>
        </button>
        <button class="ctv-arch-card ${!isProxy ? "active" : ""}" id="ctv-opt-byok" type="button">
          <h4>🔑 Kunci Sendiri</h4>
          <p>Pakai API Key gratis milikmu (Gemini / OpenRouter) biar kuota lebih lega.</p>
        </button>
      </div>

      ${isProxy ? `
        <span class="ctv-label">Alamat Server Proxy (Mode Instan)</span>
        <input class="ctv-input" id="ctv-proxy-url" type="url" placeholder="https://nama-worker.workers.dev/generate" value="${escapeAttr(state.cfg.proxyUrl)}" />
        <div class="ctv-guide-box">
          <strong>Info Mode Instan:</strong> Permintaan diproses lewat server perantara ringan tanpa perlu bikin akun AI. Kalau kuota server sedang ramai, kamu bisa pindah ke <strong>Kunci Sendiri</strong> kapan saja.
        </div>
      ` : `
        <span class="ctv-label">Penyedia AI (Kunci Sendiri)</span>
        <div class="ctv-row">
          <button class="ctv-chip ${isGemini ? "active" : ""}" id="ctv-prov-gemini" type="button">Google Gemini (Gratis)</button>
          <button class="ctv-chip ${!isGemini ? "active" : ""}" id="ctv-prov-or" type="button">OpenRouter</button>
        </div>

        ${isGemini ? `
          <span class="ctv-label">Gemini API Key</span>
          <input class="ctv-input" id="ctv-gem-key" type="password" placeholder="Tempel API Key (AIza...)" value="${escapeAttr(state.cfg.geminiKey)}" />
          <span class="ctv-label">Model Gemini</span>
          <input class="ctv-input" id="ctv-gem-model" type="text" value="${escapeAttr(state.cfg.geminiModel)}" />
          <div class="ctv-guide-box">
            <strong>Cara dapat API Key gratis (30 detik):</strong>
            <ol>
              <li>Buka <strong>aistudio.google.com/apikey</strong> di browser HP.</li>
              <li>Login akun Google, ketuk <strong>Create API Key</strong>.</li>
              <li>Salin kodenya dan tempel di atas. Kunci cuma disimpan aman di HP-mu.</li>
            </ol>
          </div>
        ` : `
          <span class="ctv-label">OpenRouter API Key</span>
          <input class="ctv-input" id="ctv-or-key" type="password" placeholder="Tempel API Key (sk-or-...)" value="${escapeAttr(state.cfg.openrouterKey)}" />
          <span class="ctv-label">Model OpenRouter</span>
          <input class="ctv-input" id="ctv-or-model" type="text" value="${escapeAttr(state.cfg.openrouterModel)}" />
        `}
      `}

      <button class="ctv-primary-btn" id="ctv-save-cfg" type="button">💾 Simpan Pengaturan AI</button>
    `;

    els.body.querySelector("#ctv-opt-proxy").onclick = () => { state.cfg.mode = "proxy"; saveConfig(); renderSettingsView(); };
    els.body.querySelector("#ctv-opt-byok").onclick = () => { state.cfg.mode = "byok"; saveConfig(); renderSettingsView(); };
    const pGem = els.body.querySelector("#ctv-prov-gemini");
    const pOr = els.body.querySelector("#ctv-prov-or");
    if (pGem) pGem.onclick = () => { state.cfg.byokProvider = "gemini"; saveConfig(); renderSettingsView(); };
    if (pOr) pOr.onclick = () => { state.cfg.byokProvider = "openrouter"; saveConfig(); renderSettingsView(); };

    els.body.querySelector("#ctv-save-cfg").onclick = () => {
      const pu = els.body.querySelector("#ctv-proxy-url");
      const gk = els.body.querySelector("#ctv-gem-key");
      const gm = els.body.querySelector("#ctv-gem-model");
      const ok = els.body.querySelector("#ctv-or-key");
      const om = els.body.querySelector("#ctv-or-model");
      if (pu) state.cfg.proxyUrl = pu.value.trim();
      if (gk) state.cfg.geminiKey = gk.value.trim();
      if (gm && gm.value.trim()) state.cfg.geminiModel = gm.value.trim();
      if (ok) state.cfg.openrouterKey = ok.value.trim();
      if (om && om.value.trim()) state.cfg.openrouterModel = om.value.trim();
      saveConfig();
      state.panelTab = "create";
      renderCreatorView();
      setStatus("✅ Pengaturan AI tersimpan (" + (state.cfg.mode === "proxy" ? "Mode Instan" : "Kunci Sendiri") + ").", "ok");
    };
  }

  function renderCreatorView() {
    const modeBadge = state.cfg.mode === "proxy" ? "⚡ Mode Instan" : "🔑 Kunci Sendiri";
    const styles = ["Cinematic Storytelling", "Swiss Archival Blueprint", "Minimalist Kinetic", "3D Dark Editorial"];
    const aspects = ["9:16", "16:9", "1:1"];
    const durs = [15, 30, 60];

    els.body.innerHTML = `
      <div class="ctv-row" style="justify-content:space-between; margin-top:0;">
        <span class="ctv-badge">${modeBadge}</span>
        <label class="ctv-icon-btn" style="cursor:pointer;">
          📄 Impor Naskah (.txt/.md)
          <input id="ctv-file-in" type="file" accept=".txt,.md,text/plain" style="display:none;" />
        </label>
      </div>

      <span class="ctv-label">Ceritakan Video yang Kamu Mau</span>
      <textarea class="ctv-textarea" id="ctv-prompt" placeholder="Contoh: Buatkan video 30 detik tentang kebun dapur 1 meter persegi, mulai dari pot kosong, denah 3 zona, sampai panen masuk dapur..."></textarea>

      <span class="ctv-label">Rasio & Durasi</span>
      <div class="ctv-row">
        ${aspects.map((a) => `<button type="button" class="ctv-chip ${state.aspect === a ? "active" : ""}" data-aspect="${a}">${a}</button>`).join("")}
        ${durs.map((d) => `<button type="button" class="ctv-chip ${state.duration === d ? "active" : ""}" data-dur="${d}">${d} Detik</button>`).join("")}
      </div>

      <span class="ctv-label">Gaya Visual</span>
      <div class="ctv-row">
        ${styles.map((s) => `<button type="button" class="ctv-chip ${state.style === s ? "active" : ""}" data-style="${s}">${s}</button>`).join("")}
      </div>

      <button class="ctv-primary-btn" id="ctv-gen-btn" type="button">✨ Buat Video Sekarang</button>
      <div class="ctv-status" id="ctv-status"></div>

      <div class="ctv-revision-box">
        <span class="ctv-label" style="margin-top:0;">Revisi Cepat (Ubah Tanpa Ulang dari Nol)</span>
        <div class="ctv-rev-row">
          <input class="ctv-input" id="ctv-rev-input" type="text" placeholder="Contoh: ganti warna lebih hangat, teks diperbesar..." />
          <button class="ctv-icon-btn" id="ctv-rev-btn" type="button" style="white-space:nowrap;">Kirim</button>
        </div>
        <div class="ctv-row" style="justify-content:space-between;">
          <button class="ctv-icon-btn" id="ctv-undo-btn" type="button">↩️ Undo (0)</button>
          <button class="ctv-icon-btn" id="ctv-render-now" type="button" style="border-color:rgba(124,227,176,0.5); color:#8CE8B9;">🎬 Render MP4</button>
        </div>
      </div>
    `;

    els.prompt = els.body.querySelector("#ctv-prompt");
    els.genBtn = els.body.querySelector("#ctv-gen-btn");
    els.status = els.body.querySelector("#ctv-status");
    els.revInput = els.body.querySelector("#ctv-rev-input");
    els.revBtn = els.body.querySelector("#ctv-rev-btn");
    els.undoBtn = els.body.querySelector("#ctv-undo-btn");

    els.body.querySelectorAll("[data-aspect]").forEach((b) => { b.onclick = () => { state.aspect = b.dataset.aspect; renderCreatorView(); }; });
    els.body.querySelectorAll("[data-dur]").forEach((b) => { b.onclick = () => { state.duration = Number(b.dataset.dur); renderCreatorView(); }; });
    els.body.querySelectorAll("[data-style]").forEach((b) => { b.onclick = () => { state.style = b.dataset.style; renderCreatorView(); }; });

    const fileIn = els.body.querySelector("#ctv-file-in");
    fileIn.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (els.prompt) els.prompt.value = String(reader.result || "").slice(0, 8000);
        setStatus("📄 Naskah '" + f.name + "' berhasil dimuat!", "ok");
      };
      reader.readAsText(f);
    };

    els.genBtn.onclick = () => runGenerationFlow({ isRevision: false, promptText: els.prompt.value });
    els.revBtn.onclick = () => runGenerationFlow({ isRevision: true, promptText: els.revInput.value });
    els.undoBtn.onclick = () => {
      if (state.historyIndex > 0) {
        state.historyIndex -= 1;
        injectCodeToApp(state.history[state.historyIndex], false);
        updateUndoUI();
        setStatus("↩️ Kembali ke versi video sebelumnya.", "ok");
      }
    };
    els.body.querySelector("#ctv-render-now").onclick = triggerNativeRender;

    updateUndoUI();
    syncBusyUI(state.busy);
  }

  function mountUI() {
    const pill = document.createElement("div");
    pill.className = "ctv-mode-pill ctv-glass";
    pill.innerHTML = `
      <button type="button" class="ctv-mode-btn active" id="ctv-m-creator">✨ Kreator</button>
      <button type="button" class="ctv-mode-btn" id="ctv-m-pro">&lt;/&gt; Pro</button>
    `;
    document.body.appendChild(pill);

    const mini = document.createElement("div");
    mini.className = "ctv-mini-bar ctv-glass";
    mini.innerHTML = `
      <button type="button" class="ctv-icon-btn" id="ctv-mini-open">✨ Tulis / Revisi Video</button>
      <button type="button" class="ctv-icon-btn" id="ctv-mini-render" style="color:#8CE8B9;">🎬 Render</button>
    `;
    document.body.appendChild(mini);
    els.miniBar = mini;

    const overlay = document.createElement("div");
    overlay.className = "ctv-overlay";
    overlay.innerHTML = `
      <div class="ctv-sheet ctv-glass">
        <div class="ctv-sheet-head">
          <div class="ctv-sheet-title">✨ AI Video Director</div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="ctv-icon-btn" id="ctv-btn-settings">⚙️ AI</button>
            <button type="button" class="ctv-icon-btn" id="ctv-btn-close">✕</button>
          </div>
        </div>
        <div id="ctv-sheet-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    els.overlay = overlay;
    els.body = overlay.querySelector("#ctv-sheet-body");

    const btnCreator = pill.querySelector("#ctv-m-creator");
    const btnPro = pill.querySelector("#ctv-m-pro");
    btnCreator.onclick = () => {
      state.view = "creator";
      btnCreator.classList.add("active");
      btnPro.classList.remove("active");
      state.panelTab = "create";
      renderCreatorView();
      setCreatorOpen(true);
    };
    btnPro.onclick = () => {
      state.view = "pro";
      btnPro.classList.add("active");
      btnCreator.classList.remove("active");
      setCreatorOpen(false);
      mini.classList.remove("show");
    };

    overlay.querySelector("#ctv-btn-close").onclick = () => setCreatorOpen(false);
    overlay.querySelector("#ctv-btn-settings").onclick = () => {
      state.panelTab = state.panelTab === "settings" ? "create" : "settings";
      if (state.panelTab === "settings") renderSettingsView();
      else renderCreatorView();
    };
    mini.querySelector("#ctv-mini-open").onclick = () => {
      state.panelTab = "create";
      renderCreatorView();
      setCreatorOpen(true);
    };
    mini.querySelector("#ctv-mini-render").onclick = triggerNativeRender;

    renderCreatorView();
    setTimeout(() => setCreatorOpen(true), 350);
  }

  const boot = () => { loadSkillContract(); mountUI(); };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
