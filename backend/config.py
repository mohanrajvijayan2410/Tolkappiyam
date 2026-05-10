import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


def _dedupe(values):
    seen = set()
    ordered = []
    for value in values:
        clean = (value or "").strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        ordered.append(clean)
    return ordered


def _split_values(raw_value):
    if not raw_value:
        return []

    text = raw_value.strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass

    return [part.strip() for part in re.split(r"[\r\n,;]+", text) if part.strip()]


def _collect_api_keys(primary_prefix, *alias_prefixes):
    prefixes = (primary_prefix,) + alias_prefixes
    collected = []
    indexed = []

    for prefix in prefixes:
        collected.extend(_split_values(os.getenv(f"{prefix}_API_KEYS")))

        single_key = (os.getenv(f"{prefix}_API_KEY") or "").strip()
        if single_key:
            indexed.append((0, single_key))

        pattern = re.compile(rf"{re.escape(prefix)}_API_KEY_(\d+)$")
        for env_name, env_value in os.environ.items():
            match = pattern.fullmatch(env_name)
            if not match:
                continue

            clean_value = (env_value or "").strip()
            if clean_value:
                indexed.append((int(match.group(1)), clean_value))

    indexed.sort(key=lambda item: item[0])
    collected.extend([value for _, value in indexed])
    return _dedupe(collected)


def _collect_provider_order():
    raw_order = (
        os.getenv("LLM_PROVIDER_ORDER")
        or os.getenv("AI_PROVIDER_ORDER")
        or "gemini,groq"
    )
    supported = {"gemini", "groq"}
    order = []

    for provider in _split_values(raw_order):
        clean = provider.strip().lower()
        if clean in supported and clean not in order:
            order.append(clean)

    return order or ["gemini", "groq"]


GEMINI_MODEL_NAME = (
    os.getenv("GEMINI_MODEL_NAME")
    or os.getenv("MODEL_NAME")
    or "models/gemini-2.5-flash"
).strip()

GROQ_MODEL_NAME = (os.getenv("GROQ_MODEL_NAME") or "llama-3.1-8b-instant").strip()

GEMINI_API_KEYS = _collect_api_keys("GEMINI", "GOOGLE")
GROQ_API_KEYS = _collect_api_keys("GROQ")
LLM_PROVIDER_ORDER = _collect_provider_order()
LLM_REQUEST_TIMEOUT_SECONDS = int(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS") or "45")

# Backward-compatible names for older imports.
MODEL_NAME = GEMINI_MODEL_NAME
_API_KEY = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else ""
