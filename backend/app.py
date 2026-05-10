import os
import sys
import traceback
from io import BytesIO

from flask import Flask, render_template, request, jsonify, send_file

from thol_preprocess import preprocess_query
from classifier import classify_query
from simplifier import simplify_query
from ontology_mapper import get_subgraph
from explanation_generator import generate_explanation
from cognitive_architecture import build_cognitive_architecture
from translator import translate_texts
from pdf_report import build_pdf_report, now_kolkata
from guide_dialog import build_guide_dialog

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/query", methods=["POST"])
def query():
    try:
        data = request.get_json() or {}
        user_query = (data.get("query") or "").strip()
        ui_language = (data.get("language") or "both").strip()

        if not user_query:
            return jsonify({"error": "Empty query"}), 400

        print(f"\n[QUERY] {user_query}")

        # NLP pipeline
        clean = preprocess_query(user_query)
        print(f"[PRE] {clean}")

        theme = classify_query(clean)
        print(f"[THEME] {theme}")

        canonical = simplify_query(clean, theme)
        print(f"[CANON] {canonical}")

        # fallback if simplifier fails
        if not canonical:
            canonical = clean

        # Graph: keep results tightly related to the query (no auto-expansion / no full-graph fallback)
        depth = 2
        if isinstance(data, dict) and "depth" in data:
            try:
                depth = int(data.get("depth"))
            except (TypeError, ValueError):
                depth = 2
        depth = max(1, min(depth, 6))

        graph_data = get_subgraph(canonical, depth=depth) or {"nodes": [], "links": [], "meta": {}}

        # Fallbacks: keep the graph non-empty when canonical mapping fails.
        if not graph_data.get("nodes"):
            alt = get_subgraph(clean, depth=depth)
            if alt and alt.get("nodes"):
                graph_data = alt
                graph_data.setdefault("meta", {})["fallback"] = {"from": "canonical", "to": "clean"}
        if not graph_data.get("nodes") and theme:
            alt = get_subgraph(theme, depth=min(2, depth))
            if alt and alt.get("nodes"):
                graph_data = alt
                graph_data.setdefault("meta", {})["fallback"] = {"from": "clean", "to": "theme"}
        if not graph_data.get("nodes"):
            alt = get_subgraph("Tolkappiyam", depth=2)
            if alt and alt.get("nodes"):
                graph_data = alt
                graph_data.setdefault("meta", {})["fallback"] = {"from": "theme", "to": "Tolkappiyam"}

        # Ensure graph data is properly formatted
        if not graph_data.get("links"):
            graph_data["links"] = []

        print(f"[GRAPH] {len(graph_data['nodes'])} nodes, {len(graph_data['links'])} links")

        # Generate explanation
        explanation = generate_explanation(
            canonical,
            graph_data["nodes"],
            language=ui_language,
        )

        return jsonify(
            {
                "theme": theme,
                "canonical": canonical,
                "graph": graph_data,
                "explanation": explanation,
            }
        )

    except Exception as e:
        print("\n[ERROR] /query endpoint:")
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    "error": f"Internal server error: {str(e)}",
                    "details": traceback.format_exc(),
                }
            ),
            500,
        )


@app.route("/cognitive", methods=["POST"])
def cognitive():
    try:
        data = request.get_json() or {}
        concept = (data.get("concept") or "").strip()
        theme = (data.get("theme") or "").strip()
        canonical = (data.get("canonical") or "").strip()

        if not concept:
            return jsonify({"error": "Empty concept"}), 400

        model = build_cognitive_architecture(concept, theme=theme, canonical=canonical)
        if isinstance(model, dict) and model.get("error"):
            return jsonify(model), 400

        return jsonify(model)

    except Exception as e:
        print("\n[ERROR] /cognitive endpoint:")
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    "error": f"Internal server error: {str(e)}",
                    "details": traceback.format_exc(),
                }
            ),
            500,
        )


@app.route("/translate", methods=["POST"])
def translate():
    try:
        data = request.get_json() or {}
        target = (data.get("target") or "").strip()
        source = (data.get("source") or "English").strip()
        texts = data.get("texts") or []

        if not target:
            return jsonify({"error": "Missing target language"}), 400
        if not isinstance(texts, list) or not texts:
            return jsonify({"error": "Missing texts[]"}), 400

        # Keep this endpoint safe and fast (UI strings).
        # NOTE: Frontend also chunks requests, but we keep a hard limit as a guardrail.
        if len(texts) > 120:
            return jsonify({"error": "Too many texts (max 120)"}), 400
        safe_texts = [str(t)[:800] for t in texts]

        translations = translate_texts(safe_texts, target=target, source=source)
        return jsonify({"target": target, "translations": translations})

    except Exception as e:
        print("\n[ERROR] /translate endpoint:")
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    "error": f"Internal server error: {str(e)}",
                    "details": traceback.format_exc(),
                }
            ),
            500,
        ) 


@app.route("/export/pdf", methods=["POST"])
def export_pdf():
    try:
        payload = request.get_json() or {}

        language = (payload.get("language") or "en").strip().lower()
        graph = payload.get("graph") or {}
        nodes = graph.get("nodes") if isinstance(graph, dict) else None
        nodes = nodes if isinstance(nodes, list) else []

        selected_expl = (payload.get("explanation") or "").strip()
        concept = (payload.get("canonical") or payload.get("query") or "").strip()
        if not concept:
            return jsonify({"error": "Missing canonical/query for export"}), 400

        # Ensure we always include an English explanation in the report.
        if language == "en" and selected_expl:
            english_expl = selected_expl
        else:
            english_expl = generate_explanation(concept, nodes, language="en") or ""

        # Ensure a cognitive model is present (best-effort) for the report.
        if not isinstance(payload.get("cognitive"), dict):
            focal = (payload.get("focal") or "").strip() or concept
            try:
                payload["cognitive"] = build_cognitive_architecture(
                    focal,
                    theme=(payload.get("theme") or "").strip(),
                    canonical=(payload.get("canonical") or "").strip(),
                )
            except Exception:
                payload["cognitive"] = None

        generated_at = now_kolkata()
        pdf_bytes, filename = build_pdf_report(
            payload=payload,
            english_explanation=english_expl,
            generated_at=generated_at,
        )

        return send_file(
            BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        print("\n[ERROR] /export/pdf endpoint:")
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    "error": f"Internal server error: {str(e)}",
                    "details": traceback.format_exc(),
                }
            ),
            500,
        )


@app.route("/guide/dialog", methods=["POST"])
def guide_dialog():
    try:
        data = request.get_json() or {}
        concept = (data.get("concept") or "").strip()
        query = (data.get("query") or "").strip()
        theme = (data.get("theme") or "").strip()
        canonical = (data.get("canonical") or "").strip()
        language = (data.get("language") or "en").strip()

        result = build_guide_dialog(
            concept=concept,
            query=query,
            theme=theme,
            canonical=canonical,
            language=language,
        )
        if isinstance(result, dict) and result.get("error"):
            return jsonify(result), 400
        return jsonify(result)

    except Exception as e:
        print("\n[ERROR] /guide/dialog endpoint:")
        print(traceback.format_exc())
        return (
            jsonify(
                {
                    "error": f"Internal server error: {str(e)}",
                    "details": traceback.format_exc(),
                }
            ),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
