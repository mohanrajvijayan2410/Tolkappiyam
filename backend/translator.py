import json
import re

from client import ask_gemini


LANGUAGE_NAME_BY_CODE = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "as": "Assamese",
    "or": "Odia",
    "sa": "Sanskrit",
    "sd": "Sindhi",
    "ne": "Nepali",
    "si": "Sinhala",
    "fr": "French",
    "es": "Spanish",
    "ca": "Catalan",
    "gl": "Galician",
    "eu": "Basque",
    "de": "German",
    "ga": "Irish",
    "cy": "Welsh",
    "gd": "Scottish Gaelic",
    "eo": "Esperanto",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "sv": "Swedish",
    "no": "Norwegian",
    "da": "Danish",
    "fi": "Finnish",
    "is": "Icelandic",
    "el": "Greek",
    "lt": "Lithuanian",
    "lv": "Latvian",
    "et": "Estonian",
    "ru": "Russian",
    "uk": "Ukrainian",
    "pl": "Polish",
    "cs": "Czech",
    "sk": "Slovak",
    "hu": "Hungarian",
    "ro": "Romanian",
    "bg": "Bulgarian",
    "sr": "Serbian",
    "hr": "Croatian",
    "sl": "Slovenian",
    "bs": "Bosnian",
    "mk": "Macedonian",
    "sq": "Albanian",
    "ar": "Arabic",
    "ps": "Pashto",
    "fa": "Persian",
    "he": "Hebrew",
    "tr": "Turkish",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "ms": "Malay",
    "tl": "Filipino",
    "sw": "Swahili",
    "az": "Azerbaijani",
    "ka": "Georgian",
    "hy": "Armenian",
    "kk": "Kazakh",
    "uz": "Uzbek",
    "mn": "Mongolian",
    "am": "Amharic",
    "so": "Somali",
    "zu": "Zulu",
    "af": "Afrikaans",
    "yo": "Yoruba",
    "ig": "Igbo",
    "ha": "Hausa",
    "my": "Burmese",
    "km": "Khmer",
    "lo": "Lao",
}


def _strip_code_fences(text: str) -> str:
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _safe_json_array(text: str):
    s = _strip_code_fences(text)
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else None
    except Exception:
        pass

    # Try extracting the first JSON array.
    m = re.search(r"\[.*\]", s, flags=re.DOTALL)
    if not m:
        return None
    try:
        v = json.loads(m.group(0))
        return v if isinstance(v, list) else None
    except Exception:
        return None


def translate_texts(texts: list[str], target: str, source: str = "English") -> list[str]:
    """Translate a list of short UI strings using Gemini.

    - Returns the same number of strings as input; falls back to originals on error.
    """
    if not isinstance(texts, list) or not texts:
        return []

    clean = [str(t) if t is not None else "" for t in texts]
    target = (target or "").strip()
    if not target:
        return clean

    target_name = LANGUAGE_NAME_BY_CODE.get(target.lower(), target)

    numbered = "\n".join([f"{i+1}. {t}" for i, t in enumerate(clean)])

    prompt = f"""
You are a professional UI translator.

Translate the following UI strings from {source} to {target_name}.

CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON array of strings.
- Keep the SAME order and SAME number of items.
- Do NOT add explanations.
- Do NOT add extra keys or metadata.
- Keep punctuation and meaning intact.

Strings:
{numbered}
"""

    raw = ask_gemini(prompt) or ""
    arr = _safe_json_array(raw)
    if not arr:
        return clean

    out = [str(x) for x in arr]
    if len(out) != len(clean):
        return clean
    return out
