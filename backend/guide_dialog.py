import re

from cognitive_architecture import build_cognitive_architecture
from explanation_generator import generate_explanation
from ontology_mapper import get_subgraph


_CATEGORY_TA = {
    "thinai": "திணை",
    "akam": "அகம்",
    "puram": "புறம்",
    "grammar": "இலக்கணம்",
    "ethics": "அறநெறி",
    "culture": "பண்பாடு",
    "concept": "கருத்து",
}


_HEADING_PATTERNS = [
    (re.compile(r"^\s*Concept Meaning\s*:\s*$", re.IGNORECASE), "concept_meaning"),
    (re.compile(r"^\s*Literary Context\s*:\s*$", re.IGNORECASE), "literary_context"),
    (re.compile(r"^\s*Cultural\s*/\s*Ethical Significance\s*:\s*$", re.IGNORECASE), "cultural_significance"),
    (re.compile(r"^\s*கருத்தின் பொருள்\s*:\s*$"), "concept_meaning"),
    (re.compile(r"^\s*இலக்கியச் சூழல்\s*:\s*$"), "literary_context"),
    (re.compile(r"^\s*பண்பாட்டு\s*/\s*அறநெறி\s*முக்கியத்துவம்\s*:\s*$"), "cultural_significance"),
]

_SKIP_HEADINGS = [
    re.compile(r"^\s*English Explanation\s*:\s*$", re.IGNORECASE),
    re.compile(r"^\s*Tamil Explanation\s*:\s*$", re.IGNORECASE),
    re.compile(r"^\s*Explanation\s*:\s*$", re.IGNORECASE),
]


def _clean_text(text) -> str:
    s = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def _clip(text: str, max_chars: int = 520) -> str:
    s = _clean_text(text)
    if not s:
        return ""
    if len(s) <= max_chars:
        return s

    cut = s[:max_chars].rstrip()
    for mark in (". ", "।", "!", "?", "…"):
        idx = cut.rfind(mark)
        if idx >= int(max_chars * 0.6):
            return cut[: idx + (1 if mark != ". " else 1)].rstrip() + "…"
    return cut + "…"


def parse_explanation_sections(text: str) -> dict:
    sections = {"concept_meaning": [], "literary_context": [], "cultural_significance": []}
    current = None

    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    for line in raw.split("\n"):
        stripped = line.strip()
        if any(p.match(stripped) for p in _SKIP_HEADINGS):
            current = None
            continue

        matched = False
        for pat, key in _HEADING_PATTERNS:
            if pat.match(stripped):
                current = key
                matched = True
                break
        if matched:
            continue

        if current and stripped:
            sections[current].append(stripped)

    return {k: _clean_text("\n".join(v)) for k, v in sections.items()}


def _relation_label(rel: str) -> str:
    r = (rel or "").strip().replace("_", " ")
    return r if r else "related to"


def _pick_focal(concept: str, query: str, canonical: str) -> str:
    for v in (concept, canonical, query):
        if v and str(v).strip():
            return str(v).strip()
    return ""


def build_guide_dialog(*, concept: str, query: str = "", theme: str = "", canonical: str = "", language: str = "en") -> dict:
    """Build a dialog-style explanation between two characters.

    Returns:
      {"concept": str, "language": str, "dialog": [{"speaker": "male"|"female", "text": str}, ...]}
    """
    lang = (language or "en").strip().lower()
    focal = _pick_focal(concept, query, canonical)
    if not focal:
        return {"error": "Missing concept/query"}

    sg = get_subgraph(focal, depth=2) or {"nodes": [], "links": [], "meta": {}}
    if not sg.get("nodes") and canonical and canonical != focal:
        sg = get_subgraph(canonical, depth=2) or sg
    if not sg.get("nodes") and query and query != focal:
        sg = get_subgraph(query, depth=2) or sg

    nodes = sg.get("nodes") if isinstance(sg, dict) else None
    links = sg.get("links") if isinstance(sg, dict) else None
    nodes = nodes if isinstance(nodes, list) else []
    links = links if isinstance(links, list) else []

    start_nodes = (sg.get("meta") or {}).get("start_nodes") if isinstance(sg, dict) else []
    start_nodes = start_nodes if isinstance(start_nodes, list) else []

    # Prefer an exact node match from the visible subgraph.
    focal_id = focal
    node = next((n for n in nodes if isinstance(n, dict) and n.get("id") == focal_id), None)
    if not node and start_nodes:
        focal_id = start_nodes[0]
        node = next((n for n in nodes if isinstance(n, dict) and n.get("id") == focal_id), None)

    node = node if isinstance(node, dict) else {}
    tamil_label = str(node.get("tamil_label") or "").strip()
    category = str(node.get("category") or "Concept").strip()
    description = str(node.get("description") or "").strip()
    evidence = node.get("evidence") if isinstance(node.get("evidence"), dict) else {}

    # Academic explanation (3-section structure) from the existing pipeline.
    try:
        explanation = generate_explanation(focal_id, nodes, language=lang) or ""
    except Exception:
        explanation = ""

    sec = parse_explanation_sections(explanation)
    cm = sec.get("concept_meaning") or ""
    lc = sec.get("literary_context") or ""
    cs = sec.get("cultural_significance") or ""

    if not cm and description:
        cm = description

    # Ontology links (from the same visible subgraph)
    in_links = [l for l in links if isinstance(l, dict) and l.get("target") == focal_id]
    out_links = [l for l in links if isinstance(l, dict) and l.get("source") == focal_id]

    parent_clause = ""
    if in_links:
        parent = str(in_links[0].get("source") or "").strip()
        rel = _relation_label(str(in_links[0].get("relation") or ""))
        if parent:
            if lang == "ta":
                parent_clause = f" (மேல்கருத்து: “{parent}”, உறவு: {rel})"
            else:
                parent_clause = f" (parent: “{parent}”, relation: {rel})"

    rel_items = []
    for l in out_links[:4]:
        tgt = str(l.get("target") or "").strip()
        rel = _relation_label(str(l.get("relation") or ""))
        if tgt:
            rel_items.append(f"{rel} → {tgt}")

    # Cognitive strengths (top relations)
    cognitive = {}
    try:
        cognitive = build_cognitive_architecture(focal_id, theme=theme, canonical=canonical) or {}
    except Exception:
        cognitive = {}

    cog_items = []
    rels = cognitive.get("relations") if isinstance(cognitive, dict) else None
    rels = rels if isinstance(rels, list) else []
    rels_sorted = sorted(rels, key=lambda r: float((r or {}).get("weight") or 0), reverse=True)
    for r in rels_sorted[:3]:
        tgt = str((r or {}).get("target") or "").strip()
        w = float((r or {}).get("weight") or 0)
        if tgt:
            cog_items.append(f"{tgt} ({int(round(w * 100))}%)")

    # Evidence line
    ev_section = str(evidence.get("source_section") or "").strip()
    ev_sutra = str(evidence.get("sutra_reference") or "").strip()
    ev_source = str(evidence.get("source_reference") or "").strip()
    ev_sent = str(evidence.get("extracted_sentence") or "").strip()

    if ev_sent:
        ev_sent = _clip(ev_sent, 220)

    if lang == "ta":
        cat_ta = _CATEGORY_TA.get(category.strip().lower(), category)
        label_bit = f" ({tamil_label})" if tamil_label else ""

        dialog = [
            {
                "speaker": "female",
                "text": f"வணக்கம்! நான் உங்கள் தமிழ் அறிவு வழிகாட்டி. இன்று “{focal_id}”{label_bit} பற்றி உரையாடலாம்.",
            },
            {
                "speaker": "male",
                "text": f"ஒண்டாலஜியில், “{focal_id}” என்பது {cat_ta} வகையில் இடம் பெறுகிறது{parent_clause}.",
            },
            {
                "speaker": "female",
                "text": f"கருத்தின் பொருள்: {_clip(cm, 560) or '—'}",
            },
            {
                "speaker": "male",
                "text": f"இலக்கியச் சூழல்: {_clip(lc, 560) or '—'}",
            },
            {
                "speaker": "female",
                "text": f"பண்பாட்டு / அறநெறி முக்கியத்துவம்: {_clip(cs, 560) or '—'}",
            },
        ]

        if ev_section or ev_sutra or ev_source or ev_sent:
            parts = []
            if ev_section:
                parts.append(f"மூல பகுதி: {ev_section}")
            if ev_sutra:
                parts.append(f"சூத்திர குறிப்பு: {ev_sutra}")
            if ev_source:
                parts.append(f"மூல குறிப்பிடு: {ev_source}")
            if ev_sent:
                parts.append(f"எடுத்த மேற்கோள்: {ev_sent}")
            dialog.append({"speaker": "male", "text": "ஆதாரத் தடம்: " + " • ".join(parts)})
        else:
            dialog.append({"speaker": "male", "text": "ஆதாரத் தடம்: இந்தக் கருத்துக்கான ஆதாரத் தகவல் தற்போது இல்லை."})

        if rel_items:
            dialog.append({"speaker": "female", "text": "ஒண்டாலஜி உறவுகள்: " + " • ".join(rel_items)})
        else:
            dialog.append({"speaker": "female", "text": "ஒண்டாலஜி உறவுகள்: கூடுதல் உறவுகள் இல்லை."})

        if cog_items:
            dialog.append({"speaker": "male", "text": "அறிவியல் உறவு வலிமை: " + " • ".join(cog_items)})
        else:
            dialog.append({"speaker": "male", "text": "அறிவியல் உறவு வலிமை: குறிப்பிடத்தக்க உறவுகள் இல்லை."})

        dialog.append(
            {
                "speaker": "female",
                "text": "மேலும் ஆய்விற்கு, முனைகளைத் தேர்ந்தெடுத்து உறவுகளைப் பாருங்கள்; தேவையானால் அடுக்குக் காட்சி (Hierarchy) காட்சியையும் முயற்சிக்கலாம்.",
            }
        )

    else:
        label_bit = f" ({tamil_label})" if tamil_label else ""
        dialog = [
            {
                "speaker": "female",
                "text": f"Vanakkam! I’m your Tamil Arivu Guide. Let’s explore “{focal_id}”{label_bit} together.",
            },
            {
                "speaker": "male",
                "text": f"In the ontology, “{focal_id}” is categorized as {category}{parent_clause}.",
            },
            {
                "speaker": "female",
                "text": f"Concept Meaning: {_clip(cm, 560) or '—'}",
            },
            {
                "speaker": "male",
                "text": f"Literary Context: {_clip(lc, 560) or '—'}",
            },
            {
                "speaker": "female",
                "text": f"Cultural / Ethical Significance: {_clip(cs, 560) or '—'}",
            },
        ]

        if ev_section or ev_sutra or ev_source or ev_sent:
            parts = []
            if ev_section:
                parts.append(f"Source section: {ev_section}")
            if ev_sutra:
                parts.append(f"Sutra reference: {ev_sutra}")
            if ev_source:
                parts.append(f"Source reference: {ev_source}")
            if ev_sent:
                parts.append(f"Extracted sentence: {ev_sent}")
            dialog.append({"speaker": "male", "text": "Evidence snapshot: " + " • ".join(parts)})
        else:
            dialog.append({"speaker": "male", "text": "Evidence snapshot: No evidence metadata is available for this concept yet."})

        if rel_items:
            dialog.append({"speaker": "female", "text": "Ontology relationships: " + " • ".join(rel_items)})
        else:
            dialog.append({"speaker": "female", "text": "Ontology relationships: No additional relationships found."})

        if cog_items:
            dialog.append({"speaker": "male", "text": "Cognitive relationship strengths: " + " • ".join(cog_items)})
        else:
            dialog.append({"speaker": "male", "text": "Cognitive relationship strengths: No notable relations found."})

        dialog.append(
            {
                "speaker": "female",
                "text": "Tip: Select nodes to compare perspectives, and try the Hierarchy View to see taxonomic structure.",
            }
        )

    return {"concept": focal_id, "language": lang, "dialog": dialog}

