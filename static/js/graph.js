/**
 * ============================================================
 *  TOLKĀPPIYAM KNOWLEDGE GRAPH — ENHANCED GRAPH ENGINE
 *  Node Shapes: ● Unified (all nodes)
 * ============================================================
 */

"use strict";

let currentSimulation = null;
let currentSvg        = null;
let currentGraphData  = null;
let currentNodes      = null;
let currentLinks      = null;
let currentLinkLabels = null;
let zoom;
let currentViewMode   = "force"; // "force" | "hierarchy"
let hierarchyState    = null;
let d3MissingNotified = false;

/* ══════════════════════════════════════════
   CATEGORY PALETTE & NODE METADATA
══════════════════════════════════════════ */

const CATEGORIES = {
  thinai:  {
    color: "#22c55e",
    glow:  "rgba(34,197,94,0.55)",
    dim:   "rgba(34,197,94,0.12)",
    shape: "circle",
    size:  30,
    label: "Thinai"
  },
  akam:    {
    color: "#3b82f6",
    glow:  "rgba(59,130,246,0.55)",
    dim:   "rgba(59,130,246,0.12)",
    shape: "circle",
    size:  30,
    label: "Akam"
  },
  puram:   {
    color: "#f97316",
    glow:  "rgba(249,115,22,0.55)",
    dim:   "rgba(249,115,22,0.12)",
    shape: "circle",
    size:  30,
    label: "Puram"
  },
  grammar: {
    color: "#a855f7",
    glow:  "rgba(168,85,247,0.55)",
    dim:   "rgba(168,85,247,0.12)",
    shape: "circle",
    size:  30,
    label: "Grammar"
  },
  ethics:  {
    color: "#ef4444",
    glow:  "rgba(239,68,68,0.55)",
    dim:   "rgba(239,68,68,0.12)",
    shape: "circle",
    size:  30,
    label: "Ethics"
  },
  default: {
    color: "#0ea5e9",
    glow:  "rgba(14,165,233,0.55)",
    dim:   "rgba(14,165,233,0.12)",
    shape: "circle",
    size:  30,
    label: "Concept"
  }
};

function getCategory(node) {
  const c = `${node.id || ""} ${node.category || ""}`.toLowerCase();
  if (c.includes("thinai"))                                   return "thinai";
  if (c.includes("akam"))                                     return "akam";
  if (c.includes("puram"))                                    return "puram";
  if (c.includes("grammar") || c.includes("ezhuthu") || c.includes("sol")) return "grammar";
  if (c.includes("ethic")   || c.includes("culture") || c.includes("aram")) return "ethics";
  return "default";
}

function getCatMeta(node) {
  return CATEGORIES[getCategory(node)] || CATEGORIES.default;
}

function nodeDisplayName(node) {
  const i18n = window.i18n;
  if (i18n && typeof i18n.getNodeDisplayName === "function") {
    const v = i18n.getNodeDisplayName(node);
    return String(v ?? "");
  }
  return String(node?.id ?? "");
}

function i18nT(key, vars) {
  const i18n = window.i18n;
  if (i18n && typeof i18n.t === "function") return i18n.t(key, vars);
  // Fallback: key as a last resort
  return key;
}

function relationLabel(relation) {
  const rel = String(relation || "").replace(/^reverse_/, "");
  const i18n = window.i18n;
  if (i18n && typeof i18n.relationKey === "function" && typeof i18n.t === "function") {
    return i18n.t(i18n.relationKey(rel));
  }
  return rel ? rel.replace(/_/g, " ") : "related to";
}

function getNodeById(id) {
  const nodes = currentGraphData?.nodes;
  if (!id || !Array.isArray(nodes)) return null;
  return nodes.find((n) => n && n.id === id) || null;
}

function displayNameById(id) {
  const node = getNodeById(id) || { id };
  return nodeDisplayName(node) || String(id || "");
}

/* ══════════════════════════════════════════
   SHAPE PATH GENERATORS  (SVG path data)
   All shapes centered at (0,0), sized by r
══════════════════════════════════════════ */

/* ============================================================
   GRAPH SANITIZER (prevents d3 "node not found" crashes)
   ============================================================ */
function toNodeId(v) {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (typeof v.id === "string" || typeof v.id === "number") return String(v.id);
    if (typeof v.name === "string" || typeof v.name === "number") return String(v.name);
  }
  return null;
}

function sanitizeGraph(graph) {
  if (!graph || typeof graph !== "object") return { nodes: [], links: [] };

  const nodesIn = Array.isArray(graph.nodes) ? graph.nodes : [];
  const linksIn = Array.isArray(graph.links) ? graph.links : [];

  const nodesById = new Map();
  const nodes = [];

  for (const n of nodesIn) {
    const id = toNodeId(n?.id ?? n);
    if (!id || nodesById.has(id)) continue;

    const obj = (n && typeof n === "object") ? n : { id };
    obj.id = id;

    nodesById.set(id, obj);
    nodes.push(obj);
  }

  let placeholderCount = 0;
  let droppedLinks = 0;
  const links = [];

  for (const l of linksIn) {
    if (!l) continue;

    const sourceId = toNodeId(l.source);
    const targetId = toNodeId(l.target);

    if (!sourceId || !targetId) { droppedLinks++; continue; }

    if (!nodesById.has(sourceId)) {
      const stub = { id: sourceId, category: "Concept", description: "" };
      nodesById.set(sourceId, stub);
      nodes.push(stub);
      placeholderCount++;
    }

    if (!nodesById.has(targetId)) {
      const stub = { id: targetId, category: "Concept", description: "" };
      nodesById.set(targetId, stub);
      nodes.push(stub);
      placeholderCount++;
    }

    // Keep endpoints as ids so d3.forceLink() can resolve them reliably.
    links.push({ ...l, source: sourceId, target: targetId });
  }

  if (placeholderCount || droppedLinks) {
    console.warn(
      `Graph sanitized: +${placeholderCount} placeholder nodes, -${droppedLinks} invalid links.`
    );
  }

  return { ...graph, nodes, links };
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function getGraphTheme() {
  return {
    edge:        cssVar("--graph-edge", "rgba(100, 116, 139, 0.35)"),
    edgeDim:     cssVar("--graph-edge-dim", "rgba(100, 116, 139, 0.12)"),
    edgeActive:  cssVar("--graph-edge-active", "#2563eb"),
    arrow:       cssVar("--graph-arrow", "rgba(100, 116, 139, 0.55)"),
    arrowActive: cssVar("--graph-arrow-active", "#2563eb"),
    focusStroke: cssVar("--graph-focus-stroke", "#1d4ed8")
  };
}

function _graphD3MissingMessage() {
  const fallback = "Graph engine failed to load (D3.js missing). Check your connection and refresh.";
  try {
    const msg = i18nT("error_d3_missing");
    return (msg && msg !== "error_d3_missing") ? msg : fallback;
  } catch {
    return fallback;
  }
}

function _showGraphError(message) {
  const empty = document.getElementById("initial-empty");
  if (empty) {
    empty.style.display = "flex";
    const txt = empty.querySelector(".empty-state-text");
    if (txt) txt.textContent = message;
  }
  const meta = document.getElementById("meta");
  if (meta) meta.innerHTML = `<p style="color:#f87171;">⚠ ${message}</p>`;
}

function ensureD3Ready() {
  if (window.d3) return true;
  if (!d3MissingNotified) {
    d3MissingNotified = true;
    const msg = _graphD3MissingMessage();
    console.error("D3.js not loaded; graph rendering skipped.");
    _showGraphError(msg);
  }
  return false;
}

function shapePath(shape, r) {
  switch (shape) {
    /* ◇ Diamond */
    case "diamond": {
      const d = r * 1.35;
      return `M0,${-d} L${d},0 L0,${d} L${-d},0 Z`;
    }

    /* ⬡ Hexagon */
    case "hexagon": {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
      }
      return "M" + pts.join("L") + "Z";
    }

    /* ⬟ Octagon */
    case "octagon": {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
      }
      return "M" + pts.join("L") + "Z";
    }

    /* ■ Rounded Square */
    case "square": {
      const s = r * 0.88;
      return `M${-s},${-s} L${s},${-s} L${s},${s} L${-s},${s} Z`;
    }

    /* ✦ 5-pointed Star */
    case "star": {
      const outer = r;
      const inner = r * 0.45;
      const pts   = [];
      for (let i = 0; i < 10; i++) {
        const a   = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : inner;
        pts.push(`${rad * Math.cos(a)},${rad * Math.sin(a)}`);
      }
      return "M" + pts.join("L") + "Z";
    }

    /* ○ Circle fallback */
    default: {
      // Approximate circle with 36-gon
      const pts = [];
      for (let i = 0; i < 36; i++) {
        const a = (2 * Math.PI / 36) * i;
        pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
      }
      return "M" + pts.join("L") + "Z";
    }
  }
}

/* ══════════════════════════════════════════
   TOOLTIP
══════════════════════════════════════════ */
const tooltip = document.createElement("div");
tooltip.className = "node-tooltip";
tooltip.innerHTML = `<div class="tt-title"></div><div class="tt-cat"></div>`;
document.body.appendChild(tooltip);

function showTooltip(event, d) {
  const meta = getCatMeta(d);
  tooltip.querySelector(".tt-title").textContent = nodeDisplayName(d) || d.id;
  tooltip.querySelector(".tt-cat").textContent   = meta.label;
  tooltip.style.display = "block";
  moveTooltip(event);
}

function moveTooltip(event) {
  tooltip.style.left = (event.clientX + 14) + "px";
  tooltip.style.top  = (event.clientY - 10) + "px";
}

function hideTooltip() {
  tooltip.style.display = "none";
}

function getUiLanguage() {
  const i18n = window.i18n;
  if (i18n && typeof i18n.getLanguage === "function") {
    const v = String(i18n.getLanguage() || "en").trim().toLowerCase();
    return v || "en";
  }
  const lang = document.documentElement?.lang;
  return String(lang || "en").trim().toLowerCase() || "en";
}

/* ══════════════════════════════════════════
   SEND QUERY
══════════════════════════════════════════ */
function sendQuery() {
  const q = document.getElementById("query").value.trim();
  if (!q) { alert(i18nT("alert_enter_query")); return; }

  // Cache last query for report export (best-effort, used if research.js is not loaded).
  try { window.__lastQuery = q; } catch {}

  document.getElementById("meta").innerHTML =
    `<div style="display:flex;align-items:center;gap:10px;">
       <div class="loading-ring"></div>
       <span style="color:var(--text-muted);font-style:italic;">Querying the corpus…</span>
     </div>`;
  document.getElementById("explanation").innerHTML =
    `<div class="empty-state">
       <div class="loading-ring"></div>
       <div class="empty-state-text">Traversing the knowledge graph…</div>
     </div>`;

  fetch("/query", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query: q, language: getUiLanguage() })
  })
  .then(async res => {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch {
      console.error("Server returned non-JSON:", text);
      throw new Error("Backend error — check Flask terminal.");
    }
  })
  .then(data => {
    if (data.error) {
      alert(data.error);
      document.getElementById("meta").innerHTML =
        `<p style="color:#f87171;">⚠ ${data.error}</p>`;
      return;
    }

    document.getElementById("meta").innerHTML =
      `<p><strong>Theme:</strong> ${data.theme     || "—"}</p>
       <p><strong>Canonical:</strong> ${data.canonical || "—"}</p>`;

    const expRaw = data.explanation || "No explanation available.";
    const expEl = document.getElementById("explanation");
    if (expEl) {
      expEl.dataset.raw = String(expRaw);
    }
    try { window.__lastExplanation = String(expRaw); } catch {}
    try { window.__lastTheme = String(data.theme || ""); } catch {}
    try { window.__lastCanonical = String(data.canonical || ""); } catch {}

    document.getElementById("explanation").innerHTML =
      `<pre style="white-space:pre-wrap;font-family:inherit;">${data.explanation || "No explanation available."}</pre>`;

    if (data.graph) {
      const cleanGraph = sanitizeGraph(data.graph);
      currentGraphData = cleanGraph;
      try { window.__lastGraph = cleanGraph; } catch {}
      requestAnimationFrame(() => drawGraph(cleanGraph));
    }
  })
  .catch(err => {
    console.error(err);
    document.getElementById("meta").innerHTML =
      `<p style="color:#f87171;">⚠ ${err.message}</p>`;
  });
}

/* ══════════════════════════════════════════
   EXPORT TO PDF (fallback if research.js fails)
══════════════════════════════════════════ */
async function exportPdf() {
  const btn = document.getElementById("exportPdfBtn");
  const prevText = btn?.textContent || "PDF";
  const prevTitle = btn?.getAttribute("title") || "";

  try {
    const q =
      (typeof window.__lastQuery === "string" ? window.__lastQuery : "") ||
      document.getElementById("query")?.value?.trim() ||
      "";

    if (!q) {
      alert(i18nT("alert_enter_query"));
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.textContent = "…";
      btn.setAttribute("title", "Exporting…");
    }

    const lang = getUiLanguage();
    const theme = (typeof window.__lastTheme === "string" ? window.__lastTheme : "") || "";
    const canonical = (typeof window.__lastCanonical === "string" ? window.__lastCanonical : "") || "";

    const expEl = document.getElementById("explanation");
    const explanation =
      (typeof window.__lastExplanation === "string" ? window.__lastExplanation : "") ||
      expEl?.dataset?.raw ||
      expEl?.innerText ||
      "";

    const svgEl = document.getElementById("graph");
    const graphImage = await svgToPngDataUrl(svgEl, { scale: 2, background: "#ffffff" });

    const graph = currentGraphData || window.__lastGraph || {};
    const exportGraph = normalizeGraphForExport(graph);

    const focal =
      (exportGraph?.meta?.start_nodes && Array.isArray(exportGraph.meta.start_nodes) && exportGraph.meta.start_nodes[0]) ||
      canonical ||
      q;

    let cognitive = null;
    if (focal) {
      try {
        cognitive = await postJson("/cognitive", { concept: focal, theme, canonical });
      } catch {}
    }

    const payload = {
      query: q,
      theme,
      canonical,
      language: lang,
      focal,
      explanation,
      graph: exportGraph,
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
  } catch (err) {
    console.error(err);
    alert(err?.message || String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.textContent = prevText;
      if (prevTitle) btn.setAttribute("title", prevTitle);
    }
  }
}

function normalizeGraphForExport(graph) {
  const g = graph && typeof graph === "object" ? graph : {};
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const links = Array.isArray(g.links) ? g.links : [];
  const meta = (g.meta && typeof g.meta === "object") ? { ...g.meta } : {};

  return {
    meta,
    nodes: nodes.map((n) => {
      const id = toNodeId(n?.id ?? n) || "";
      return {
        id,
        tamil_label: n?.tamil_label ?? "",
        category: n?.category ?? "",
        description: n?.description ?? "",
        evidence: n?.evidence ?? {},
        row_id: n?.row_id ?? "",
      };
    }),
    links: links.map((l) => ({
      source: toNodeId(l?.source) || "",
      target: toNodeId(l?.target) || "",
      relation: l?.relation ?? "",
      evidence: l?.evidence ?? {},
      row_id: l?.row_id ?? "",
    })),
  };
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
    throw new Error("Server returned non-JSON. Check Flask logs.");
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
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

/* ══════════════════════════════════════════
   GRAPH VIEW MODES (Force ↔ Hierarchy)
══════════════════════════════════════════ */
function getGraphViewMode() {
  return currentViewMode;
}

function toggleGraphView(focusNodeId) {
  const focus = String(focusNodeId || "").trim();
  if (currentViewMode === "hierarchy") switchToForceView(focus);
  else switchToHierarchyView(focus);
}

function _defaultLabelText(d, prefix = "") {
  const name = nodeDisplayName(d) || String(d?.id ?? "");
  const maxLen = 16;
  const core = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
  return prefix + core;
}

function _linksAsPairs(links) {
  const out = [];
  for (const l of Array.isArray(links) ? links : []) {
    const s = toNodeId(l?.source);
    const t = toNodeId(l?.target);
    if (!s || !t || s === t) continue;
    out.push({ source: s, target: t, relation: String(l?.relation || "") });
  }
  return out;
}

function _chooseHierarchyRoot(focusId, graph) {
  const focus = focusId || graph?.meta?.start_nodes?.[0] || (Array.isArray(graph?.nodes) ? graph.nodes[0]?.id : "");
  const pairs = _linksAsPairs(graph?.links);

  // Build incoming map: child -> [parents]
  const parentsByChild = new Map();
  for (const p of pairs) {
    if (!parentsByChild.has(p.target)) parentsByChild.set(p.target, []);
    parentsByChild.get(p.target).push(p.source);
  }
  for (const [k, v] of parentsByChild.entries()) v.sort();

  // Walk up one parent chain to get the top-most ancestor within the current graph.
  const seen = new Set();
  let cur = String(focus || "").trim();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const parents = parentsByChild.get(cur) || [];
    const next = parents[0];
    if (!next) break;
    cur = next;
  }
  return cur || String(focus || "").trim();
}

function _buildHierarchyData(rootId, graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((n) => [String(n?.id || ""), n]));
  const pairs = _linksAsPairs(graph?.links);

  const childrenByParent = new Map();
  for (const p of pairs) {
    if (!childrenByParent.has(p.source)) childrenByParent.set(p.source, new Set());
    childrenByParent.get(p.source).add(p.target);
  }

  function build(id, path) {
    const nid = String(id || "").trim();
    const meta = nodeById.get(nid) || { id: nid, category: "Concept", description: "" };
    const nextPath = new Set(path);
    nextPath.add(nid);

    const childIds = Array.from(childrenByParent.get(nid) || []);
    childIds.sort();
    const children = [];
    for (const cid of childIds) {
      if (!cid || nextPath.has(cid)) continue;
      children.push(build(cid, nextPath));
    }
    return { id: nid, node: meta, children };
  }

  return build(rootId, new Set());
}

function _collapseBeyondDepth(h, depthLimit = 2) {
  h.each((d) => {
    if (d.depth >= depthLimit && d.children) {
      d._children = d.children;
      d.children = null;
    }
  });
}

function _expandPathTo(root, targetId) {
  const target = String(targetId || "").trim();
  if (!target) return;

  function visit(node) {
    if (!node) return false;
    if (node.data?.id === target) return true;

    const kids = [];
    if (Array.isArray(node.children)) kids.push(...node.children);
    if (Array.isArray(node._children)) kids.push(...node._children);

    for (const child of kids) {
      if (visit(child)) {
        // Ensure `child` is expanded (i.e., in `children`) along the path.
        if (node._children && node._children.includes(child)) {
          node.children = node.children || [];
          node.children.push(child);
          node._children = node._children.filter((c) => c !== child);
          if (!node._children.length) node._children = null;
        }
        return true;
      }
    }
    return false;
  }

  visit(root);
}

function _indexHierarchyNodes(root) {
  const map = new Map();
  function walk(n) {
    if (!n) return;
    const id = String(n.data?.id || "").trim();
    if (id) map.set(id, n);
    for (const c of Array.isArray(n.children) ? n.children : []) walk(c);
    for (const c of Array.isArray(n._children) ? n._children : []) walk(c);
  }
  walk(root);
  return map;
}

function _computeHierarchyLayout(root) {
  const container = document.getElementById("graph-container");
  const W = container?.clientWidth || 1200;
  const H = container?.clientHeight || 800;

  const marginX = 40;
  const marginY = 30;
  const tree = d3.tree().size([Math.max(1, W - marginX * 2), Math.max(1, H - marginY * 2)]);
  tree(root);

  const positions = new Map();
  for (const d of root.descendants()) {
    const id = String(d.data?.id || "").trim();
    if (!id) continue;
    positions.set(id, { x: d.x + marginX, y: d.y + marginY, depth: d.depth });
  }

  const visibleEdges = new Set();
  for (const l of root.links()) {
    const s = String(l.source?.data?.id || "").trim();
    const t = String(l.target?.data?.id || "").trim();
    if (!s || !t) continue;
    visibleEdges.add(`${s}→${t}`);
  }

  return { positions, visibleEdges };
}

function _centerOnNodeId(nodeId, scale = 1.15) {
  if (!currentSvg || !zoom || !nodeId) return;
  const node = getNodeById(nodeId);
  if (!node) return;

  const W = document.getElementById("graph-container")?.clientWidth || 1200;
  const H = document.getElementById("graph-container")?.clientHeight || 800;

  currentSvg.transition().duration(650).call(
    zoom.transform,
    d3.zoomIdentity
      .translate(W / 2 - node.x * scale, H / 2 - node.y * scale)
      .scale(scale)
  );
}

function _applyHierarchyLayout({ positions, visibleEdges }, { centerId } = {}) {
  if (!currentGraphData || !currentNodes || !currentLinks) return;

  const theme = getGraphTheme();
  const visibleIds = new Set(Array.from(positions.keys()));

  // Update node positions + visibility
  const t = d3.transition().duration(750).ease(d3.easeCubicInOut);
  currentNodes
    .transition(t)
    .attr("transform", (d) => {
      const p = positions.get(d.id);
      if (p) {
        d.x = p.x;
        d.y = p.y;
      }
      return `translate(${d.x},${d.y})`;
    })
    .style("opacity", (d) => (visibleIds.has(d.id) ? 1 : 0.0))
    .style("pointer-events", (d) => (visibleIds.has(d.id) ? "all" : "none"));

  // Update node label markers (▾/▸) for expand/collapse
  const nodeById = hierarchyState?.nodeById || new Map();
  currentNodes.each(function(d) {
    const h = nodeById.get(d.id);
    const hasKids = Boolean((h?.children && h.children.length) || (h?._children && h._children.length));
    const collapsed = Boolean(!h?.children && h?._children && h._children.length);
    const prefix = hasKids ? (collapsed ? "▸ " : "▾ ") : "";
    d3.select(this).select(".node-label").text(_defaultLabelText(d, prefix));
  });

  // Update links: draw only visible hierarchy edges
  currentLinks
    .transition(t)
    .attr("x1", (d) => {
      const s = toNodeId(d.source);
      const p = positions.get(s);
      return p ? p.x : (d.source?.x ?? d.source ?? 0);
    })
    .attr("y1", (d) => {
      const s = toNodeId(d.source);
      const p = positions.get(s);
      return p ? p.y : (d.source?.y ?? d.source ?? 0);
    })
    .attr("x2", (d) => {
      const tt = toNodeId(d.target);
      const p = positions.get(tt);
      return p ? p.x : (d.target?.x ?? d.target ?? 0);
    })
    .attr("y2", (d) => {
      const tt = toNodeId(d.target);
      const p = positions.get(tt);
      return p ? p.y : (d.target?.y ?? d.target ?? 0);
    })
    .attr("stroke", theme.edge)
    .attr("stroke-width", 1.4)
    .attr("marker-end", "none")
    .style("opacity", (d) => {
      const s = toNodeId(d.source);
      const tt = toNodeId(d.target);
      return visibleEdges.has(`${s}→${tt}`) ? 1 : 0.0;
    });

  // Hide edge labels in hierarchy view
  try { currentLinkLabels?.transition(t).style("opacity", 0); } catch {}

  if (centerId) _centerOnNodeId(centerId, 1.2);
}

function _toggleHierarchyNode(nodeId) {
  const id = String(nodeId || "").trim();
  if (!hierarchyState?.nodeById || !id) return;
  const h = hierarchyState.nodeById.get(id);
  if (!h) return;

  if (h.children && h.children.length) {
    h._children = h.children;
    h.children = null;
  } else if (h._children && h._children.length) {
    h.children = h._children;
    h._children = null;
  }

  hierarchyState.nodeById = _indexHierarchyNodes(hierarchyState.root);
  const layout = _computeHierarchyLayout(hierarchyState.root);
  _applyHierarchyLayout(layout, { centerId: hierarchyState.selectedId || id });
}

function switchToHierarchyView(focusNodeId) {
  if (!ensureD3Ready()) return;
  if (!currentGraphData?.nodes?.length) return;

  const focus = String(focusNodeId || "").trim() || String(currentGraphData?.meta?.start_nodes?.[0] || "").trim();
  currentViewMode = "hierarchy";

  try { currentSimulation?.stop(); } catch {}

  const rootId = _chooseHierarchyRoot(focus, currentGraphData);
  const data = _buildHierarchyData(rootId, currentGraphData);
  const root = d3.hierarchy(data, (d) => d.children);

  _collapseBeyondDepth(root, 2);
  _expandPathTo(root, focus);

  hierarchyState = {
    rootId,
    root,
    selectedId: focus || rootId,
    nodeById: _indexHierarchyNodes(root),
  };

  const layout = _computeHierarchyLayout(root);
  _applyHierarchyLayout(layout, { centerId: hierarchyState.selectedId });
}

function switchToForceView(focusNodeId) {
  if (!ensureD3Ready()) return;
  if (!currentGraphData?.nodes?.length) return;
  currentViewMode = "force";
  hierarchyState = null;

  // Restore labels (remove hierarchy markers)
  try {
    currentNodes?.each(function(d) {
      d3.select(this).select(".node-label").text(_defaultLabelText(d, ""));
    });
  } catch {}

  // Restore link visuals + show all links again
  const theme = getGraphTheme();
  try {
    currentLinks
      ?.style("opacity", 1)
      ?.attr("marker-end", "url(#arrow)")
      ?.attr("stroke", theme.edge)
      ?.attr("stroke-width", 1.5);
  } catch {}

  try { currentLinkLabels?.transition().duration(400).style("opacity", 1); } catch {}
  try { currentNodes?.transition().duration(250).style("opacity", 1).style("pointer-events", "all"); } catch {}

  // Restart simulation for a smooth transition back to relational view
  try { currentSimulation?.alpha(0.9).restart(); } catch {}

  const centerId = String(focusNodeId || "").trim() || String(currentGraphData?.meta?.start_nodes?.[0] || "").trim();
  if (centerId) _centerOnNodeId(centerId, 1.15);
}

try {
  window.getGraphViewMode = getGraphViewMode;
  window.toggleGraphView = toggleGraphView;
} catch {}

/* ══════════════════════════════════════════
   DRAW GRAPH
══════════════════════════════════════════ */
function drawGraph(graph) {
  if (!ensureD3Ready()) return;
  const container = document.getElementById("graph-container");
  const emptyState = document.getElementById("initial-empty");
  const W = container.clientWidth;
  const H = container.clientHeight;

  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  // New render resets to relational (force) view.
  currentViewMode = "force";
  hierarchyState = null;

  if (!graph?.nodes?.length) {
    if (emptyState) {
      emptyState.style.display = "flex";
      const txt = emptyState.querySelector(".empty-state-text");
      if (txt) txt.textContent = "No related concepts found for this query.";
    }
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  svg.attr("width", W).attr("height", H);
  currentSvg = svg;

  const theme = getGraphTheme();

  /* ── SVG Filters (glow effects) ── */ 
  const defs = svg.append("defs");

  // Per-category glow filters
  Object.entries(CATEGORIES).forEach(([key, meta]) => {
    const filter = defs.append("filter")
      .attr("id", `glow-${key}`)
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");

    filter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "4")
      .attr("result", "blur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
  });

  // Strong highlight glow
  const hlFilter = defs.append("filter")
    .attr("id", "glow-highlight")
    .attr("x", "-80%").attr("y", "-80%")
    .attr("width", "260%").attr("height", "260%");
  hlFilter.append("feGaussianBlur")
    .attr("in", "SourceGraphic").attr("stdDeviation", "8").attr("result", "blur");
  const hlMerge = hlFilter.append("feMerge");
  hlMerge.append("feMergeNode").attr("in", "blur");
  hlMerge.append("feMergeNode").attr("in", "blur");
  hlMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Arrow marker
  defs.append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 28).attr("refY", 0)
    .attr("markerWidth", 5).attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", theme.arrow);

  defs.append("marker")
    .attr("id", "arrow-active")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 28).attr("refY", 0)
    .attr("markerWidth", 5).attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", theme.arrowActive);

  /* ── Zoom Layer ── */
  const zoomLayer = svg.append("g").attr("class", "zoom-layer");

  zoom = d3.zoom()
    .scaleExtent([0.15, 6])
    .on("zoom", e => zoomLayer.attr("transform", e.transform));
  svg.call(zoom);

  /* ── Force Simulation ── */
  const simulation = d3.forceSimulation(graph.nodes)
    .force("link",
      d3.forceLink(graph.links)
        .id(d => d.id)
        .distance(d => {
          const r = d.relation || "";
          if (r.includes("hasTheme"))                    return 230;
          if (r.includes("parent") || r.includes("child")) return 170;
          return 150;
        })
    )
    .force("charge", d3.forceManyBody().strength(-600))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collision", d3.forceCollide().radius(d => getCatMeta(d).size * 1.5))
    .alphaDecay(0.04)
    .velocityDecay(0.45);

  currentSimulation = simulation;

  /* ── Link Lines ── */
  const linkG = zoomLayer.append("g").attr("class", "links");

  const link = linkG.selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("stroke", theme.edge)
    .attr("stroke-width", 1.5)
    .attr("marker-end", "url(#arrow)");

  currentLinks = link;

  /* ── Edge Labels (relation type) ── */
  const edgeLabelG = zoomLayer.append("g").attr("class", "edge-labels");

  const edgeLabel = edgeLabelG.selectAll("text")
    .data(graph.links.filter(l => l.relation && !l.relation.startsWith("reverse_")))
    .enter().append("text")
    .attr("class", "edge-label")
    .attr("text-anchor", "middle")
    .attr("dy", -4)
    .style("pointer-events", "none")
    .text(d => (d.relation || "").replace(/_/g, " "));

  currentLinkLabels = edgeLabel;

  /* ── Node Groups ── */
  const nodeG = zoomLayer.append("g").attr("class", "nodes");

  const nodeGroup = nodeG.selectAll("g.node")
    .data(graph.nodes)
    .enter().append("g")
    .attr("class", "node")
    .style("cursor", "pointer")
    .call(
      d3.drag()
        .on("start", dragstarted)
        .on("drag",  dragged)
        .on("end",   dragended)
    );

  /* ── Outer Halo (pulsing ring) ── */
  nodeGroup.append("path")
    .attr("class", "node-halo")
    .attr("d", d => {
      const meta = getCatMeta(d);
      return shapePath(meta.shape, meta.size * 1.55);
    })
    .attr("fill", "none")
    .attr("stroke", d => getCatMeta(d).color)
    .attr("stroke-width", 1)
    .attr("opacity", 0.25)
    .style("animation", (d, i) => `halo-pulse 3s ease-in-out ${(i * 0.3) % 3}s infinite`);

  /* ── Main Shape ── */
  nodeGroup.append("path")
    .attr("class", "node-body")
    .attr("d", d => {
      const meta = getCatMeta(d);
      return shapePath(meta.shape, meta.size);
    })
    .attr("fill", d => {
      const meta = getCatMeta(d);
      return `url(#grad-${getCategory(d)})` ;
    })
    .attr("stroke", d => getCatMeta(d).color)
    .attr("stroke-width", 2)
    .attr("filter", d => `url(#glow-${getCategory(d)})`);

  // Per-category radial gradients
  Object.entries(CATEGORIES).forEach(([key, meta]) => {
    const grad = defs.append("radialGradient")
      .attr("id", `grad-${key}`)
      .attr("cx", "30%").attr("cy", "30%")
      .attr("r", "70%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", meta.color).attr("stop-opacity", 0.9);
    grad.append("stop").attr("offset", "100%").attr("stop-color", meta.color).attr("stop-opacity", 0.45);
  });

  /* ── Inner Shine ── */
  nodeGroup.append("path")
    .attr("class", "node-shine")
    .attr("d", d => {
      const meta = getCatMeta(d);
      return shapePath(meta.shape, meta.size * 0.55);
    })
    .attr("fill", "rgba(255,255,255,0.12)")
    .attr("transform", "translate(-4,-5)")
    .style("pointer-events", "none");

  /* ── Node Label ── */
  nodeGroup.append("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-family", "var(--font-ui)")
    .style("font-size", d => {
      const len = d.id.length;
      const base = getCatMeta(d).size;
      if (len > 10) return Math.max(7, base * 0.26) + "px";
      if (len > 6)  return Math.max(8, base * 0.3) + "px";
      return Math.max(9, base * 0.34) + "px";
    })
    .style("font-weight", "600")
    .style("fill", "white")
    .style("paint-order", "stroke")
    .style("stroke", "rgba(0,0,0,0.5)")
    .style("stroke-width", "2px")
    .style("pointer-events", "none")
    .text(d => d.id.length > 12 ? d.id.slice(0, 11) + "…" : d.id);

  currentNodes = nodeGroup;

  /* ── Hover ── */
  nodeGroup
    .on("mouseover", function(event, d) {
      const meta = getCatMeta(d);
      d3.select(this).select(".node-body")
        .transition().duration(200)
        .attr("d", shapePath(meta.shape, meta.size * 1.2))
        .attr("stroke-width", 3)
        .attr("filter", "url(#glow-highlight)");
      d3.select(this).select(".node-halo")
        .transition().duration(200).attr("opacity", 0.6);
      showTooltip(event, d);
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", function(event, d) {
      const meta = getCatMeta(d);
      d3.select(this).select(".node-body")
        .transition().duration(200)
        .attr("d", shapePath(meta.shape, meta.size))
        .attr("stroke-width", 2)
        .attr("filter", `url(#glow-${getCategory(d)})`);
      d3.select(this).select(".node-halo")
        .transition().duration(200).attr("opacity", 0.25);
      hideTooltip();
    })
    .on("click", function(event, d) {
      if (currentViewMode === "hierarchy") {
        try {
          if (hierarchyState) hierarchyState.selectedId = d?.id || "";
          _toggleHierarchyNode(d?.id || "");
        } catch {}
        showNodeModal(d, graph.links);
        return;
      }

      focusNode(d, graph, nodeGroup, link);
      showNodeModal(d, graph.links);
    });

  /* ── Tick ── */
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    nodeGroup
      .attr("transform", d => `translate(${d.x},${d.y})`);

    edgeLabel
      .attr("x", d => ((d.source.x + d.target.x) / 2))
      .attr("y", d => ((d.source.y + d.target.y) / 2));
  });

  /* ── Drag ── */
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x; d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  /* Inject halo animation CSS */
  if (!document.getElementById("halo-keyframes")) {
    const style = document.createElement("style");
    style.id = "halo-keyframes";
    style.textContent = `
      @keyframes halo-pulse {
        0%,100% { opacity:0.15; transform:scale(1);   }
        50%      { opacity:0.45; transform:scale(1.08); }
      }
    `;
    document.head.appendChild(style);
  }
}

/* ══════════════════════════════════════════
   FOCUS NODE
══════════════════════════════════════════ */
function focusNode(nodeData, graph, nodeSel, linkSel) {
  if (!ensureD3Ready()) return;
  const theme = getGraphTheme();

  const connected = new Set();
  graph.links.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    if (s === nodeData.id || t === nodeData.id) {
      connected.add(s); connected.add(t);
    }
  });

  /* Dim non-connected nodes */
  nodeSel.each(function(d) {
    const isConnected  = connected.has(d.id);
    const isFocused    = d.id === nodeData.id;
    const meta         = getCatMeta(d);

    d3.select(this).select(".node-body")
      .transition().duration(400)
      .attr("opacity", isConnected ? 1 : 0.12)
      .attr("stroke-width", isFocused ? 4 : 2)
      .attr("stroke", isFocused ? theme.focusStroke : meta.color)
      .attr("filter", isFocused ? "url(#glow-highlight)" : `url(#glow-${getCategory(d)})`);

    d3.select(this).select(".node-halo")
      .transition().duration(400)
      .attr("opacity", isFocused ? 0.8 : isConnected ? 0.25 : 0);

    d3.select(this).select(".node-label")
      .transition().duration(400)
      .attr("opacity", isConnected ? 1 : 0.15);
  });

  /* Highlight connected links */
  linkSel
    .transition().duration(400)
    .attr("stroke", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (s === nodeData.id || t === nodeData.id)
        ? theme.edgeActive : theme.edgeDim;
    })
    .attr("stroke-width", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (s === nodeData.id || t === nodeData.id) ? 2.5 : 1;
    })
    .attr("marker-end", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (s === nodeData.id || t === nodeData.id)
        ? "url(#arrow-active)" : "url(#arrow)";
    });

  /* Re-center */
  if (currentSvg && zoom) {
    const W = document.getElementById("graph-container").clientWidth;
    const H = document.getElementById("graph-container").clientHeight;
    currentSvg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(W / 2 - nodeData.x * 1.6, H / 2 - nodeData.y * 1.6)
        .scale(1.6)
    );
  }
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function showNodeModal(node, links) {
  const modal      = document.getElementById("nodeModal");
  const titleEl    = document.getElementById("modalTitle");
  const bodyEl     = document.getElementById("modalBody");
  const relEl      = document.getElementById("modalRelations");
  const meta       = getCatMeta(node);
  const t = (key) => (window.i18n && typeof window.i18n.t === "function") ? window.i18n.t(key) : key;

  titleEl.textContent = node.id;

  /* Category badge */
  const badgeColor = meta.color;
  bodyEl.innerHTML = `
    <span class="modal-badge" style="background:${badgeColor}22;color:${badgeColor};border-color:${badgeColor}55;">
      ${meta.label}
    </span>
    <p><strong>${t("node_modal_description")}:</strong> ${node.description || t("node_modal_no_description")}</p>
    <div class="modal-actions">
      <button id="hierarchyViewBtn" class="btn-secondary" type="button">${t("switch_hierarchy_view")}</button>
    </div>
  `;

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

  /* Relationships */
  const related = links.filter(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    return s === node.id || t === node.id;
  });

  let html = "<h4>Relationships</h4>";
  if (!related.length) {
    html += "<p style='color:var(--text-muted);'>No relationships found.</p>";
  } else {
    html += `<div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">`;
    related
      .filter(l => !(l.relation || "").startsWith("reverse_"))
      .forEach(l => {
        const s   = l.source.id || l.source;
        const t   = l.target.id || l.target;
        const rel = (l.relation || "related to").replace(/_/g, " ");
        html += `<p>
          <strong>${s}</strong>
          <span> —(${rel})→ </span>
          <strong>${t}</strong>
        </p>`;
      });
    html += "</div>";
  }

  relEl.innerHTML = html;
  modal.style.display = "block";
}

/* ══════════════════════════════════════════
   SEARCH NODE
══════════════════════════════════════════ */
function searchNodeByName(name) {
  if (!name?.trim()) { alert("Enter a node name to search!"); return; }
  if (!currentGraphData?.nodes) { alert("No graph loaded yet."); return; }

  const found = currentGraphData.nodes.find(n =>
    n.id.toLowerCase().includes(name.trim().toLowerCase())
  );

  if (found) {
    focusNode(found, currentGraphData, currentNodes, currentLinks);
    showNodeModal(found, currentGraphData.links);
  } else {
    alert(`Node "${name}" not found.`);
  }
}

/* ══════════════════════════════════════════
   RESET VIEW
══════════════════════════════════════════ */
function resetView() {
  if (!ensureD3Ready()) return;
  const theme = getGraphTheme();

  if (currentSvg && zoom) {
    currentSvg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  }

  if (currentViewMode === "hierarchy" && hierarchyState?.root) {
    try {
      const layout = _computeHierarchyLayout(hierarchyState.root);
      _applyHierarchyLayout(layout, { centerId: hierarchyState.selectedId || hierarchyState.rootId });
      return;
    } catch {}
  }

  if (currentNodes) {
    currentNodes.each(function(d) {
      const meta = getCatMeta(d);
      d3.select(this).select(".node-body")
        .transition().duration(400)
        .attr("opacity", 1)
        .attr("stroke-width", 2)
        .attr("stroke", meta.color)
        .attr("filter", `url(#glow-${getCategory(d)})`);
      d3.select(this).select(".node-halo")
        .transition().duration(400).attr("opacity", 0.25);
      d3.select(this).select(".node-label")
        .transition().duration(400).attr("opacity", 1);
    });
  }
  if (currentLinks) {
    currentLinks
      .transition().duration(400)
      .attr("stroke", theme.edge)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");
  }
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  /* Modal close */
  const closeBtn = document.getElementById("closeModal");
  const modal    = document.getElementById("nodeModal");
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = "none"; };
  window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

  /* Enter keys */
  document.getElementById("query")?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendQuery();
  });

  document.getElementById("searchNode")?.addEventListener("keypress", e => {
    if (e.key === "Enter") searchNodeByName(e.target.value);
  });

  console.log("✦ Tolkāppiyam Knowledge Graph — Enhanced Engine Ready");
});
