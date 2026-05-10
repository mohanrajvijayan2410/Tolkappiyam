"use strict";

(() => {
  const state = {
    theme: "",
    canonical: "",
    startNode: "",
    selectedNode: "",
    lastQuery: "",
    explanation: "",
  };

  const translationCache = new Map();

  function t(key, vars) {
    if (window.i18n && typeof window.i18n.t === "function") return window.i18n.t(key, vars);
    return key;
  }

  function getLang() {
    if (window.i18n && typeof window.i18n.getLanguage === "function") return window.i18n.getLanguage();
    return "en";
  }

  function nodeName(node) {
    if (window.i18n && typeof window.i18n.getNodeDisplayName === "function") return window.i18n.getNodeDisplayName(node);
    return node?.id || "";
  }

  async function translateOnce(text, targetLang) {
    const lang = String(targetLang || "en").trim().toLowerCase();
    const src = String(text ?? "");
    if (!src || lang === "en") return src;

    // If the string already contains Tamil, skip auto-translation.
    if (/[\u0B80-\u0BFF]/.test(src)) return src;

    const cacheKey = `${lang}::${src}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    const res = await fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: lang, source: "English", texts: [src] }),
    });

    const payload = await res.json().catch(() => null);
    const out = (res.ok && payload && Array.isArray(payload.translations)) ? String(payload.translations[0] ?? "") : "";
    const finalText = out || src;
    translationCache.set(cacheKey, finalText);
    return finalText;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeNewlines(value) {
    return String(value ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  }

  function splitExplanation(raw) {
    const text = normalizeNewlines(raw).trim();
    if (!text) return [];

    const enMarker = "English Explanation:";
    const taMarker = "Tamil Explanation:";

    const enPos = text.indexOf(enMarker);
    const taPos = text.indexOf(taMarker);

    if (enPos !== -1 && taPos !== -1) {
      const firstIsEn = enPos < taPos;
      const enBody = firstIsEn
        ? text.slice(enPos + enMarker.length, taPos).trim()
        : text.slice(enPos + enMarker.length).trim();
      const taBody = firstIsEn
        ? text.slice(taPos + taMarker.length).trim()
        : text.slice(taPos + taMarker.length, enPos).trim();

      return [
        { title: t("explanation_card_en"), body: enBody },
        { title: t("explanation_card_ta"), body: taBody },
      ].filter((s) => s.body);
    }

    if (enPos !== -1) {
      return [{ title: t("explanation_card_en"), body: text.slice(enPos + enMarker.length).trim() }];
    }
    if (taPos !== -1) {
      return [{ title: t("explanation_card_ta"), body: text.slice(taPos + taMarker.length).trim() }];
    }

    const genericMarker = "Explanation:";
    const gPos = text.indexOf(genericMarker);
    const body = gPos !== -1 ? text.slice(gPos + genericMarker.length).trim() : text;
    return [{ title: t("explanation_card_generic"), body }];
  }

  function headingFromLine(line) {
    const l = String(line ?? "").trim();
    if (!l) return null;

    const patterns = [
      /^Concept Meaning\s*:\s*$/i,
      /^Literary Context\s*:\s*$/i,
      /^Cultural\s*\/\s*Ethical Significance\s*:\s*$/i,
      /^Tamil Explanation\s*:\s*$/i,
      /^English Explanation\s*:\s*$/i,
      /^கருத்தின் பொருள்\s*:\s*$/,
      /^இலக்கியச் சூழல்\s*:\s*$/,
      /^பண்பாட்டு\s*\/\s*அறநெறி\s*முக்கியத்துவம்\s*:\s*$/,
    ];

    for (const re of patterns) {
      if (re.test(l)) return l.replace(/\s*:\s*$/, "");
    }
    return null;
  }

  function splitStructuredBlocks(body) {
    const text = normalizeNewlines(body).trim();
    if (!text) return [];

    const lines = text.split("\n");
    const blocks = [];
    let current = { title: "", lines: [] };
    let sawHeading = false;

    function flush() {
      const b = (current.lines.join("\n") || "").trim();
      const title = String(current.title || "").trim();
      if (b) blocks.push({ title, body: b });
      current = { title: "", lines: [] };
    }

    for (const line of lines) {
      const title = headingFromLine(line);
      if (title) {
        sawHeading = true;
        flush();
        current.title = title;
        continue;
      }
      current.lines.push(line);
    }
    flush();

    if (!sawHeading) return [{ title: "", body: text }];
    return blocks;
  }

  function renderStructuredBody(body) {
    const blocks = splitStructuredBlocks(body);
    if (!blocks.length) return "";

    const inner = blocks
      .map((b) => `
        <div class="explanation-block">
          ${b.title ? `<div class="explanation-block-title">${escapeHtml(b.title)}</div>` : ""}
          <div class="explanation-block-body">${escapeHtml(b.body)}</div>
        </div>
      `)
      .join("");

    return `<div class="explanation-block-stack">${inner}</div>`;
  }

  function renderExplanationCards(raw) {
    const sections = splitExplanation(raw);
    const cards = (sections.length ? sections : [{ title: t("explanation_card_generic"), body: t("no_explanation") }])
      .map((s) => `
        <div class="explanation-card">
          <div class="explanation-card-title">${escapeHtml(s.title || "")}</div>
          <div class="explanation-card-body">${renderStructuredBody(s.body || "")}</div>
        </div>
      `)
      .join("");

    return `<div class="explanation-stack">${cards}</div>`;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(text ?? "");
  }

  function toId(v) {
    if (typeof window.toNodeId === "function") return window.toNodeId(v);
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object" && (typeof v.id === "string" || typeof v.id === "number")) return String(v.id);
    return null;
  }

  function computeDegree(links, nodeId) {
    if (!nodeId || !Array.isArray(links)) return 0;
    let degree = 0;
    for (const l of links) {
      const s = toId(l?.source);
      const tt = toId(l?.target);
      if (s === nodeId || tt === nodeId) degree++;
    }
    return degree;
  }

  function updateSelectedDegree(nodeId, links) {
    if (!nodeId) {
      setText("statDegree", "—");
      setText("statDegreeLabel", t("stat_no_node_selected"));
      return;
    }

    const degree = computeDegree(links, nodeId);
    setText("statDegree", degree);

    const labelNode = (typeof getNodeById === "function") ? getNodeById(nodeId) : null;
    setText("statDegreeLabel", nodeName(labelNode || { id: nodeId }) || nodeId);
  }

  function updateCategoryDistribution(graph) {
    const distEl = document.getElementById("categoryDist");
    if (!distEl) return;

    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    if (!nodes.length) {
      distEl.innerHTML = `<div class="dist-empty">${escapeHtml(t("dist_empty"))}</div>`;
      return;
    }

    const counts = { thinai: 0, akam: 0, puram: 0, grammar: 0, ethics: 0, default: 0 };
    for (const n of nodes) {
      const cat = (typeof window.getCategory === "function") ? window.getCategory(n) : "default";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }

    const order = ["thinai", "akam", "puram", "grammar", "ethics", "default"];
    const total = nodes.length;

    const catLabel = (key) => {
      if (key === "thinai") return t("legend_thinai");
      if (key === "akam") return t("legend_akam");
      if (key === "puram") return t("legend_puram");
      if (key === "grammar") return t("legend_grammar");
      if (key === "ethics") return t("legend_ethics_culture");
      return t("legend_concept");
    };

    let catMap = null;
    try { catMap = CATEGORIES; } catch { catMap = null; }

    const items = order.map((key) => {
      const meta = (catMap && catMap[key]) ? catMap[key] : { color: "#0ea5e9" };
      const count = counts[key] ?? 0;
      const pct = Math.round((count / total) * 100);
      const label = catLabel(key);

      return `
        <div class="dist-item" data-cat="${escapeHtml(key)}">
          <span class="dist-swatch" style="background:${escapeHtml(meta.color)};"></span>
          <span class="dist-label">${escapeHtml(label)}</span>
          <div class="dist-bar" aria-label="${escapeHtml(label)} ${pct}%">
            <div class="dist-fill" style="width:${pct}%;background:${escapeHtml(meta.color)};"></div>
          </div>
          <span class="dist-count">${count}</span>
        </div>
      `;
    }).join("");

    distEl.innerHTML = items;
  }

  function updateGraphAnalytics(graph) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const links = Array.isArray(graph?.links) ? graph.links : [];
    setText("statNodes", nodes.length);
    setText("statLinks", links.length);
    updateCategoryDistribution(graph);
    updateSelectedDegree(state.selectedNode, links);
  }

  function renderEvidenceBlock(node) {
    const bodyEl = document.getElementById("modalBody");
    if (!bodyEl) return;

    bodyEl.querySelector(".evidence-block")?.remove();

    const ev = (node && typeof node === "object") ? (node.evidence || {}) : {};
    const rowId = (node && typeof node === "object") ? (node.row_id || "") : "";

    const sourceSection = ev.source_section || "";
    const sutraRef = ev.sutra_reference || "";
    const sourceRef = ev.source_reference || "";
    const extracted = ev.extracted_sentence || "";

    const hasAny = Boolean(sourceSection || sutraRef || sourceRef || extracted || rowId);

    const empty = `<span class="evidence-empty">${escapeHtml(t("evidence_not_available"))}</span>`;
    const v = (text) => text ? escapeHtml(text) : empty;

    const html = `
      <div class="evidence-block">
        <div class="evidence-title">
          <h4>${escapeHtml(t("evidence_title"))}</h4>
        </div>
        ${hasAny ? `
          <div class="evidence-grid">
            <div class="evidence-item">
              <div class="evidence-k">${escapeHtml(t("evidence_source_section"))}</div>
              <div class="evidence-v">${v(sourceSection)}</div>
            </div>
            <div class="evidence-item">
              <div class="evidence-k">${escapeHtml(t("evidence_sutra_reference"))}</div>
              <div class="evidence-v">${v(sutraRef)}</div>
            </div>
            <div class="evidence-item">
              <div class="evidence-k">${escapeHtml(t("evidence_source_reference"))}</div>
              <div class="evidence-v">${v(sourceRef)}</div>
            </div>
            <div class="evidence-item">
              <div class="evidence-k">${escapeHtml(t("evidence_extracted_sentence"))}</div>
              <div class="evidence-v">${v(extracted)}</div>
            </div>
            <div class="evidence-item">
              <div class="evidence-k">${escapeHtml(t("evidence_row_id"))}</div>
              <div class="evidence-v">${rowId ? `<code>${escapeHtml(rowId)}</code>` : empty}</div>
            </div>
          </div>
        ` : `<div class="evidence-empty">${escapeHtml(t("evidence_no_metadata"))}</div>`}
      </div>
    `;

    bodyEl.insertAdjacentHTML("beforeend", html);
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      throw new Error(t("error_non_json"));
    }
    if (!res.ok) {
      throw new Error(data?.error || t("error_request_failed", { status: res.status }));
    }
    return data;
  }

  async function svgToPngDataUrl(svgEl, opts) {
    const el = svgEl;
    if (!el) return "";

    const options = opts && typeof opts === "object" ? opts : {};
    const scale = Number(options.scale ?? 2);
    const background = String(options.background ?? "#ffffff");

    const width = Number(el.getAttribute("width")) || el.clientWidth || 1200;
    const height = Number(el.getAttribute("height")) || el.clientHeight || 800;

    const serializer = new XMLSerializer();
    let svgText = serializer.serializeToString(el);

    if (!/^<svg[^>]+xmlns=/.test(svgText)) {
      svgText = svgText.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/^<svg[^>]+xmlns:xlink=/.test(svgText)) {
      svgText = svgText.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    try {
      const fontUi = getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim();
      if (fontUi) {
        const safeFontUi = fontUi.replaceAll("\"", "");
        svgText = svgText.replaceAll("var(--font-ui)", safeFontUi);
      }
    } catch {}

    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(""); return; }
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve("");
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("");
      };
      img.src = url;
    });
  }

  async function exportPdf() {
    if (!state.lastQuery) {
      alert(t("alert_enter_query"));
      return;
    }

    const btn = document.getElementById("exportPdfBtn");
    const prevText = btn?.textContent || "PDF";
    const prevTitle = btn?.getAttribute("title") || "";

    try {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.textContent = "…";
        btn.setAttribute("title", t("loading_traversing"));
      }

      const svgEl = document.getElementById("graph");
      const graphImage = await svgToPngDataUrl(svgEl, { scale: 2, background: "#ffffff" });

      const focal = state.selectedNode || state.startNode || state.canonical || "";
      let cognitive = null;
      if (focal) {
        try {
          cognitive = await postJson("/cognitive", {
            concept: focal,
            theme: state.theme,
            canonical: state.canonical,
          });
        } catch {}
      }

      const payload = {
        query: state.lastQuery,
        theme: state.theme,
        canonical: state.canonical,
        language: getLang(),
        focal,
        explanation: state.explanation || "",
        graph: (() => {
          const g = currentGraphData || {};
          const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
          const links = Array.isArray(g?.links) ? g.links : [];
          return {
            meta: (g && typeof g === "object" && g.meta && typeof g.meta === "object") ? { ...g.meta } : {},
            nodes: nodes.map((n) => ({
              id: n?.id ?? "",
              tamil_label: n?.tamil_label ?? "",
              category: n?.category ?? "",
              description: n?.description ?? "",
              evidence: n?.evidence ?? {},
              row_id: n?.row_id ?? "",
            })),
            links: links.map((l) => ({
              source: toId(l?.source) ?? "",
              target: toId(l?.target) ?? "",
              relation: l?.relation ?? "",
              evidence: l?.evidence ?? {},
              row_id: l?.row_id ?? "",
            })),
          };
        })(),
        graph_image: graphImage || "",
        cognitive,
      };

      const res = await fetch("/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        let message = "";
        try { message = JSON.parse(text)?.error || ""; } catch {}
        throw new Error(message || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";

      let filename = "tolkappiyam-report.pdf";
      const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(cd);
      const rawName = match ? (match[1] || match[2] || "") : "";
      if (rawName) filename = decodeURIComponent(rawName);

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = prevText;
        if (prevTitle) btn.setAttribute("title", prevTitle);
      }
    }
  }
    
  window.exportPdf = exportPdf;

  function translateDimensionLabel(label) {
    const raw = String(label || "").trim();
    if (!raw) return t("cognitive_dimension");

    if (getLang() !== "ta") return raw;

    const map = {
      Emotion: "உணர்வு",
      Ethics: "அறம்",
      Society: "சமூகம்",
      Landscape: "நிலப்பரப்பு",
      Language: "மொழி",
    };
    return map[raw] || raw;
  }

  function renderCognitiveArchitecture(model) {
    setText("cognitiveTitle", t("cognitive_title"));

    const subtitleParts = [];
    if (model?.focal) subtitleParts.push(`${t("cognitive_focal")}: ${model.focal}`);
    if (model?.theme) subtitleParts.push(`${t("meta_theme")}: ${model.theme}`);
    if (model?.canonical) subtitleParts.push(`${t("meta_canonical")}: ${model.canonical}`);
    const subtitleEl = document.getElementById("cognitiveSubtitle");
    if (subtitleEl) subtitleEl.textContent = subtitleParts.join(" • ");

    const dimsEl = document.getElementById("cognitiveDimensions");
    const relEl = document.getElementById("cognitiveRelations");
    const noteEl = document.getElementById("cognitiveNote");
    if (!dimsEl || !relEl || !noteEl) return;

    const dims = Array.isArray(model?.dimensions) ? model.dimensions : [];
    dimsEl.innerHTML = dims.map((d) => {
      const label = escapeHtml(translateDimensionLabel(d.dimension));
      const w = Math.max(0, Math.min(1, Number(d.weight ?? 0)));
      const pct = Math.round(w * 100);
      return `
        <div class="dim-row">
          <div class="dim-label">${label}</div>
          <div class="dim-bar"><div class="dim-fill" style="width:${pct}%;"></div></div>
          <div class="dim-val">${pct}%</div>
        </div>
      `;
    }).join("") || `<div class="evidence-empty">${escapeHtml(t("cognitive_no_dimensions"))}</div>`;

    const rels = Array.isArray(model?.relations) ? model.relations : [];
    relEl.innerHTML = rels.map((r) => {
      const relation = escapeHtml(String(r.relation || "").replaceAll("_", " "));
      const target = escapeHtml(r.target || "—");
      const w = Math.max(0, Math.min(1, Number(r.weight ?? 0)));
      const pct = Math.round(w * 100);
      const wTxt = w.toFixed(2);
      const basis = r.basis || {};
      const basisParts = [basis.type || "source"];
      if (basis.relation) basisParts.push(basis.relation);
      else if (basis.field) basisParts.push(basis.field);
      const basisStr = escapeHtml(basisParts.join(" • "));
      const srcRef = r?.evidence?.source_reference ? ` • ${escapeHtml(r.evidence.source_reference)}` : "";
      return `
        <div class="rel-item">
          <div class="rel-head">
            <div class="rel-title">${relation} → ${target}</div>
            <div class="rel-weight">${wTxt}</div>
          </div>
          <div class="rel-sub">${basisStr}${srcRef} • ${pct}%</div>
        </div>
      `;
    }).join("") || `<div class="evidence-empty">${escapeHtml(t("cognitive_no_relations"))}</div>`;

    noteEl.textContent = model?.note || t("cognitive_strength_note");
  }

  async function openCognitiveModal() {
    const modal = document.getElementById("cognitiveModal");
    if (!modal) return;

    const focal = state.selectedNode || state.startNode;
    if (!focal) {
      alert(t("alert_select_node_first"));
      return;
    }

    modal.style.display = "block";

    const dimsEl = document.getElementById("cognitiveDimensions");
    const relEl = document.getElementById("cognitiveRelations");
    const noteEl = document.getElementById("cognitiveNote");
    if (dimsEl) dimsEl.innerHTML = `<div class="empty-state"><div class="loading-ring"></div><div class="empty-state-text">${escapeHtml(t("cognitive_loading_dimensions"))}</div></div>`;
    if (relEl) relEl.innerHTML = `<div class="empty-state"><div class="loading-ring"></div><div class="empty-state-text">${escapeHtml(t("cognitive_loading_relations"))}</div></div>`;
    if (noteEl) noteEl.textContent = "";

    try {
      const model = await postJson("/cognitive", {
        concept: focal,
        theme: state.theme,
        canonical: state.canonical,
      });
      renderCognitiveArchitecture(model);
    } catch (e) {
      const msg = e?.message || String(e);
      if (dimsEl) dimsEl.innerHTML = `<div class="evidence-empty">${escapeHtml(t("error_prefix"))} ${escapeHtml(msg)}</div>`;
      if (relEl) relEl.innerHTML = "";
      if (noteEl) noteEl.textContent = "";
    }
  }

  function closeCognitiveModal() {
    const modal = document.getElementById("cognitiveModal");
    if (modal) modal.style.display = "none";
  }

  // ---------------- Tamil Arivu Guide ----------------
  const GUIDE_VOICE_KEY = "tolkappiyam.guide_voice";
  const guideState = {
    dialog: [],
    runId: 0,
    lastPayloadKey: "",
    voiceEnabled: true,
  };
  guideState.voiceEnabled = loadVoicePreference();

  function isVoiceSupported() {
    return typeof window !== "undefined"
      && "speechSynthesis" in window
      && typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  function loadVoicePreference() {
    try {
      const raw = localStorage.getItem(GUIDE_VOICE_KEY);
      if (raw === null) return true;
      return raw === "1" || raw === "true" || raw === "on";
    } catch {
      return true;
    }
  }

  function saveVoicePreference(enabled) {
    try { localStorage.setItem(GUIDE_VOICE_KEY, enabled ? "1" : "0"); } catch {}
  }

  function updateGuideVoiceButton() {
    const btn = document.getElementById("guideVoiceToggle");
    if (!btn) return;

    if (!isVoiceSupported()) {
      btn.textContent = t("guide_voice_unavailable");
      btn.disabled = true;
      btn.style.opacity = "0.65";
      return;
    }

    btn.disabled = false;
    btn.style.opacity = "";
    btn.textContent = guideState.voiceEnabled ? t("guide_voice_on") : t("guide_voice_off");
  }

  function cancelGuideSpeech() {
    try {
      if (isVoiceSupported()) window.speechSynthesis.cancel();
    } catch {}
  }

  function setGuideSpeaking(speaker) {
    const modal = document.getElementById("guideModal");
    if (!modal) return;
    const male = modal.querySelector(".guide-character.guide-male");
    const female = modal.querySelector(".guide-character.guide-female");
    if (male) male.classList.toggle("speaking", speaker === "male");
    if (female) female.classList.toggle("speaking", speaker === "female");
  }

  function stopGuidePlayback() {
    guideState.runId += 1;
    cancelGuideSpeech();
    setGuideSpeaking("");
  }

  function getGuideFocus() {
    return (state.selectedNode || state.startNode || state.canonical || "").trim();
  }

  function setGuideSubtitle(focus) {
    const subtitleEl = document.getElementById("guideModalSubtitle");
    if (!subtitleEl) return;

    const parts = [];
    if (focus) parts.push(`${t("cognitive_focal")}: ${focus}`);
    if (state.theme) parts.push(`${t("meta_theme")}: ${state.theme}`);
    if (state.canonical) parts.push(`${t("meta_canonical")}: ${state.canonical}`);
    subtitleEl.textContent = parts.join(" • ");
  }

  function renderGuideLoading() {
    const dialogEl = document.getElementById("guideDialog");
    if (!dialogEl) return;
    dialogEl.innerHTML =
      `<div class="empty-state" style="min-height:140px;">\n` +
      `  <div class="loading-ring"></div>\n` +
      `  <div class="empty-state-text">${escapeHtml(t("guide_loading"))}</div>\n` +
      `</div>`;
  }

  function renderGuideError(msg) {
    const dialogEl = document.getElementById("guideDialog");
    if (!dialogEl) return;
    dialogEl.innerHTML = `<div class="evidence-empty">${escapeHtml(t("error_prefix"))} ${escapeHtml(msg)}</div>`;
  }

  function appendGuideMessage({ speaker, text }) {
    const dialogEl = document.getElementById("guideDialog");
    if (!dialogEl) return null;

    const who = speaker === "female" ? "female" : "male";
    const msg = document.createElement("div");
    msg.className = `guide-msg ${who}`;

    const label = document.createElement("div");
    label.className = "guide-speaker";
    label.textContent = who === "female" ? t("guide_speaker_female") : t("guide_speaker_male");

    const body = document.createElement("div");
    body.className = "guide-text";
    body.textContent = "";

    msg.appendChild(label);
    msg.appendChild(body);
    dialogEl.appendChild(msg);
    dialogEl.scrollTop = dialogEl.scrollHeight;

    return body;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function typeText(el, text, runId) {
    const s = String(text ?? "");
    if (!el) return;
    if (!s) { el.textContent = ""; return; }

    const chars = Array.from(s);
    const total = chars.length;

    // Faster for long text; still feels like narration.
    const step = total > 320 ? 5 : (total > 180 ? 3 : 2);
    const baseDelay = total > 320 ? 8 : (total > 180 ? 12 : 16);

    let i = 0;
    while (i < total) {
      if (runId !== guideState.runId) return;
      el.textContent += chars.slice(i, i + step).join("");
      i += step;
      await delay(baseDelay);
    }
  }

  function _pickVoiceForLang(langCode, preferFemale = false) {
    if (!isVoiceSupported()) return null;
    const target = String(langCode || "").trim().toLowerCase();
    const base = target.split("-")[0] || target;
    const voices = (() => {
      try { return window.speechSynthesis.getVoices?.() || []; } catch { return []; }
    })();
    if (!voices.length) return null;

    const candidates = voices.filter((v) => String(v?.lang || "").toLowerCase().startsWith(base));
    const list = candidates.length ? candidates : voices;

    // Best-effort: prefer a voice name hint for gender (not standardized across platforms).
    if (preferFemale) {
      const female = list.find((v) => /female|woman|zira|susan|samantha/i.test(String(v?.name || "")));
      if (female) return female;
    } else {
      const male = list.find((v) => /male|man|daniel|george|alex/i.test(String(v?.name || "")));
      if (male) return male;
    }

    const def = list.find((v) => v?.default);
    return def || list[0] || null;
  }

  function speakLine(text, { speaker, runId }) {
    if (!guideState.voiceEnabled || !isVoiceSupported()) return Promise.resolve();
    const s = String(text ?? "").trim();
    if (!s) return Promise.resolve();

    return new Promise((resolve) => {
      if (runId !== guideState.runId) { resolve(); return; }

      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        resolve();
      };

      try {
        const utter = new SpeechSynthesisUtterance(s);
        const uiLang = getLang();
        utter.lang = uiLang === "ta" ? "ta-IN" : (uiLang === "en" ? "en-US" : uiLang);
        utter.rate = 1.03;
        utter.pitch = speaker === "female" ? 1.06 : 0.98;

        const voice = _pickVoiceForLang(utter.lang, speaker === "female");
        if (voice) utter.voice = voice;

        utter.onend = finish;
        utter.onerror = finish;

        // Safety timer in case the browser never fires onend/onerror.
        timer = setTimeout(finish, Math.min(75000, 10000 + s.length * 28));

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch {
        finish();
      }
    });
  }

  async function playGuideDialog(dialog) {
    const dialogEl = document.getElementById("guideDialog");
    if (!dialogEl) return;

    stopGuidePlayback();
    const runId = guideState.runId;

    dialogEl.innerHTML = "";
    const msgs = Array.isArray(dialog) ? dialog : [];
    for (const m of msgs) {
      if (runId !== guideState.runId) return;
      const speaker = (m && typeof m === "object") ? String(m.speaker || "").toLowerCase() : "male";
      const text = (m && typeof m === "object") ? String(m.text || "") : String(m || "");
      const who = speaker === "female" ? "female" : "male";

      setGuideSpeaking(who);
      const textEl = appendGuideMessage({ speaker: who, text });

      const speakP = speakLine(text, { speaker: who, runId });
      const typeP = typeText(textEl, text, runId);
      await Promise.all([typeP, speakP]);

      setGuideSpeaking("");
      await delay(250);
    }
  }

  async function fetchGuideDialog({ force = false } = {}) {
    const focus = getGuideFocus();
    if (!focus) {
      throw new Error(t("guide_no_context"));
    }

    const payload = {
      concept: focus,
      query: state.lastQuery || focus,
      theme: state.theme,
      canonical: state.canonical,
      language: getLang(),
    };

    const key = JSON.stringify(payload);
    if (!force && guideState.lastPayloadKey === key && Array.isArray(guideState.dialog) && guideState.dialog.length) {
      return guideState.dialog;
    }

    const out = await postJson("/guide/dialog", payload);
    const dialog = Array.isArray(out?.dialog) ? out.dialog : [];
    if (!dialog.length) throw new Error(t("guide_empty"));

    guideState.dialog = dialog;
    guideState.lastPayloadKey = key;
    return dialog;
  }

  async function openGuideModal({ force = false } = {}) {
    const modal = document.getElementById("guideModal");
    if (!modal) return;

    const focus = getGuideFocus();
    if (!focus) {
      alert(t("guide_no_context"));
      return;
    }

    modal.style.display = "block";
    updateGuideVoiceButton();
    setGuideSubtitle(focus);
    renderGuideLoading();

    try {
      const dialog = await fetchGuideDialog({ force });
      await playGuideDialog(dialog);
    } catch (e) {
      renderGuideError(e?.message || String(e));
    }
  }

  function closeGuideModal() {
    stopGuidePlayback();
    const modal = document.getElementById("guideModal");
    if (modal) modal.style.display = "none";
  }

  function localizeGraphLabels() {
    const i18n = window.i18n;
    if (!i18n || typeof i18n.getNodeDisplayName !== "function") return;

    const maxLen = 12;
    document.querySelectorAll(".node-label").forEach((el) => {
      const d = el.__data__;
      if (!d) return;
      const name = String(i18n.getNodeDisplayName(d) || d.id || "");
      el.textContent = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
    });
  }

  // Wrap drawGraph to update analytics + hide initial empty state + localize labels
  const origDraw = window.drawGraph;
  if (typeof origDraw === "function") {
    window.drawGraph = function(graph) {
      const empty = document.getElementById("initial-empty");
      if (empty) empty.style.display = "none";
      try { updateGraphAnalytics(graph); } catch {}
      const out = origDraw(graph);
      try { localizeGraphLabels(); } catch {}
      return out;
    };
  }

  function renderNodeModal(node, links) {
    const modal = document.getElementById("nodeModal");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl = document.getElementById("modalBody");
    const relEl = document.getElementById("modalRelations");
    if (!modal || !titleEl || !bodyEl || !relEl) return;

    const meta = (typeof window.getCatMeta === "function") ? window.getCatMeta(node) : { label: "Concept", color: "#0ea5e9" };
    const badgeColor = meta.color || "#0ea5e9";

    const title = nodeName(node) || node?.id || "";
    titleEl.textContent = title;

    const extraLabel = (node?.tamil_label && node?.tamil_label !== title)
      ? `<div class="modal-subtitle" style="margin:-6px 0 10px;">${escapeHtml(node.tamil_label)}</div>`
      : "";

    const descLabel = t("node_modal_description");
    const desc = node?.description ? String(node.description) : t("node_modal_no_description");

    bodyEl.innerHTML = `
      <span class="modal-badge" style="background:${escapeHtml(badgeColor)}22;color:${escapeHtml(badgeColor)};border-color:${escapeHtml(badgeColor)}55;">
        ${escapeHtml(meta.label || "")}
      </span>
      ${extraLabel}
      <p><strong>${escapeHtml(descLabel)}:</strong> <span id="modalDesc">${escapeHtml(desc)}</span></p>
      <div class="modal-actions">
        <button id="hierarchyViewBtn" class="btn-secondary" type="button">${escapeHtml(t("switch_hierarchy_view"))}</button>
      </div>
    `;

    // Best-effort translation of the node description into the selected UI language.
    const targetLang = getLang();
    const descEl = bodyEl.querySelector("#modalDesc");
    if (descEl && desc && targetLang !== "en") {
      descEl.textContent = t("loading_translating");
      translateOnce(desc, targetLang)
        .then((translated) => { descEl.textContent = translated; })
        .catch(() => { descEl.textContent = desc; });
    }

    // Hierarchy view toggle (force ↔ hierarchy)
    const hierarchyBtn = bodyEl.querySelector("#hierarchyViewBtn");
    if (hierarchyBtn) {
      const mode = (typeof window.getGraphViewMode === "function") ? window.getGraphViewMode() : "force";
      const isHierarchy = String(mode || "").toLowerCase() === "hierarchy";
      hierarchyBtn.textContent = isHierarchy ? t("switch_network_view") : t("switch_hierarchy_view");

      hierarchyBtn.addEventListener("click", () => {
        if (typeof window.toggleGraphView === "function") {
          window.toggleGraphView(node?.id || "");
          const next = (typeof window.getGraphViewMode === "function") ? window.getGraphViewMode() : "";
          const nowHierarchy = String(next || "").toLowerCase() === "hierarchy";
          hierarchyBtn.textContent = nowHierarchy ? t("switch_network_view") : t("switch_hierarchy_view");
        } else {
          alert(t("error_prefix") + " Hierarchy view is not available.");
        }
      });
    }

    const related = (Array.isArray(links) ? links : []).filter((l) => {
      const s = toId(l?.source);
      const tt = toId(l?.target);
      return s === node?.id || tt === node?.id;
    });

    let html = `<h4>${escapeHtml(t("node_modal_relationships"))}</h4>`;
    if (!related.length) {
      html += `<p style="color:var(--text-muted);">${escapeHtml(t("node_modal_no_relationships"))}</p>`;
    } else {
      html += `<div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">`;
      related
        .filter((l) => !String(l?.relation || "").startsWith("reverse_"))
        .forEach((l) => {
          const sId = toId(l?.source);
          const tId = toId(l?.target);
          const relText = (typeof window.relationLabel === "function") ? window.relationLabel(l?.relation) : String(l?.relation || "");
          const sName = (typeof displayNameById === "function") ? displayNameById(sId) : (sId || "");
          const tName = (typeof displayNameById === "function") ? displayNameById(tId) : (tId || "");

          html += `<p>
            <strong>${escapeHtml(sName)}</strong>
            <span> —(${escapeHtml(relText)})→ </span>
            <strong>${escapeHtml(tName)}</strong>
          </p>`;
        });
      html += `</div>`;
    }

    relEl.innerHTML = html;
    modal.style.display = "block";
  }

  // Override sendQuery to surface cognitive button + analytics state
  window.sendQuery = function() {
    const q = document.getElementById("query")?.value?.trim();
    if (!q) { alert(t("alert_enter_query")); return; }

    state.lastQuery = q;
    state.selectedNode = "";
    updateSelectedDegree("", []);

    const cogControls = document.getElementById("cognitiveControls");
    if (cogControls) cogControls.style.display = "none";

    const metaEl = document.getElementById("meta");
    const expEl = document.getElementById("explanation");
    if (metaEl) {
      metaEl.innerHTML =
        `<div style="display:flex;align-items:center;gap:10px;">
           <div class="loading-ring"></div>
           <span style="color:var(--text-muted);font-style:italic;">${escapeHtml(t("loading_querying"))}</span>
         </div>`;
    }
    if (expEl) {
      expEl.innerHTML =
        `<div class="empty-state">
           <div class="loading-ring"></div>
           <div class="empty-state-text">${escapeHtml(t("loading_traversing"))}</div>
         </div>`;
    }

    fetch("/query", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query: q, language: getLang() })
    })
    .then(async (res) => {
      const text = await res.text();
      try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
      catch {
        console.error("Server returned non-JSON:", text);
        throw new Error(t("error_backend_non_json"));
      }
    })
    .then(({ ok, status, data }) => {
      if (!ok) {
        const msg = data?.error || t("error_request_failed", { status });
        throw new Error(msg);
      }

      if (data?.error) {
        alert(data.error);
        if (metaEl) metaEl.innerHTML = `<p style="color:#f87171;">${escapeHtml(t("error_prefix"))} ${escapeHtml(data.error)}</p>`;
        if (cogControls) cogControls.style.display = "none";
        return;
      }

      state.theme = data.theme || "";
      state.canonical = data.canonical || "";

      const themeTa = {
        Ezhuthu: "எழுத்து",
        Sol: "சொல்",
        Porul: "பொருள்",
        Akam: "அகம்",
        Puram: "புறம்",
        Thinai: "திணை",
        Ethics: "அறநெறி",
        Culture: "பண்பாடு",
      };
      const themeDisplay = (getLang() === "ta" && themeTa[state.theme]) ? themeTa[state.theme] : state.theme;

      if (metaEl) {
        metaEl.innerHTML =
          `<p><strong>${escapeHtml(t("meta_theme"))}:</strong> ${escapeHtml(themeDisplay || "—")}</p>
           <p><strong>${escapeHtml(t("meta_canonical"))}:</strong> ${escapeHtml(state.canonical || "—")}</p>`;
      }

      if (expEl) {
        state.explanation = data.explanation || "";
        expEl.innerHTML = renderExplanationCards(state.explanation);
      }

      if (cogControls) cogControls.style.display = "block";

      if (data.graph) {
        const cleanGraph = (typeof window.sanitizeGraph === "function")
          ? window.sanitizeGraph(data.graph)
          : data.graph;

        try { currentGraphData = cleanGraph; } catch {}

        state.startNode = cleanGraph?.meta?.start_nodes?.[0] || "";
        updateGraphAnalytics(cleanGraph);
        updateSelectedDegree("", cleanGraph?.links || []);

        requestAnimationFrame(() => window.drawGraph(cleanGraph));
      }
    })
    .catch((err) => {
      console.error(err);
      if (metaEl) metaEl.innerHTML = `<p style="color:#f87171;">${escapeHtml(t("error_prefix"))} ${escapeHtml(err.message)}</p>`;
      if (cogControls) cogControls.style.display = "none";
    });
  };

  // Override showNodeModal to support i18n + evidence
  const origShowNodeModal = window.showNodeModal;
  window.showNodeModal = function(node, links) {
    state.selectedNode = node?.id || "";
    updateSelectedDegree(state.selectedNode, links || []);
    renderNodeModal(node, links);
    renderEvidenceBlock(node);

    // Preserve any upstream side-effects (if any were added later).
    if (typeof origShowNodeModal === "function") {
      // no-op: intentionally not calling it to avoid double-render.
    }
  };

  // Override search to match Tamil labels too.
  const origSearchNodeByName = window.searchNodeByName;
  window.searchNodeByName = function(name) {
    const q = String(name || "").trim();
    if (!q) { alert(t("alert_enter_node")); return; }
    if (!currentGraphData?.nodes) { alert(t("alert_no_graph")); return; }

    const qLower = q.toLowerCase();
    const found = currentGraphData.nodes.find((n) => {
      const en = String(n?.id || "").toLowerCase();
      const ta = String(n?.tamil_label || "").toLowerCase();
      return en.includes(qLower) || ta.includes(qLower);
    });

    if (found) {
      try { focusNode(found, currentGraphData, currentNodes, currentLinks); } catch {}
      window.showNodeModal(found, currentGraphData.links || []);
    } else {
      alert(t("alert_node_not_found", { name: q }));
    }

    if (typeof origSearchNodeByName === "function") {
      // no-op: replaced intentionally
    }
  };

  // Wrap resetView to clear selected-degree display
  const origReset = window.resetView;
  if (typeof origReset === "function") {
    window.resetView = function() {
      state.selectedNode = "";
      updateSelectedDegree("", []);
      return origReset();
    };
  }

  window.addEventListener("app:languageChanged", () => {
    try { localizeGraphLabels(); } catch {}
    try { updateSelectedDegree(state.selectedNode, currentGraphData?.links || []); } catch {}
    try { updateGuideVoiceButton(); } catch {}

    // If there is an active query, re-fetch explanation in the new language.
    if (state.lastQuery) {
      const input = document.getElementById("query");
      if (input) input.value = state.lastQuery;
      try { window.sendQuery(); } catch {}
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("cognitiveBtn");
    if (btn) btn.addEventListener("click", openCognitiveModal);

    const closeBtn = document.getElementById("closeCognitiveModal");
    if (closeBtn) closeBtn.addEventListener("click", closeCognitiveModal);

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("cognitiveModal");
      if (modal && e.target === modal) closeCognitiveModal();
    });

    const guideBtn = document.getElementById("openGuideModal");
    if (guideBtn) guideBtn.addEventListener("click", () => openGuideModal({ force: false }));

    const guideClose = document.getElementById("closeGuideModal");
    if (guideClose) guideClose.addEventListener("click", closeGuideModal);

    const guideVoice = document.getElementById("guideVoiceToggle");
    if (guideVoice) {
      updateGuideVoiceButton();
      guideVoice.addEventListener("click", () => {
        if (!isVoiceSupported()) return;
        guideState.voiceEnabled = !guideState.voiceEnabled;
        saveVoicePreference(guideState.voiceEnabled);
        if (!guideState.voiceEnabled) cancelGuideSpeech();
        updateGuideVoiceButton();
      });
    }

    const guideReplay = document.getElementById("guideReplay");
    if (guideReplay) guideReplay.addEventListener("click", () => playGuideDialog(guideState.dialog));

    const guideRefresh = document.getElementById("guideRefresh");
    if (guideRefresh) guideRefresh.addEventListener("click", () => openGuideModal({ force: true }));

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("guideModal");
      if (modal && e.target === modal) closeGuideModal();
    });

    updateGraphAnalytics({ nodes: [], links: [] });
    updateSelectedDegree("", []);
  });
})();
