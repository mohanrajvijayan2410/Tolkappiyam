import json
import re
import threading
import time
from urllib import error, request

import google.generativeai as genai

from config import (
    GEMINI_API_KEYS,
    GEMINI_MODEL_NAME,
    GROQ_API_KEYS,
    GROQ_MODEL_NAME,
    LLM_PROVIDER_ORDER,
    LLM_REQUEST_TIMEOUT_SECONDS,
)


_GEMINI_LOCK = threading.Lock()
_CURSOR_LOCK = threading.Lock()
_PROVIDER_CURSOR = {"gemini": 0, "groq": 0}
_PROVIDER_COOLDOWNS = {"gemini": {}, "groq": {}}


def _key_label(provider, index, total):
    return f"{provider} key {index + 1}/{total}"


def _next_start_index(provider, total):
    if total <= 0:
        return 0

    with _CURSOR_LOCK:
        start = _PROVIDER_CURSOR.get(provider, 0) % total
        _PROVIDER_CURSOR[provider] = (start + 1) % total

    return start


def _candidate_indices(provider, total):
    if total <= 0:
        return [], []

    now = time.monotonic()
    start = _next_start_index(provider, total)

    with _CURSOR_LOCK:
        cooldowns = dict(_PROVIDER_COOLDOWNS.get(provider, {}))

    available = []
    cooling = []

    for offset in range(total):
        index = (start + offset) % total
        cooldown_until = cooldowns.get(index, 0.0)
        if cooldown_until > now:
            cooling.append((index, cooldown_until - now))
        else:
            available.append(index)

    return available, cooling


def _mark_success(provider, index):
    with _CURSOR_LOCK:
        _PROVIDER_CURSOR[provider] = index + 1
        _PROVIDER_COOLDOWNS.setdefault(provider, {}).pop(index, None)


def _mark_failure(provider, index, total, cooldown_seconds=0.0):
    if total <= 0:
        return

    with _CURSOR_LOCK:
        _PROVIDER_CURSOR[provider] = (index + 1) % total
        if cooldown_seconds > 0:
            _PROVIDER_COOLDOWNS.setdefault(provider, {})[index] = (
                time.monotonic() + cooldown_seconds
            )


def _extract_retry_after_seconds(message):
    if not message:
        return None

    match = re.search(r"retry in\s+(\d+(?:\.\d+)?)s", message, flags=re.IGNORECASE)
    if match:
        return float(match.group(1))

    match = re.search(r'"retry_delay"\s*:\s*\{\s*"seconds"\s*:\s*(\d+)', message)
    if match:
        return float(match.group(1))

    return None


def _failure_cooldown_seconds(error_text):
    message = (error_text or "").lower()
    is_rate_limited = any(
        marker in message
        for marker in (
            "429",
            "quota exceeded",
            "rate limit",
            "resource_exhausted",
            "too many requests",
        )
    )
    if not is_rate_limited:
        return 0.0

    retry_after = _extract_retry_after_seconds(error_text)
    if retry_after is None:
        retry_after = 30.0

    return max(retry_after, 5.0) + 1.0


def _extract_gemini_text(response):
    try:
        text = getattr(response, "text", None)
        if text:
            return text.strip()
    except Exception:
        pass

    parts = []
    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            text = getattr(part, "text", None)
            if text:
                parts.append(text.strip())

    return "\n".join(part for part in parts if part).strip()


def _ask_with_gemini(prompt, api_key):
    # google.generativeai uses a module-level configure call, so we serialize requests
    # here to avoid cross-request key races while rotating keys.
    with _GEMINI_LOCK:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)

    text = _extract_gemini_text(response)
    if not text:
        raise RuntimeError("Gemini returned an empty response.")
    return text


def _ask_with_groq(prompt, api_key):
    payload = json.dumps(
        {
            "model": GROQ_MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")

    api_request = request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=LLM_REQUEST_TIMEOUT_SECONDS) as response:
            raw_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Groq HTTP {exc.code}: {error_body}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Groq network error: {exc.reason}") from exc

    data = json.loads(raw_body)
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no choices.")

    message = choices[0].get("message") or {}
    text = (message.get("content") or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty response.")

    return text


def ask_gemini(prompt):
    """
    Sends the prompt to the configured LLM providers.

    Order is controlled by LLM_PROVIDER_ORDER in .env. Each provider rotates
    through its configured keys and automatically falls through on failure.
    """
    clean_prompt = (prompt or "").strip()
    if not clean_prompt:
        return ""

    providers = {
        "gemini": {
            "keys": GEMINI_API_KEYS,
            "enabled": bool(GEMINI_API_KEYS),
            "handler": _ask_with_gemini,
        },
        "groq": {
            "keys": GROQ_API_KEYS,
            "enabled": bool(GROQ_API_KEYS and GROQ_MODEL_NAME),
            "handler": _ask_with_groq,
        },
    }

    attempted = False
    errors = []

    for provider_name in LLM_PROVIDER_ORDER:
        provider = providers.get(provider_name)
        if not provider or not provider["enabled"]:
            continue

        keys = provider["keys"]
        available_indices, cooling_indices = _candidate_indices(provider_name, len(keys))

        if not available_indices:
            if cooling_indices:
                shortest_wait = min(wait for _, wait in cooling_indices)
                print(
                    f"[LLM] Skipping {provider_name}: all {len(keys)} keys are cooling down. "
                    f"Shortest retry in {shortest_wait:.1f}s."
                )
            continue

        for index in available_indices:
            attempted = True
            key = keys[index]

            try:
                text = provider["handler"](clean_prompt, key)
                _mark_success(provider_name, index)
                return text
            except Exception as exc:
                error_text = str(exc)
                cooldown_seconds = _failure_cooldown_seconds(error_text)
                _mark_failure(
                    provider_name,
                    index,
                    len(keys),
                    cooldown_seconds=cooldown_seconds,
                )
                label = _key_label(provider_name, index, len(keys))
                if cooldown_seconds > 0:
                    message = (
                        f"{label} failed and will cool down for "
                        f"{cooldown_seconds:.1f}s: {error_text}"
                    )
                else:
                    message = f"{label} failed: {error_text}"
                errors.append(message)
                print(f"[LLM] {message}")

    if not attempted:
        print(
            "[LLM] No API keys configured. Add GEMINI_API_KEY_1 / GROQ_API_KEY_1 entries to .env."
        )
    elif errors:
        print(f"[LLM] All configured providers failed. Last error: {errors[-1]}")

    return ""
