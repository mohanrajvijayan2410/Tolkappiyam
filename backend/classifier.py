from client import ask_gemini

def classify_query(query):
    prompt = f"""
You are an expert classical Tamil scholar and Tolkāppiyam domain specialist.

Your task is to identify the PRIMARY thematic domain of the given user query
based on the conceptual framework of Tolkāppiyam.

Allowed themes (choose ONLY ONE):
- Ezhuthu (Phonology)
- Sol (Morphology)
- Porul (Semantics / Meaning)
- Akam (Inner life, love, emotions)
- Puram (Outer life, war, society)
- Thinai (Landscape-based poetic classification)
- Ethics (Aram, moral philosophy)
- Culture (Tamil cultural practices and values)



User Query:
\"\"\"{query}\"\"\"


Instructions:
- Focus on the USER'S INTENT, not surface keywords
- Handle modern Tamil, classical Tamil, English, or mixed language
- If multiple themes seem relevant, choose the MOST dominant one
- Do NOT explain your answer
- Do NOT add extra words, punctuation, or formatting

Output format:
Return ONLY the theme name (exact spelling from the list above).
"""
    return ask_gemini(prompt).strip()
