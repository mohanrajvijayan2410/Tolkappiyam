import re
from dataclasses import dataclass


try:
    from tholkaappiyam import thol as thol_pkg
except Exception:
    thol_pkg = None


ADHIKARAM_ROM = {
    "எழுத்ததிகாரம்": "Ezhuthathikaram",
    "சொல்லதிகாரம்": "Sollathikaram",
    "பொருளதிகாரம்": "Porulathikaram",
}


EN_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "they",
    "this",
    "to",
    "was",
    "were",
    "with",
    "tamil",
    "tolkappiyam",
}


def _clean(value) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.lower() == "nan" else s


def _norm_ta(text: str) -> str:
    t = re.sub(r"[^\u0B80-\u0BFF\s]", " ", _clean(text))
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _norm_en(text: str) -> str:
    t = re.sub(r"[^a-z0-9\s]", " ", _clean(text).lower())
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _en_tokens(text: str) -> list[str]:
    t = _norm_en(text)
    out = []
    for w in t.split():
        if len(w) <= 2:
            continue
        if w in EN_STOPWORDS:
            continue
        out.append(w)
    return out


def _ta_terms(*values: str) -> list[str]:
    out = []
    for v in values:
        s = _clean(v)
        if not s:
            continue
        # Keep only Tamil-script tokens, but allow multiword phrases.
        parts = re.split(r"[,;|/]", s)
        for p in parts:
            t = _norm_ta(p)
            if len(t) < 2:
                continue
            out.append(t)
    # de-dupe (preserve order)
    seen = set()
    uniq = []
    for x in out:
        if x in seen:
            continue
        seen.add(x)
        uniq.append(x)
    return uniq


def _desired_adhikaram(domain_hint: str) -> str:
    d = _norm_en(domain_hint)
    # Explicit matches
    if "ezhuthu" in d:
        return "Ezhuthathikaram"
    if "sol" in d:
        return "Sollathikaram"
    # Most of the remaining ontology is Porul-centric
    return "Porulathikaram"


@dataclass(frozen=True)
class SutraHit:
    adhikaaram_ta: str
    adhikaaram: str
    iyal_ta: str
    iyal_eng: str
    noorpa: int
    paadal: str
    category: str
    meaning: str
    paadal_norm: str
    en_norm: str


SUTRA_INDEX: list[SutraHit] = []
_CACHE: dict[tuple[str, str], dict] = {}


def _build_index():
    if not thol_pkg or not hasattr(thol_pkg, "tk"):
        return

    for adh in thol_pkg.tk:
        adh_ta = _clean(adh.get("adhikaaram"))
        adh_rom = ADHIKARAM_ROM.get(adh_ta, adh_ta)
        for iyal in adh.get("iyal", []) or []:
            iyal_ta = _clean(iyal.get("iyal_name"))
            iyal_eng = _clean(iyal.get("iyal_eng"))
            for idx, noorpa in enumerate(iyal.get("noorpa", []) or [], start=1):
                paadal = _clean(noorpa.get("paadal"))
                vil = noorpa.get("vilakkam") or {}
                cat = _clean(vil.get("paadal_category"))
                meaning = _clean(vil.get("paadal_meaning"))

                SUTRA_INDEX.append(
                    SutraHit(
                        adhikaaram_ta=adh_ta,
                        adhikaaram=adh_rom,
                        iyal_ta=iyal_ta,
                        iyal_eng=iyal_eng,
                        noorpa=idx,
                        paadal=paadal,
                        category=cat,
                        meaning=meaning,
                        paadal_norm=_norm_ta(paadal),
                        en_norm=_norm_en(f"{cat} {meaning}"),
                    )
                )


_build_index()


def infer_sutra_evidence(
    *,
    english_label: str = "",
    tamil_label: str = "",
    synonyms_tamil: str = "",
    synonyms_english: str = "",
    keywords: str = "",
    description: str = "",
    domain_hint: str = "",
) -> dict:
    """Infer a sutra reference + extracted sentence from the installed tholkaappiyam corpus.

    Returns an evidence dict compatible with `node.evidence`:
      - source_section
      - sutra_reference
      - source_reference
      - extracted_sentence
    """
    cache_key = (_clean(english_label).lower(), _clean(domain_hint).lower())
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    if not SUTRA_INDEX:
        out = {
            "sutra_reference": "",
            "extracted_sentence": "",
        }
        _CACHE[cache_key] = out
        return out

    desired_book = _desired_adhikaram(domain_hint or "")

    ta_terms = _ta_terms(tamil_label, synonyms_tamil, keywords)
    en_terms = []
    for v in (english_label, synonyms_english, keywords, description):
        en_terms.extend(_en_tokens(v))
    # de-dupe (preserve order)
    seen = set()
    en_terms_uniq = []
    for w in en_terms:
        if w in seen:
            continue
        seen.add(w)
        en_terms_uniq.append(w)
    en_terms = en_terms_uniq

    # Phrase boosts
    desc_phrase = _norm_en(description)
    label_phrase = _norm_en(english_label)

    best = None
    best_score = -1

    for hit in SUTRA_INDEX:
        score = 0

        if hit.adhikaaram == desired_book:
            score += 3

        # Tamil direct matches in paadal (high weight)
        for t in ta_terms:
            if t and t in hit.paadal_norm:
                score += 6

        # English tokens in meaning/category (medium)
        for w in en_terms:
            if w and w in hit.en_norm:
                score += 2

        # Phrase boosts (small)
        if desc_phrase and len(desc_phrase) > 6 and desc_phrase in hit.en_norm:
            score += 4
        if label_phrase and len(label_phrase) > 6 and label_phrase in hit.en_norm:
            score += 3

        if score > best_score:
            best_score = score
            best = hit

    # Always return *something* if we have an index.
    if not best:
        best = SUTRA_INDEX[0]

    source_section = f"{best.adhikaaram} – {best.iyal_eng}" if best.iyal_eng else best.adhikaaram
    sutra_reference = (
        f"Tolkāppiyam – {best.adhikaaram} – {best.iyal_eng} – Sutra {best.noorpa}"
        if best.iyal_eng
        else f"Tolkāppiyam – {best.adhikaaram} – Sutra {best.noorpa}"
    )

    out = {
        "source_section": source_section,
        "sutra_reference": sutra_reference,
        "source_reference": f"Tolkāppiyam – {best.adhikaaram}",
        "extracted_sentence": best.paadal,
    }
    _CACHE[cache_key] = out
    return out

