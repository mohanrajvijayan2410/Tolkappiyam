from __future__ import annotations

import base64
import io
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from xml.sax.saxutils import escape as xml_escape

from translator import LANGUAGE_NAME_BY_CODE


def _register_report_font() -> str:
    candidates = []

    windir = os.environ.get("WINDIR") or r"C:\Windows"
    candidates.extend(
        [
            os.path.join(windir, "Fonts", "Nirmala.ttc"),  # broad Indic coverage (Windows)
            os.path.join(windir, "Fonts", "segoeui.ttf"),
        ]
    )

    candidates.extend(
        [
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    )

    for path in candidates:
        try:
            if not path or not os.path.exists(path):
                continue
            name = f"ReportFont-{os.path.basename(path)}"
            pdfmetrics.registerFont(TTFont(name, path))
            return name
        except Exception:
            continue

    return "Helvetica"


_REPORT_FONT = _register_report_font()


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def _data_url_to_bytes(data_url: str) -> bytes | None:
    s = _safe_text(data_url)
    if not s:
        return None
    m = re.match(r"^data:image/[^;]+;base64,(.+)$", s)
    if not m:
        return None
    try:
        return base64.b64decode(m.group(1), validate=False)
    except Exception:
        return None


def _fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S %Z")


EXPLANATION_KEYS = (
    "Concept Meaning",
    "Literary Context",
    "Cultural / Ethical Significance",
)


def _strip_explanation_markers(text: str) -> str:
    t = _safe_text(text)
    if not t:
        return ""

    # Drop common lead-in markers, keeping the actual 3-section content.
    for marker in (
        "English Explanation:",
        "Tamil Explanation:",
        "Explanation:",
    ):
        if marker in t:
            t = t.replace(marker, "")

    return t.strip()


_TA_HEADINGS = {
    "கருத்தின் பொருள்": "Concept Meaning",
    "இலக்கியச் சூழல்": "Literary Context",
    "பண்பாட்டு / அறநெறி முக்கியத்துவம்": "Cultural / Ethical Significance",
    "பண்பாட்டு/அறநெறி முக்கியத்துவம்": "Cultural / Ethical Significance",
}


def _heading_key(raw_heading: str) -> str | None:
    h = _safe_text(raw_heading).rstrip(":").strip()
    if not h:
        return None

    hl = h.lower()
    if hl == "concept meaning":
        return "Concept Meaning"
    if hl == "literary context":
        return "Literary Context"
    if hl.replace(" ", "") in {
        "cultural/ethicalsignificance",
        "cultural/ethicalsignificance",
    }:
        return "Cultural / Ethical Significance"
    if hl == "cultural / ethical significance":
        return "Cultural / Ethical Significance"

    if h in _TA_HEADINGS:
        return _TA_HEADINGS[h]

    return None


@dataclass(frozen=True)
class ExplanationSections:
    concept_meaning: str = ""
    literary_context: str = ""
    cultural_ethical_significance: str = ""

    def as_dict(self) -> dict[str, str]:
        return {
            "Concept Meaning": self.concept_meaning,
            "Literary Context": self.literary_context,
            "Cultural / Ethical Significance": self.cultural_ethical_significance,
        }


def parse_explanation_sections(raw: str) -> ExplanationSections:
    text = _strip_explanation_markers(raw)
    if not text:
        return ExplanationSections()

    lines = text.split("\n")
    blocks: list[tuple[str, list[str]]] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    heading_re = re.compile(r"^\s*(.+?)\s*:\s*$")

    def flush():
        nonlocal current_heading, current_lines
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        blocks.append((current_heading, [content] if content else []))
        current_heading = None
        current_lines = []

    for line in lines:
        m = heading_re.match(line)
        if m:
            flush()
            current_heading = m.group(1).strip()
            continue
        current_lines.append(line)
    flush()

    # Map by explicit heading names when possible.
    mapped: dict[str, str] = {k: "" for k in EXPLANATION_KEYS}
    ordered_contents: list[str] = []

    for heading, content_lines in blocks:
        content = "\n".join(content_lines).strip()
        if not content:
            continue
        key = _heading_key(heading)
        if key:
            mapped[key] = content
        else:
            ordered_contents.append(content)

    # If some sections are missing but we have ordered blocks, fill by order.
    if ordered_contents:
        for key, value in list(mapped.items()):
            if value:
                continue
            if not ordered_contents:
                break
            mapped[key] = ordered_contents.pop(0)

    # Final fallback: split into paragraphs.
    if not any(mapped.values()):
        paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        for idx, k in enumerate(EXPLANATION_KEYS):
            if idx < len(paras):
                mapped[k] = paras[idx]

    return ExplanationSections(
        concept_meaning=mapped.get("Concept Meaning", ""),
        literary_context=mapped.get("Literary Context", ""),
        cultural_ethical_significance=mapped.get("Cultural / Ethical Significance", ""),
    )


class CognitiveFlowDiagram(Flowable):
    def __init__(self, steps: list[str], *, font_name: str, font_size: int = 10):
        super().__init__()
        self.steps = [s for s in steps if _safe_text(s)]
        self.font_name = font_name
        self.font_size = int(font_size)

        self._box_h = 20
        self._gap = 10
        self._pad_x = 8
        self._pad_y = 6

        self.width = 0
        self.height = 0
        self._box_w = 0

    def wrap(self, availWidth, availHeight):
        self._box_w = max(240, int(availWidth))
        n = len(self.steps)
        self.height = n * self._box_h + max(0, n - 1) * self._gap + 6
        self.width = self._box_w
        return self.width, self.height

    def draw(self):
        if not self.steps:
            return

        c = self.canv
        c.saveState()
        c.setFont(self.font_name, self.font_size)

        box_w = self._box_w
        box_h = self._box_h
        gap = self._gap

        x = 0
        y_top = self.height - box_h

        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setFillColor(colors.white)

        for i, step in enumerate(self.steps):
            y = y_top - i * (box_h + gap)

            c.setLineWidth(1)
            c.roundRect(x, y, box_w, box_h, radius=6, stroke=1, fill=1)

            c.setFillColor(colors.HexColor("#0f172a"))
            c.drawCentredString(x + box_w / 2, y + (box_h / 2) - (self.font_size / 3), step)
            c.setFillColor(colors.white)

            if i < len(self.steps) - 1:
                y_mid = y - gap / 2
                c.setStrokeColor(colors.HexColor("#64748b"))
                c.line(x + box_w / 2, y, x + box_w / 2, y - gap + 2)
                # arrow head
                c.line(x + box_w / 2, y - gap + 2, x + box_w / 2 - 4, y - gap + 6)
                c.line(x + box_w / 2, y - gap + 2, x + box_w / 2 + 4, y - gap + 6)
                c.setStrokeColor(colors.HexColor("#94a3b8"))

        c.restoreState()


def build_pdf_report(*, payload: dict, english_explanation: str, generated_at: datetime) -> tuple[bytes, str]:
    language_code = _safe_text(payload.get("language") or "en").lower() or "en"
    language_name = LANGUAGE_NAME_BY_CODE.get(language_code, language_code)

    query = _safe_text(payload.get("query"))
    theme = _safe_text(payload.get("theme"))
    canonical = _safe_text(payload.get("canonical"))
    focal = _safe_text(payload.get("focal"))

    selected_explanation = _safe_text(payload.get("explanation"))

    graph = payload.get("graph") or {}
    nodes = graph.get("nodes") if isinstance(graph, dict) else None
    links = graph.get("links") if isinstance(graph, dict) else None
    nodes = nodes if isinstance(nodes, list) else []
    links = links if isinstance(links, list) else []

    graph_img_bytes = _data_url_to_bytes(payload.get("graph_image") or "")

    cognitive = payload.get("cognitive") if isinstance(payload.get("cognitive"), dict) else None

    styles = getSampleStyleSheet()

    normal = ParagraphStyle(
        "ReportNormal",
        parent=styles["Normal"],
        fontName=_REPORT_FONT,
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
    )
    small = ParagraphStyle(
        "ReportSmall",
        parent=normal,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    title = ParagraphStyle(
        "ReportTitle",
        parent=normal,
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    h1 = ParagraphStyle(
        "ReportH1",
        parent=normal,
        fontSize=13,
        leading=16,
        spaceBefore=14,
        spaceAfter=6,
    )
    h2 = ParagraphStyle(
        "ReportH2",
        parent=normal,
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.HexColor("#1e293b"),
    )
    mono = ParagraphStyle(
        "ReportMono",
        parent=small,
        fontName=_REPORT_FONT,
        fontSize=9,
        leading=11,
    )
    explanation_body = ParagraphStyle(
        "ExplanationBody",
        parent=normal,
        fontSize=10.5,
        leading=10.5,  # 1.0 line spacing
        alignment=TA_LEFT,
    )

    def P(txt: str, style: ParagraphStyle = normal) -> Paragraph:
        safe = xml_escape(_safe_text(txt)).replace("\n", "<br/>")
        return Paragraph(safe or "—", style)

    story = []

    # --- Title Section ---
    story.append(Paragraph("Tolkāppiyam Knowledge Graph — Report", title))
    story.append(Paragraph(f"Generated: {_fmt_ts(generated_at)}", small))
    story.append(Paragraph(f"Selected language: {xml_escape(language_name)} ({xml_escape(language_code)})", small))
    if query:
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Query:</b> {xml_escape(query)}", normal))
    if theme or canonical:
        story.append(Paragraph(f"<b>Theme:</b> {xml_escape(theme) or '—'}", normal))
        story.append(Paragraph(f"<b>Canonical:</b> {xml_escape(canonical) or '—'}", normal))

    # --- Explanation Section ---
    story.append(Paragraph("Explanation", h1))

    en_sections = parse_explanation_sections(english_explanation)
    sel_sections = parse_explanation_sections(selected_explanation) if selected_explanation else ExplanationSections()

    story.append(Paragraph("English (default)", h2))
    for key in EXPLANATION_KEYS:
        story.append(Paragraph(key, h2))
        story.append(P(en_sections.as_dict().get(key, ""), explanation_body))
        story.append(Spacer(1, 4))

    story.append(Paragraph(f"Selected language — {language_name}", h2))
    if language_code == "en":
        story.append(P("Same as the English (default) explanation.", explanation_body))
        story.append(Spacer(1, 6))
    else:
        for key in EXPLANATION_KEYS:
            story.append(Paragraph(key, h2))
            story.append(P(sel_sections.as_dict().get(key, ""), explanation_body))
            story.append(Spacer(1, 4))

    # --- Ontology Relationships ---
    story.append(PageBreak())
    story.append(Paragraph("Ontology Relationships", h1))

    if nodes:
        story.append(Paragraph("Entities", h2))
        node_rows = [["Entity", "Tamil label", "Category"]]
        for n in sorted(nodes, key=lambda x: str((x or {}).get("id", ""))):
            if not isinstance(n, dict):
                continue
            node_rows.append(
                [
                    P(n.get("id", ""), mono),
                    P(n.get("tamil_label", ""), mono),
                    P(n.get("category", ""), mono),
                ]
            )
        node_table = Table(node_rows, colWidths=[6.0 * cm, 6.2 * cm, 3.6 * cm], repeatRows=1)
        node_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(node_table)
        story.append(Spacer(1, 10))

    if links:
        story.append(Paragraph("Relationships", h2))
        rel_rows = [["Source", "Relation", "Target"]]
        for l in links:
            if not isinstance(l, dict):
                continue
            rel = _safe_text(l.get("relation")).replace("reverse_", "")
            rel_rows.append(
                [
                    P(l.get("source", ""), mono),
                    P(rel.replace("_", " "), mono),
                    P(l.get("target", ""), mono),
                ]
            )
        rel_table = Table(rel_rows, colWidths=[6.0 * cm, 4.8 * cm, 5.0 * cm], repeatRows=1)
        rel_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(rel_table)

    # --- Sutra Evidence ---
    story.append(PageBreak())
    story.append(Paragraph("Sutra Evidence", h1))

    evidence_items: list[dict[str, str]] = []
    seen_ev = set()

    def add_ev(concept_id: str, ev: dict):
        if not isinstance(ev, dict):
            return
        sutra_ref = _safe_text(ev.get("sutra_reference"))
        extracted = _safe_text(ev.get("extracted_sentence"))
        source_section = _safe_text(ev.get("source_section"))
        source_reference = _safe_text(ev.get("source_reference"))

        if not (sutra_ref or extracted or source_section or source_reference):
            return

        key = (sutra_ref, extracted, source_section, source_reference)
        if key in seen_ev:
            return
        seen_ev.add(key)
        evidence_items.append(
            {
                "concept": _safe_text(concept_id),
                "sutra_reference": sutra_ref,
                "source_section": source_section,
                "source_reference": source_reference,
                "extracted_sentence": extracted,
            }
        )

    for n in nodes:
        if not isinstance(n, dict):
            continue
        add_ev(_safe_text(n.get("id")), n.get("evidence") or {})

    for l in links:
        if not isinstance(l, dict):
            continue
        add_ev(f"{_safe_text(l.get('source'))} → {_safe_text(l.get('target'))}", l.get("evidence") or {})

    if not evidence_items:
        story.append(Paragraph("No sutra evidence metadata is available for the current graph.", normal))
    else:
        story.append(
            Paragraph(
                "Evidence entries are shown as flowing text blocks to avoid page layout errors for long passages.",
                small,
            )
        )
        story.append(Spacer(1, 8))

        for idx, item in enumerate(evidence_items, start=1):
            concept = item.get("concept", "") or "—"
            sutra_ref = item.get("sutra_reference", "")
            source_section = item.get("source_section", "")
            source_reference = item.get("source_reference", "")
            extracted = item.get("extracted_sentence", "")

            story.append(Paragraph(f"<b>{idx}. Concept:</b> {xml_escape(concept)}", normal))
            if sutra_ref:
                story.append(Paragraph(f"<b>Sutra reference:</b> {xml_escape(sutra_ref)}", small))
            if source_section:
                story.append(Paragraph(f"<b>Source section:</b> {xml_escape(source_section)}", small))
            if source_reference:
                story.append(Paragraph(f"<b>Source reference:</b> {xml_escape(source_reference)}", small))
            if extracted:
                story.append(Spacer(1, 4))
                story.append(P(extracted, normal))

            story.append(Spacer(1, 10))

    # --- Knowledge Graph ---
    story.append(PageBreak())
    story.append(Paragraph("Knowledge Graph", h1))
    if graph_img_bytes:
        img = Image(io.BytesIO(graph_img_bytes))
        max_w = 17.0 * cm
        max_h = 20.0 * cm
        scale = min(max_w / max(1, img.imageWidth), max_h / max(1, img.imageHeight))
        img.drawWidth = img.imageWidth * scale
        img.drawHeight = img.imageHeight * scale
        story.append(img)
        story.append(Spacer(1, 8))
        story.append(Paragraph("Graph visualization captured from the UI.", small))
    else:
        story.append(Paragraph("Graph visualization was not provided.", normal))

    # --- Cognitive Architecture Flow ---
    story.append(PageBreak())
    story.append(Paragraph("Cognitive Architecture Flow", h1))

    flow_steps = [
        "User Query",
        "Preprocess Query",
        "Theme Classification",
        "Canonical Simplification",
        "Ontology Subgraph Extraction",
        "Explanation Generation",
        "Cognitive Architecture Scoring",
        "UI Visualization",
        "PDF Report Export",
    ]
    story.append(CognitiveFlowDiagram(flow_steps, font_name=_REPORT_FONT, font_size=9))
    story.append(Spacer(1, 10))

    if cognitive and isinstance(cognitive, dict):
        story.append(Paragraph("Cognitive model (current focal concept)", h2))
        focal_label = _safe_text(cognitive.get("focal") or focal) or "—"
        story.append(Paragraph(f"<b>Focal:</b> {xml_escape(focal_label)}", normal))
        if cognitive.get("theme") or theme:
            story.append(Paragraph(f"<b>Theme:</b> {xml_escape(_safe_text(cognitive.get('theme') or theme) or '—')}", normal))
        if cognitive.get("canonical") or canonical:
            story.append(Paragraph(f"<b>Canonical:</b> {xml_escape(_safe_text(cognitive.get('canonical') or canonical) or '—')}", normal))
        story.append(Spacer(1, 8))

        dims = cognitive.get("dimensions") if isinstance(cognitive.get("dimensions"), list) else []
        if dims:
            dim_rows = [["Dimension", "Weight"]]
            for d in dims:
                if not isinstance(d, dict):
                    continue
                dim_rows.append([P(d.get("dimension", ""), mono), P(f"{float(d.get('weight', 0.0)):.2f}", mono)])
            dim_table = Table(dim_rows, colWidths=[9.0 * cm, 3.0 * cm], repeatRows=1)
            dim_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(Paragraph("Core dimensions", h2))
            story.append(dim_table)
            story.append(Spacer(1, 10))

        rels = cognitive.get("relations") if isinstance(cognitive.get("relations"), list) else []
        if rels:
            rel_rows2 = [["Relation", "Target", "Weight", "Basis"]]
            for r in rels:
                if not isinstance(r, dict):
                    continue
                basis = r.get("basis") if isinstance(r.get("basis"), dict) else {}
                basis_str = " • ".join([_safe_text(basis.get("type")), _safe_text(basis.get("relation") or basis.get("field"))]).strip(" •")
                rel_rows2.append(
                    [
                        P(_safe_text(r.get("relation", "")).replace("_", " "), mono),
                        P(r.get("target", ""), mono),
                        P(f"{float(r.get('weight', 0.0)):.2f}", mono),
                        P(basis_str, mono),
                    ]
                )
            rel_table2 = Table(rel_rows2, colWidths=[4.0 * cm, 5.4 * cm, 2.2 * cm, 3.8 * cm], repeatRows=1)
            rel_table2.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(Paragraph("Thinking relations", h2))
            story.append(rel_table2)

        note = _safe_text(cognitive.get("note"))
        if note:
            story.append(Spacer(1, 10))
            story.append(P(note, small))

    else:
        story.append(Paragraph("Cognitive model data was not provided.", normal))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        title="Tolkāppiyam Knowledge Graph Report",
        author="Tolkāppiyam AI",
    )
    doc.build(story)
    pdf_bytes = buf.getvalue()

    safe_stamp = generated_at.strftime("%Y%m%d-%H%M%S")
    filename = f"tolkappiyam-report-{safe_stamp}.pdf"
    return pdf_bytes, filename


def now_kolkata() -> datetime:
    try:
        return datetime.now(ZoneInfo("Asia/Kolkata"))
    except Exception:
        return datetime.now()
