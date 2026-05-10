import os
import re

import pandas as pd

from ontology_mapper import GRAPH, get_subgraph, find_start_nodes

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUERY_MAPPING_PATH = os.path.join(BASE_DIR, "data", "Query_Mapping.csv")


def _norm(text: str) -> str:
    if text is None:
        return ""
    return re.sub(r"[^\w\u0B80-\u0BFF\s]", "", str(text)).strip().lower()


def _safe_str(value) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.lower() == "nan" else s


def _split_list(value: str):
    if not value:
        return []
    parts = re.split(r"[,;|/]", value)
    out = []
    for p in parts:
        t = p.strip()
        if t and t != "—":
            out.append(t)
    return out


RELATION_STRENGTH = {
    "foundation_of": 0.92,
    "governs": 0.88,
    "depends_on": 0.82,
    "has_thinai": 0.90,
    "classified_as": 0.80,
    "expressed_through": 0.78,
    "defined_by": 0.76,
    "part_of": 0.74,
    "includes": 0.70,
    "associated_with": 0.70,
    "covers": 0.76,
    "has_section": 0.68,
    "has_landscape": 0.86,
    "expresses": 0.84,
    "associated_deity": 0.72,
    "applies_to": 0.62,
    "restricted_to": 0.58,
    "distinct_from": 0.54,
    "social_value": 0.62,
    "ethical_duty": 0.64,
}


THINAI_TIME = {
    "kurinji": "Night",
    "mullai": "Evening",
    "marutham": "Day",
}


def _weight_to_label(weight: float) -> str:
    if weight >= 0.80:
        return "strongly_related"
    if weight >= 0.60:
        return "moderately_related"
    return "weakly_related"


def _node_bucket(node: dict) -> str:
    c = f"{node.get('id', '')} {node.get('category', '')}".lower()
    if "thinai" in c:
        return "thinai"
    if "akam" in c:
        return "akam"
    if "puram" in c:
        return "puram"
    if "grammar" in c or "ezhuthu" in c or "sol" in c:
        return "grammar"
    if "ethic" in c or "culture" in c or "aram" in c:
        return "ethics"
    return "default"


def _dimensions_from_theme(theme: str, category_mix: dict) -> list[dict]:
    # Base weights (kept low so theme/category can lift them).
    weights = {
        "Emotion": 0.10,
        "Ethics": 0.10,
        "Society": 0.10,
        "Landscape": 0.10,
        "Language": 0.10,
    }

    t = (theme or "").strip().lower()
    if t == "akam":
        weights["Emotion"] += 0.65
        weights["Landscape"] += 0.35
    elif t == "thinai":
        weights["Landscape"] += 0.70
        weights["Emotion"] += 0.45
    elif t == "puram":
        weights["Society"] += 0.65
        weights["Ethics"] += 0.30
    elif t == "porul":
        weights["Emotion"] += 0.30
        weights["Society"] += 0.25
        weights["Ethics"] += 0.20
        weights["Language"] += 0.20
    elif t in {"grammar", "ezhuthu", "sol"}:
        weights["Language"] += 0.85
    elif t == "ethics":
        weights["Ethics"] += 0.85
        weights["Society"] += 0.20
    elif t == "culture":
        weights["Ethics"] += 0.60
        weights["Society"] += 0.45

    # Mix-in from subgraph categories (small stabilizer).
    total = max(1, sum(category_mix.values()))
    weights["Landscape"] += 0.20 * (category_mix.get("thinai", 0) / total)
    weights["Emotion"] += 0.20 * (category_mix.get("akam", 0) / total)
    weights["Society"] += 0.20 * (category_mix.get("puram", 0) / total)
    weights["Language"] += 0.20 * (category_mix.get("grammar", 0) / total)
    weights["Ethics"] += 0.20 * (category_mix.get("ethics", 0) / total)

    # Clamp
    for k, v in list(weights.items()):
        weights[k] = max(0.0, min(1.0, float(v)))

    return [{"dimension": k, "weight": weights[k]} for k in weights.keys()]


def _load_query_mapping():
    try:
        df = pd.read_csv(QUERY_MAPPING_PATH)
    except FileNotFoundError:
        return {}, None

    by_type = {}
    for _, row in df.iterrows():
        k = _norm(row.get("Thinai / Type"))
        if not k:
            continue
        by_type[k] = {col: _safe_str(row.get(col)) for col in df.columns}
    return by_type, df


QUERY_BY_TYPE, _QUERY_DF = _load_query_mapping()


def build_cognitive_architecture(concept: str, theme: str | None = None, canonical: str | None = None):
    """Build an interpretive 'thinking graph' + core-dimension activations.

    Notes:
      - Strength values are heuristic and meant for comparative visualization.
      - Evidence fields are best-effort, based on available datasets.
    """
    concept = (concept or "").strip()
    if not concept:
        return {"error": "Empty concept"}

    start = find_start_nodes(concept, max_matches=1)
    focal = start[0] if start else concept

    # --- Subgraph mix (for dimension activation) ---
    sg = get_subgraph(focal, depth=2) or {"nodes": [], "links": []}
    category_mix = {}
    for n in sg.get("nodes", []):
        bucket = _node_bucket(n if isinstance(n, dict) else {"id": str(n)})
        category_mix[bucket] = category_mix.get(bucket, 0) + 1

    dimensions = _dimensions_from_theme(theme or "", category_mix)

    # --- Relations (ontology-adjacent + curated thinai mapping) ---
    relations = []
    seen = set()

    def add_relation(*, target: str, weight: float, basis: dict, evidence: dict | None = None):
        label = _weight_to_label(weight)
        weight = max(0.0, min(1.0, float(weight)))
        key = (focal, target, basis.get("type"), basis.get("relation") or basis.get("field"))
        if key in seen:
            return
        seen.add(key)
        relations.append(
            {
                "source": focal,
                "target": target,
                "relation": label,
                "weight": weight,
                "basis": basis,
                "evidence": evidence or {},
            }
        )

    # 1) Ontology adjacency
    for edge in GRAPH.get(focal, []):
        raw_rel = _safe_str(edge.get("relation"))
        if not raw_rel:
            continue
        is_reverse = raw_rel.startswith("reverse_")
        base_rel = raw_rel[len("reverse_") :] if is_reverse else raw_rel
        direction = "in" if is_reverse else "out"
        target = _safe_str(edge.get("target"))
        if not target:
            continue

        weight = RELATION_STRENGTH.get(base_rel, 0.60)
        add_relation(
            target=target,
            weight=weight,
            basis={"type": "ontology", "relation": base_rel, "direction": direction},
            evidence=edge.get("evidence") or {},
        )

    # 2) Thinai mapping enrichments (Query_Mapping.csv)
    map_row = QUERY_BY_TYPE.get(_norm(focal))
    if map_row:
        map_evidence = {
            "source_section": _safe_str(map_row.get("Associated Context")),
            "sutra_reference": "",
            "source_reference": _safe_str(map_row.get("Source_Reference")),
            "extracted_sentence": "",
        }

        landscape = _safe_str(map_row.get("Landscape"))
        if landscape and landscape != "—":
            add_relation(
                target=landscape,
                weight=0.88,
                basis={"type": "mapping", "field": "Landscape"},
                evidence=map_evidence,
            )

        meaning = _safe_str(map_row.get("Emotional / Cultural Meaning"))
        meanings = _split_list(meaning)
        if meanings:
            add_relation(
                target=meanings[0].title(),
                weight=0.92,
                basis={"type": "mapping", "field": "Emotional / Cultural Meaning"},
                evidence=map_evidence,
            )
            for extra in meanings[1:3]:
                add_relation(
                    target=extra.title(),
                    weight=0.74,
                    basis={"type": "mapping", "field": "Emotional / Cultural Meaning"},
                    evidence=map_evidence,
                )

        related = _split_list(_safe_str(map_row.get("Related_Concepts")))
        for rc in related[:4]:
            add_relation(
                target=rc,
                weight=0.55,
                basis={"type": "mapping", "field": "Related_Concepts"},
                evidence=map_evidence,
            )

    # 3) Thinai time-of-day (small curated map)
    time_label = THINAI_TIME.get(_norm(focal))
    if time_label:
        add_relation(
            target=time_label,
            weight=0.63,
            basis={"type": "curated", "field": "Time"},
            evidence={"source_reference": "Traditional Thinai time association"},
        )

    # Sort by strength, keep it readable
    relations.sort(key=lambda r: (-float(r.get("weight", 0.0)), str(r.get("target", ""))))
    relations = relations[:12]

    return {
        "focal": focal,
        "theme": theme or "",
        "canonical": canonical or "",
        "dimensions": dimensions,
        "relations": relations,
        "category_mix": category_mix,
        "note": "Strength values are heuristic scores intended for comparative visualization, not absolute measurements.",
    }
