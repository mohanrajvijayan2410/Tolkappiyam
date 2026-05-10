from client import ask_gemini

def simplify_query(query, theme):
    prompt = f"""
You are an expert in Tolkāppiyam ontology and classical Tamil literary theory.

Task:
Rewrite the given user query into a simplified, canonical form that aligns
strictly with Tolkāppiyam concepts.

Theme:
{theme}

User Query:
\"\"\"{query}\"\"\"

Guidelines:
- Remove ambiguity and conversational language
- Map modern or informal expressions to classical conceptual terms
- Ensure the output clearly reflects the given theme
- Keep the output concise (one short phrase or sentence)
- Use standard Tolkāppiyam terminology where applicable
- Do NOT explain the transformation
- Do NOT add extra commentary or formatting

Output Format:
Return ONLY the canonical query text.
"""
    return ask_gemini(prompt).strip()
