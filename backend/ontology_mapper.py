import os
import re
import sys
from collections import defaultdict, deque

import pandas as pd

from sutra_evidence import infer_sutra_evidence

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


try:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ONTOLOGY_PATH = os.path.join(BASE_DIR, "data", "Ontology.csv")
    ONTOLOGY = pd.read_csv(ONTOLOGY_PATH)
    print(f"[OK] Loaded {len(ONTOLOGY)} rows from Ontology.csv")
except FileNotFoundError:
    print("[ERROR] data/Ontology.csv not found!")
    ONTOLOGY = pd.DataFrame()


# ---------- NORMALIZE ----------
def normalize(text):
    """Normalize text for matching."""
    if pd.isna(text):
        return ""
    return re.sub(r"[^\w\u0B80-\u0BFF\s]", "", str(text)).strip().lower()


def _clean_field(value):
    if value is None or pd.isna(value):
        return ""
    s = str(value).strip()
    return "" if s.lower() == "nan" else s


def _row_evidence(row):
    """Best-effort evidence fields for traceability (safe when columns are missing)."""
    domain_hint = (
        _clean_field(row.get("Domain"))
        or _clean_field(row.get("Main Theme"))
        or _clean_field(row.get("Category"))
    )
    domain_norm = normalize(domain_hint)

    inferred_section = ""
    if domain_norm:
        if "ezhuthu" in domain_norm:
            inferred_section = "Ezhuthathikaram"
        elif "sol" in domain_norm:
            inferred_section = "Sollathikaram"
        elif any(k in domain_norm for k in ("porul", "akam", "puram", "thinai", "culture", "ethics")):
            inferred_section = "Porulathikaram"

    return {
        "source_section": (
            _clean_field(row.get("Source_Section"))
            or inferred_section
            or domain_hint
        ),
        "sutra_reference": (
            _clean_field(row.get("Sutra_Reference"))
            or _clean_field(row.get("Sutra Reference"))
            or _clean_field(row.get("Sutra"))
        ),
        "source_reference": (
            _clean_field(row.get("Source_Reference"))
            or _clean_field(row.get("Source_Text"))
        ),
        "extracted_sentence": (
            _clean_field(row.get("Extracted_Sentence"))
            or _clean_field(row.get("Extracted Sentence"))
        ),
    }



GRAPH = defaultdict(list)
NODE_META = {}
ALL_LINKS = []
ALIAS_INDEX = defaultdict(set)

for _, row in ONTOLOGY.iterrows():
    row_id = _clean_field(row.get("ID"))
    eng = str(row.get("English_Label", "")).strip()
    parent = str(row.get("Parent_Concept", "")).strip()
    relation = str(row.get("Relation_Type", "related_to"))
    category = str(row.get("Category", "Concept"))
    description = str(row.get("Description", ""))
    tamil_label = row.get("Tamil_Label", "")
    syn_ta = row.get("Synonyms_Tamil", "")
    syn_en = row.get("Synonyms_English", "")
    keywords = row.get("Keywords", "")

    if not eng or eng == "nan":
        continue

    evidence = _row_evidence(row)

    # Fill missing Sutra + extracted sentence using the local tholkaappiyam corpus (best-effort).
    if not evidence.get("sutra_reference") or not evidence.get("extracted_sentence"):
        domain_hint = (
            _clean_field(row.get("Domain"))
            or _clean_field(row.get("Main Theme"))
            or _clean_field(row.get("Category"))
        )
        inferred = infer_sutra_evidence(
            english_label=eng,
            tamil_label=_clean_field(tamil_label),
            synonyms_tamil=_clean_field(syn_ta),
            synonyms_english=_clean_field(syn_en),
            keywords=_clean_field(keywords),
            description=_clean_field(description),
            domain_hint=domain_hint,
        )

        # Prefer CSV values when present; only fill gaps, and upgrade overly-generic fields.
        for k, v in (inferred or {}).items():
            if v and not evidence.get(k):
                evidence[k] = v

        if inferred and inferred.get("source_section"):
            existing = _clean_field(evidence.get("source_section"))
            if not existing or normalize(existing) == normalize(domain_hint):
                evidence["source_section"] = inferred["source_section"]

        if inferred and inferred.get("source_reference"):
            existing = _clean_field(evidence.get("source_reference"))
            if not existing or normalize(existing) in {"tolkappiyam"}:
                evidence["source_reference"] = inferred["source_reference"]

    # store metadata (allow multiple rows per concept without clobbering)
    new_meta = {
        "id": eng,
        "category": _clean_field(category) or "Concept",
        "description": _clean_field(description),
        "tamil_label": _clean_field(tamil_label),
        "synonyms_tamil": _clean_field(syn_ta),
        "synonyms_english": _clean_field(syn_en),
        "keywords": _clean_field(keywords),
        "main_theme": _clean_field(row.get("Main Theme")),
        "domain": _clean_field(row.get("Domain")),
        "notes": _clean_field(row.get("Notes")),
        "evidence": evidence,
        "row_id": row_id,
    }

    existing = NODE_META.get(eng)
    if not existing:
        NODE_META[eng] = new_meta
    else:
        # Merge in missing fields without overwriting richer existing metadata.
        if (not existing.get("category") or existing.get("category") == "Concept") and new_meta.get("category"):
            existing["category"] = new_meta["category"]
        if not existing.get("description") and new_meta.get("description"):
            existing["description"] = new_meta["description"]

        for k in ("tamil_label", "synonyms_tamil", "synonyms_english", "keywords", "main_theme", "domain", "notes"):
            if not existing.get(k) and new_meta.get(k):
                existing[k] = new_meta[k]

        def _ev_score(ev: dict) -> int:
            if not isinstance(ev, dict):
                return 0
            fields = ("source_section", "sutra_reference", "source_reference", "extracted_sentence")
            return sum(1 for f in fields if _clean_field(ev.get(f)))

        if _ev_score(new_meta.get("evidence") or {}) > _ev_score(existing.get("evidence") or {}):
            existing["evidence"] = new_meta.get("evidence") or {}
            if row_id:
                existing["row_id"] = row_id

        NODE_META[eng] = existing

    # aliases (Tamil/English/synonyms/keywords) → canonical English id
    for field in (eng, tamil_label, syn_ta, syn_en, keywords):
        if pd.isna(field):
            continue
        for part in re.split(r"[,;|/]", str(field)):
            alias = part.strip()
            if not alias:
                continue
            ALIAS_INDEX[normalize(alias)].add(eng)

    # parent -> child
    if parent and parent != "nan":
        # Some concepts only appear as Parent_Concept; ensure they exist as nodes
        if parent not in NODE_META:
            parent_evidence = infer_sutra_evidence(
                english_label=parent,
                tamil_label="",
                synonyms_tamil="",
                synonyms_english="",
                keywords="",
                description="",
                domain_hint=str(category or "Concept"),
            )
            NODE_META[parent] = {
                "id": parent,
                "category": category or "Concept",
                "description": "",
                "tamil_label": "",
                "synonyms_tamil": "",
                "synonyms_english": "",
                "keywords": "",
                "main_theme": "",
                "domain": "",
                "notes": "",
                "evidence": parent_evidence or {},
                "row_id": "",
            }

        edge = {
            "source": parent,
            "target": eng,
            "relation": relation,
            "evidence": evidence,
            "row_id": row_id,
        }

        GRAPH[parent].append(edge)
        ALL_LINKS.append(edge)

        # bidirectional traversal
        reverse_edge = {
            "source": eng,
            "target": parent,
            "relation": f"reverse_{relation}",
            "evidence": evidence,
            "row_id": row_id,
        }
        GRAPH[eng].append(reverse_edge)

print(f"[GRAPH] Built {len(NODE_META)} nodes, {len(ALL_LINKS)} edges")

NORM_TO_IDS = defaultdict(list)
for node_id in NODE_META.keys():
    NORM_TO_IDS[normalize(node_id)].append(node_id)


# ---------- FIND START NODE ----------
STOP_CONCEPTS = {
    "thinai",
    "akam",
    "puram",
    "porul",
    "ezhuthu",
    "sol",
    "grammar",
    "ethics",
    "culture",
    "concept",
}


def _rank_candidates(candidates, q, query_words):
    def key(node_id):
        node_norm = normalize(node_id)
        exact = node_norm == q
        stop_penalty = 1 if (q not in STOP_CONCEPTS and node_norm in STOP_CONCEPTS) else 0
        pos = query_words.index(node_norm) if node_norm in query_words else 999
        return (0 if exact else 1, stop_penalty, pos, -len(node_norm), node_norm)

    uniq = list({c for c in candidates if c})
    uniq.sort(key=key)
    return uniq


def find_start_nodes(query, max_matches=1):
    """Find best-matching ontology node id(s) for a query (Tamil/English supported)."""
    q = normalize(query)
    if not q:
        return []

    query_words = [w for w in q.split() if len(w) > 1]

    def best(cands):
        return _rank_candidates(cands, q, query_words)[:max_matches]

    # 1) Exact full query match (id or alias)
    candidates = set(NORM_TO_IDS.get(q, [])) | set(ALIAS_INDEX.get(q, []))
    if candidates:
        return best(candidates)

    # 2) Exact token match (prefer non-generic concepts)
    for w in query_words:
        if w in STOP_CONCEPTS:
            continue
        candidates = set(NORM_TO_IDS.get(w, [])) | set(ALIAS_INDEX.get(w, []))
        if candidates:
            return best(candidates)

    # 3) Exact token match including generic concepts
    for w in query_words:
        candidates = set(NORM_TO_IDS.get(w, [])) | set(ALIAS_INDEX.get(w, []))
        if candidates:
            return best(candidates)

    # 4) Substring match on full query
    candidates = [label for label in NODE_META.keys() if q in normalize(label)]
    if candidates:
        return best(candidates)

    # 5) Substring match on tokens (prefer non-generic words)
    for w in query_words:
        if w in STOP_CONCEPTS or len(w) <= 2:
            continue
        candidates = [label for label in NODE_META.keys() if w in normalize(label)]
        if candidates:
            return best(candidates)

    # 6) Last resort: substring match on any token
    for w in query_words:
        if len(w) <= 2:
            continue
        candidates = [label for label in NODE_META.keys() if w in normalize(label)]
        if candidates:
            return best(candidates)

    return []


# ---------- BFS GRAPH EXPANSION ----------
def get_subgraph(query, depth=3):
    """Get subgraph starting from query matches."""
    start_nodes = find_start_nodes(query, max_matches=1)

    # If no match → return empty graph (keep UI focused on the query)
    if not start_nodes:
        print(f"[WARN] No ontology match for '{query}' — returning empty graph")
        return {"nodes": [], "links": [], "meta": {"start_nodes": [], "depth": depth}}

    print(f"[MATCH] Found {len(start_nodes)} start nodes: {start_nodes[:3]}")

    visited = set()
    queue = deque([(n, 0) for n in start_nodes])

    # Phase 1: collect nodes up to depth (no dangling endpoints)
    while queue:
        current, level = queue.popleft()

        if current in visited or level > depth:
            continue

        visited.add(current)

        if level >= depth:
            continue

        for edge in GRAPH[current]:
            # For Thinai-children queries (e.g., Kurinji), avoid pulling in sibling landscapes.
            if (
                current == "Thinai"
                and edge.get("relation") == "has_thinai"
                and "Thinai" not in start_nodes
                and edge.get("target") not in start_nodes
            ):
                continue

            neighbor = edge["target"]
            if neighbor not in visited:
                queue.append((neighbor, level + 1))

    # Phase 2: materialize node objects
    nodes = {}
    for node_id in visited:
        nodes[node_id] = NODE_META.get(
            node_id,
            {
                "id": node_id,
                "category": "Concept",
                "description": "",
                "tamil_label": "",
                "synonyms_tamil": "",
                "synonyms_english": "",
                "keywords": "",
                "main_theme": "",
                "domain": "",
                "notes": "",
                "evidence": {},
                "row_id": "",
            },
        )

    # Phase 3: include only links whose endpoints exist in `visited`
    links = []
    seen_links = set()
    for node_id in visited:
        for edge in GRAPH[node_id]:
            if edge["source"] not in visited or edge["target"] not in visited:
                continue
            if str(edge.get("relation", "")).startswith("reverse_"):
                continue

            link_key = (edge["source"], edge["target"], edge["relation"])
            if link_key in seen_links:
                continue

            links.append(edge)
            seen_links.add(link_key)

    print(f"[SUBGRAPH] {len(nodes)} nodes | {len(links)} links")

    return {
        "nodes": list(nodes.values()),
        "links": links,
        "meta": {"start_nodes": start_nodes, "depth": depth},
    }


# ---------- SEARCH NODE BY NAME ----------
def search_node(name):
    """Search for a specific node by name."""
    name_norm = normalize(name)

    for node_id, node_data in NODE_META.items():
        if name_norm in normalize(node_id):
            return node_data

    return None
