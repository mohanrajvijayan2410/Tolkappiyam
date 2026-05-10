from client import ask_gemini
from translator import LANGUAGE_NAME_BY_CODE


def generate_explanation(concept, related_nodes, language="both"):

    # Convert graph nodes safely
    if isinstance(related_nodes, list):
        related_nodes = [
            n.get("id", str(n)) if isinstance(n, dict) else str(n)
            for n in related_nodes
        ]


    related_text = ", ".join(related_nodes[:20])

    lang = (language or "both").strip().lower()

    if lang in {"both", "bi", "bilingual", "en+ta", "en_ta"}:
        prompt = f"""
You are a senior scholar of Classical Tamil literature specializing in Tolkāppiyam.

Your task is to generate a STRICTLY ACADEMIC explanation.

Concept:
{concept}

Related Concepts from Ontology:
{related_text}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
- ALWAYS provide BOTH English and Tamil explanations.
- English MUST come first.
- Tamil MUST come after English.
- Use the EXACT same structure in both languages.
- Do NOT skip any section.
- Do NOT add extra headings.
- Do NOT use bullet points.
- Do NOT hallucinate modern interpretations.
- Base explanation only on classical Tamil literary theory.

FORMAT (FOLLOW EXACTLY):

English Explanation:

Concept Meaning:
<paragraph>

Literary Context:
<paragraph>

Cultural / Ethical Significance:
<paragraph if relevant>

Tamil Explanation:

கருத்தின் பொருள்:
<paragraph>

இலக்கியச் சூழல்:
<paragraph>

பண்பாட்டு / அறநெறி முக்கியத்துவம்:
<paragraph if relevant>
"""
    elif lang in {"en", "english"}:
        prompt = f"""
You are a senior scholar of Classical Tamil literature specializing in Tolkāppiyam.

Your task is to generate a STRICTLY ACADEMIC explanation in English ONLY.

Concept:
{concept}

Related Concepts from Ontology:
{related_text}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
- Output ONLY in English.
- Do NOT add extra headings beyond the format below.
- Do NOT use bullet points.
- Do NOT hallucinate modern interpretations.
- Base explanation only on classical Tamil literary theory.

FORMAT (FOLLOW EXACTLY):

English Explanation:

Concept Meaning:
<paragraph>

Literary Context:
<paragraph>

Cultural / Ethical Significance:
<paragraph if relevant>
"""
    elif lang in {"ta", "tamil"}:
        prompt = f"""
You are a senior scholar of Classical Tamil literature specializing in Tolkāppiyam.

Your task is to generate a STRICTLY ACADEMIC explanation in Tamil ONLY.

Concept:
{concept}

Related Concepts from Ontology:
{related_text}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
- Output ONLY in Tamil.
- Do NOT add extra headings beyond the format below.
- Do NOT use bullet points.
- Do NOT hallucinate modern interpretations.
- Base explanation only on classical Tamil literary theory.

FORMAT (FOLLOW EXACTLY):

Tamil Explanation:

கருத்தின் பொருள்:
<paragraph>

இலக்கியச் சூழல்:
<paragraph>

பண்பாட்டு / அறநெறி முக்கியத்துவம்:
<paragraph if relevant>
"""
    else:
        target_name = LANGUAGE_NAME_BY_CODE.get(lang, language)
        prompt = f"""
You are a senior scholar of Classical Tamil literature specializing in Tolkāppiyam.

Your task is to generate a STRICTLY ACADEMIC explanation in {target_name} ONLY.

Concept:
{concept}

Related Concepts from Ontology:
{related_text}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
- Output ONLY in {target_name}.
- Use the same 3-section structure.
- Translate the section titles into {target_name}. If you are unsure, keep the English section titles.
- Do NOT add extra headings beyond the format below.
- Do NOT use bullet points.
- Do NOT hallucinate modern interpretations.
- Base explanation only on classical Tamil literary theory.

FORMAT (FOLLOW EXACTLY):

Explanation:

Concept Meaning:
<paragraph>

Literary Context:
<paragraph>

Cultural / Ethical Significance:
<paragraph if relevant>
"""

    try:
        return ask_gemini(prompt)

    except Exception as e:
        print("Gemini Error:", e)
        return "Explanation could not be generated at this time."
