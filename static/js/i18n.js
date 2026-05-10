"use strict";

(() => {
  const STORAGE_KEY_LANG = "tolkappiyam.ui_lang";
  const STORAGE_KEY_CACHE_PREFIX = "tolkappiyam.i18n_cache.";

  const BASE_STRINGS = {
    app_title: "Tolkāppiyam Knowledge Graph",
    panel_query: "Query",
    query_placeholder: "e.g., Kurinji thinai",
    query_button: "Query Knowledge Graph",
    panel_search_node: "Search Node",
    search_placeholder: "Search node name…",
    find_node_button: "Find Node",
    panel_legend: "Legend",
    legend_thinai: "Thinai",
    legend_akam: "Akam",
    legend_puram: "Puram",
    legend_grammar: "Grammar",
    legend_ethics_culture: "Ethics / Culture",
    panel_graph_analytics: "Graph Analytics",
    stat_nodes: "Nodes",
    stat_relations: "Relations",
    stat_selected_degree: "Selected node degree",
    stat_no_node_selected: "No node selected",
    category_distribution: "Category distribution",
    graph_title: "Knowledge Graph",
    reset_view_title: "Reset view",
    export_pdf_title: "Export to PDF",
    switch_hierarchy_view: "Switch to Hierarchy View",
    switch_network_view: "Switch to Network View",
    empty_graph_text: "Run a query to render the graph",
    explanation_title: "Explanation & Insights",
    explanation_card_en: "English Explanation",
    explanation_card_ta: "Tamil Explanation",
    explanation_card_generic: "Explanation",
    meta_help: "Query the corpus to see the theme and canonical form.",
    view_cognitive_button: "View Cognitive Architecture",
    insights_empty: "Insights will appear after a query.",
    cognitive_title: "Cognitive Architecture",
    core_dimensions: "Core Dimensions",
    thinking_relations: "Thinking Relations",
    language_button: "Language",
    language_button_title: "Translate page",
    language_modal_title: "Translate this page",
    language_modal_subtitle: "Choose a language. The UI and explanations will switch.",
    language_search_placeholder: "Search languages…",

    // Tamil Arivu Guide
    guide_button: "Tamil Arivu Guide",
    guide_button_title: "Open Tamil Arivu Guide",
    guide_modal_title: "Tamil Arivu Guide",
    guide_speaker_male: "Arivu (Male)",
    guide_speaker_female: "Arivu (Female)",
    guide_loading: "Preparing a dialog…",
    guide_voice_on: "Voice: On",
    guide_voice_off: "Voice: Off",
    guide_voice_unavailable: "Voice: Not supported",
    guide_replay: "Replay",
    guide_refresh: "Refresh",
    guide_no_context: "Run a query or select a node to start the guide.",
    guide_empty: "No guide dialog available.",

    meta_theme: "Theme",
    meta_canonical: "Canonical",

    // Graph / modals
    node_modal_description: "Description",
    node_modal_no_description: "No description available.",
    node_modal_relationships: "Relationships",
    node_modal_no_relationships: "No relationships found.",

    // Alerts / errors
    alert_enter_query: "Please enter a query!",
    alert_enter_node: "Enter a node name to search!",
    alert_no_graph: "No graph loaded yet.",
    alert_node_not_found: "Node \"{name}\" not found.",
    error_prefix: "⚠",

    // Loading states
    loading_querying: "Querying the corpus…",
    loading_traversing: "Traversing the knowledge graph…",
    loading_translating: "Translating…",
    no_explanation: "No explanation available.",

    // Evidence viewer
    evidence_title: "Evidence Viewer (Source Trace)",
    evidence_source_section: "Source section",
    evidence_sutra_reference: "Sutra reference",
    evidence_source_reference: "Source reference",
    evidence_extracted_sentence: "Extracted sentence",
    evidence_row_id: "Row ID",
    evidence_not_available: "Not available yet.",
    evidence_no_metadata: "No evidence metadata found for this node.",

    // Distributions
    dist_empty: "No nodes to analyze.",
    legend_concept: "Concept",

    // Errors
    error_non_json: "Server returned non-JSON. Check Flask logs.",
    error_backend_non_json: "Backend error — check Flask terminal.",
    error_request_failed: "Request failed ({status})",

    // Cognitive modal
    cognitive_focal: "Focal",
    cognitive_dimension: "Dimension",
    cognitive_no_dimensions: "No dimensions available.",
    cognitive_no_relations: "No relations available.",
    alert_select_node_first: "Run a query and select a node to view the cognitive architecture.",
    cognitive_loading_dimensions: "Building core dimensions…",
    cognitive_loading_relations: "Scoring cognitive relations…",
    cognitive_strength_note:
      "Strength values are heuristic scores intended for comparative visualization, not absolute measurements.",

    // Relations (display)
    rel_related_to: "related to",
    rel_foundation_of: "foundation of",
    rel_governs: "governs",
    rel_depends_on: "depends on",
    rel_has_thinai: "has thinai",
    rel_classified_as: "classified as",
    rel_expressed_through: "expressed through",
    rel_defined_by: "defined by",
    rel_part_of: "part of",
    rel_includes: "includes",
    rel_associated_with: "associated with",
    rel_applies_to: "applies to",
    rel_restricted_to: "restricted to",
    rel_distinct_from: "distinct from",
    rel_social_value: "social value",
    rel_ethical_duty: "ethical duty",
    rel_has_section: "has section",
    rel_covers: "covers",
    rel_has_landscape: "has landscape",
    rel_expresses: "expresses",
    rel_associated_deity: "associated deity",
  };

  const TRANSLATIONS = {
    en: { ...BASE_STRINGS },
    ta: {
      app_title: "தொல்காப்பியம் அறிவு வரைபடம்",
      panel_query: "கேள்வி",
      query_placeholder: "உதா., குறிஞ்சி திணை",
      query_button: "அறிவு வரைபடத்தை கேள்",
      panel_search_node: "முனை தேடல்",
      search_placeholder: "முனை பெயர்…",
      find_node_button: "கண்டுபிடி",
      panel_legend: "விளக்கம்",
      legend_thinai: "திணை",
      legend_akam: "அகம்",
      legend_puram: "புறம்",
      legend_grammar: "இலக்கணம்",
      legend_ethics_culture: "அறம் / பண்பாடு",
      panel_graph_analytics: "வரைபட பகுப்பாய்வு",
      stat_nodes: "முனைகள்",
      stat_relations: "உறவுகள்",
      stat_selected_degree: "தேர்ந்த முனை தொடர்புகள்",
      stat_no_node_selected: "எந்த முனையும் தேர்ந்தெடுக்கப்படவில்லை",
      category_distribution: "வகை பகிர்வு",
      graph_title: "அறிவு வரைபடம்",
      reset_view_title: "பார்வை மீட்டமை",
      export_pdf_title: "PDF ஆக ஏற்றுமதி",
      switch_hierarchy_view: "அடுக்குக் காட்சி (Hierarchy)",
      switch_network_view: "வலைக் காட்சி (Network)",
      empty_graph_text: "வரைபடத்தை காண ஒரு கேள்வியை இயக்கவும்",
      explanation_title: "விளக்கம் & உள்ளுணர்வுகள்",
      explanation_card_en: "ஆங்கில விளக்கம்",
      explanation_card_ta: "தமிழ் விளக்கம்",
      explanation_card_generic: "விளக்கம்",
      meta_help: "கேள்வி இயக்கி தீம் மற்றும் நிர்ணய வடிவத்தை பார்க்கவும்.",
      view_cognitive_button: "அறிவியல் கட்டமைப்பைப் பார்க்க",
      insights_empty: "கேள்விக்குப் பிறகு உள்ளுணர்வுகள் தோன்றும்.",
      cognitive_title: "அறிவியல் கட்டமைப்பு",
      core_dimensions: "மூல பரிமாணங்கள்",
      thinking_relations: "சிந்தனை உறவுகள்",
      language_button: "மொழி",
      language_button_title: "மொழிபெயர்",
      language_modal_title: "இந்தப் பக்கத்தை மொழிபெயர்",
      language_modal_subtitle: "ஒரு மொழியைத் தேர்ந்தெடுக்கவும். UI மற்றும் விளக்கங்கள் மாறும்.",
      language_search_placeholder: "மொழிகளைத் தேடு…",

      guide_button: "தமிழ் அறிவு வழிகாட்டி",
      guide_button_title: "தமிழ் அறிவு வழிகாட்டியைத் திற",
      guide_modal_title: "தமிழ் அறிவு வழிகாட்டி",
      guide_speaker_male: "அறிவு (ஆண்)",
      guide_speaker_female: "அறிவு (பெண்)",
      guide_loading: "உரையாடலைத் தயாரிக்கிறது…",
      guide_voice_on: "குரல்: இயக்கு",
      guide_voice_off: "குரல்: நிறுத்து",
      guide_voice_unavailable: "குரல்: கிடைக்கவில்லை",
      guide_replay: "மீண்டும்",
      guide_refresh: "புதுப்பி",
      guide_no_context: "வழிகாட்டி தொடங்க ஒரு கேள்வியை இயக்கவும் அல்லது ஒரு முனையைத் தேர்ந்தெடுக்கவும்.",
      guide_empty: "உரையாடல் கிடைக்கவில்லை.",

      meta_theme: "தீம்",
      meta_canonical: "நிர்ணய வடிவு",

      node_modal_description: "விளக்கம்",
      node_modal_no_description: "விளக்கம் இல்லை.",
      node_modal_relationships: "உறவுகள்",
      node_modal_no_relationships: "உறவுகள் இல்லை.",

      alert_enter_query: "தயவுசெய்து ஒரு கேள்வியை உள்ளிடவும்!",
      alert_enter_node: "தேட ஒரு முனை பெயரை உள்ளிடவும்!",
      alert_no_graph: "வரைபடம் இன்னும் ஏற்றப்படவில்லை.",
      alert_node_not_found: "\"{name}\" என்ற முனை கிடைக்கவில்லை.",
      error_prefix: "⚠",

      loading_querying: "கோர்ப்பஸில் தேடுகிறது…",
      loading_traversing: "அறிவு வரைபடத்தைத் தாவுகிறது…",
      loading_translating: "மொழிபெயர்க்கிறது…",
      no_explanation: "விளக்கம் கிடைக்கவில்லை.",

      evidence_title: "ஆதார பார்வையாளர் (மூலத் தடம்)",
      evidence_source_section: "மூல பகுதி",
      evidence_sutra_reference: "சூத்திர குறிப்பு",
      evidence_source_reference: "மூல குறிப்பிடு",
      evidence_extracted_sentence: "எடுத்த மேற்கோள்",
      evidence_row_id: "வரிசை ஐடி",
      evidence_not_available: "இன்னும் கிடைக்கவில்லை.",
      evidence_no_metadata: "இந்த முனைக்கான ஆதாரத் தகவல் கிடைக்கவில்லை.",

      dist_empty: "பகுப்பாய்விற்கு முனைகள் இல்லை.",
      legend_concept: "கருத்து",

      error_non_json: "சேவையகம் JSON அல்லாத பதிலை அனுப்பியது. Flask பதிவுகளைச் சரிபார்க்கவும்.",
      error_backend_non_json: "Backend பிழை — Flask terminal-ஐ சரிபார்க்கவும்.",
      error_request_failed: "கோரிக்கை தோல்வி ({status})",

      cognitive_focal: "மையம்",
      cognitive_dimension: "பரிமாணம்",
      cognitive_no_dimensions: "பரிமாணங்கள் கிடைக்கவில்லை.",
      cognitive_no_relations: "உறவுகள் கிடைக்கவில்லை.",
      alert_select_node_first: "ஒரு கேள்வியை இயக்கி, ஒரு முனையைத் தேர்ந்தெடுத்து அறிவியல் கட்டமைப்பை பார்க்கவும்.",
      cognitive_loading_dimensions: "மூல பரிமாணங்களை உருவாக்குகிறது…",
      cognitive_loading_relations: "சிந்தனை உறவுகளை மதிப்பிடுகிறது…",

      cognitive_strength_note:
        "வலிமை மதிப்புகள் ஒப்பீட்டு காட்சிக்கான அனுமான மதிப்புகள்; முழுமையான அளவீடுகள் அல்ல.",

      rel_related_to: "தொடர்புடையது",
      rel_foundation_of: "அடித்தளம்",
      rel_governs: "நெறிப்படுத்துகிறது",
      rel_depends_on: "சார்ந்துள்ளது",
      rel_has_thinai: "திணைகள் கொண்டது",
      rel_classified_as: "வகைப்படுத்தல்",
      rel_expressed_through: "வழியாக வெளிப்படும்",
      rel_defined_by: "வரையறுக்கப்படுகிறது",
      rel_part_of: "ஒரு பகுதி",
      rel_includes: "உள்ளடக்குகிறது",
      rel_associated_with: "தொடர்புடையது",
      rel_applies_to: "பயன்படும்",
      rel_restricted_to: "வரையறுக்கப்பட்டது",
      rel_distinct_from: "வேறுபட்டது",
      rel_social_value: "சமூக மதிப்பு",
      rel_ethical_duty: "அறக் கடமை",
      rel_has_section: "பிரிவு கொண்டது",
      rel_covers: "விளக்குகிறது",
      rel_has_landscape: "நிலம் கொண்டது",
      rel_expresses: "வெளிப்படுத்துகிறது",
      rel_associated_deity: "தொடர்புடைய தெய்வம்",
    },
  };

  const LANGUAGES = [
    { code: "en", name: "English", native: "English" },
    { code: "ta", name: "Tamil", native: "தமிழ்" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "te", name: "Telugu", native: "తెలుగు" },
    { code: "ml", name: "Malayalam", native: "മലയാളം" },
    { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
    { code: "bn", name: "Bengali", native: "বাংলা" },
    { code: "mr", name: "Marathi", native: "मराठी" },
    { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
    { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "ur", name: "Urdu", native: "اردو" },
    { code: "as", name: "Assamese", native: "অসমীয়া" },
    { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
    { code: "sa", name: "Sanskrit", native: "संस्कृत" },
    { code: "sd", name: "Sindhi", native: "سنڌي" },
    { code: "ne", name: "Nepali", native: "नेपाली" },
    { code: "si", name: "Sinhala", native: "සිංහල" },
    { code: "ar", name: "Arabic", native: "العربية" },
    { code: "ps", name: "Pashto", native: "پښتو" },
    { code: "fa", name: "Persian", native: "فارسی" },
    { code: "he", name: "Hebrew", native: "עברית" },
    { code: "tr", name: "Turkish", native: "Türkçe" },
    { code: "ru", name: "Russian", native: "Русский" },
    { code: "uk", name: "Ukrainian", native: "Українська" },
    { code: "pl", name: "Polish", native: "Polski" },
    { code: "cs", name: "Czech", native: "Čeština" },
    { code: "sk", name: "Slovak", native: "Slovenčina" },
    { code: "hu", name: "Hungarian", native: "Magyar" },
    { code: "ro", name: "Romanian", native: "Română" },
    { code: "bg", name: "Bulgarian", native: "Български" },
    { code: "sr", name: "Serbian", native: "Српски" },
    { code: "hr", name: "Croatian", native: "Hrvatski" },
    { code: "sl", name: "Slovenian", native: "Slovenščina" },
    { code: "bs", name: "Bosnian", native: "Bosanski" },
    { code: "mk", name: "Macedonian", native: "Македонски" },
    { code: "sq", name: "Albanian", native: "Shqip" },
    { code: "nl", name: "Dutch", native: "Nederlands" },
    { code: "sv", name: "Swedish", native: "Svenska" },
    { code: "no", name: "Norwegian", native: "Norsk" },
    { code: "da", name: "Danish", native: "Dansk" },
    { code: "fi", name: "Finnish", native: "Suomi" },
    { code: "is", name: "Icelandic", native: "Íslenska" },
    { code: "el", name: "Greek", native: "Ελληνικά" },
    { code: "lt", name: "Lithuanian", native: "Lietuvių" },
    { code: "lv", name: "Latvian", native: "Latviešu" },
    { code: "et", name: "Estonian", native: "Eesti" },
    { code: "it", name: "Italian", native: "Italiano" },
    { code: "fr", name: "French", native: "Français" },
    { code: "es", name: "Spanish", native: "Español" },
    { code: "ca", name: "Catalan", native: "Català" },
    { code: "gl", name: "Galician", native: "Galego" },
    { code: "eu", name: "Basque", native: "Euskara" },
    { code: "pt", name: "Portuguese", native: "Português" },
    { code: "de", name: "German", native: "Deutsch" },
    { code: "ga", name: "Irish", native: "Gaeilge" },
    { code: "cy", name: "Welsh", native: "Cymraeg" },
    { code: "gd", name: "Scottish Gaelic", native: "Gàidhlig" },
    { code: "eo", name: "Esperanto", native: "Esperanto" },
    { code: "zh", name: "Chinese", native: "中文" },
    { code: "ja", name: "Japanese", native: "日本語" },
    { code: "ko", name: "Korean", native: "한국어" },
    { code: "th", name: "Thai", native: "ไทย" },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
    { code: "ms", name: "Malay", native: "Bahasa Melayu" },
    { code: "tl", name: "Filipino", native: "Filipino" },
    { code: "sw", name: "Swahili", native: "Kiswahili" },
    { code: "az", name: "Azerbaijani", native: "Azərbaycanca" },
    { code: "ka", name: "Georgian", native: "ქართული" },
    { code: "hy", name: "Armenian", native: "Հայերեն" },
    { code: "kk", name: "Kazakh", native: "Қазақша" },
    { code: "uz", name: "Uzbek", native: "Oʻzbekcha" },
    { code: "mn", name: "Mongolian", native: "Монгол" },
    { code: "am", name: "Amharic", native: "አማርኛ" },
    { code: "so", name: "Somali", native: "Soomaali" },
    { code: "zu", name: "Zulu", native: "isiZulu" },
    { code: "af", name: "Afrikaans", native: "Afrikaans" },
    { code: "yo", name: "Yoruba", native: "Yorùbá" },
    { code: "ig", name: "Igbo", native: "Igbo" },
    { code: "ha", name: "Hausa", native: "Hausa" },
    { code: "my", name: "Burmese", native: "မြန်မာ" },
    { code: "km", name: "Khmer", native: "ខ្មែរ" },
    { code: "lo", name: "Lao", native: "ລາວ" },
  ];

  let currentLang = "en";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function format(str, vars) {
    if (!vars) return str;
    return String(str).replaceAll(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );
  }

  function t(key, vars) {
    const dict =
      (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
        ? TRANSLATIONS[currentLang]
        : TRANSLATIONS.en;
    const str = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    return format(str, vars);
  }

  function normalizeLangCode(code) {
    return String(code || "")
      .trim()
      .toLowerCase()
      .split("-")[0];
  }

  function loadCachedTranslations(lang) {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_CACHE_PREFIX}${lang}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveCachedTranslations(lang, dict) {
    try {
      localStorage.setItem(`${STORAGE_KEY_CACHE_PREFIX}${lang}`, JSON.stringify(dict));
    } catch {}
  }

  async function ensureLanguage(lang) {
    if (!lang || TRANSLATIONS[lang]) return;

    const cached = loadCachedTranslations(lang);
    if (cached) {
      TRANSLATIONS[lang] = { ...BASE_STRINGS, ...cached };
      return;
    }

    const keys = Object.keys(BASE_STRINGS);
    const texts = keys.map((k) => BASE_STRINGS[k]);

    // Backend intentionally limits max texts per request (to keep prompts small).
    const chunkSize = 50;
    const translated = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);

      const res = await fetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: lang, source: "English", texts: chunk }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || !Array.isArray(payload.translations)) return;

      const part = payload.translations.map((v) => String(v ?? ""));
      if (part.length !== chunk.length) return;

      translated.push(...part);
    }

    if (translated.length !== texts.length) return;

    const dict = {};
    for (let i = 0; i < keys.length; i++) dict[keys[i]] = String(translated[i] ?? "");

    TRANSLATIONS[lang] = { ...BASE_STRINGS, ...dict };
    saveCachedTranslations(lang, dict);
  }

  function applyDomTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      el.setAttribute("title", t(key));
    });

    document.title = t("app_title");
  }

  function relationKey(relation) {
    const r = String(relation || "").replace(/^reverse_/, "");
    const key = `rel_${r}`;
    return Object.prototype.hasOwnProperty.call(BASE_STRINGS, key) ? key : "rel_related_to";
  }

  function getNodeDisplayName(node) {
    if (!node || typeof node !== "object") return String(node ?? "");
    if (currentLang === "ta") return node.tamil_label || node.id || "";
    return node.id || "";
  }

  function renderLanguageList(filter) {
    const list = document.getElementById("languageList");
    if (!list) return;

    const q = String(filter || "").trim().toLowerCase();
    const items = LANGUAGES.filter((l) => {
      if (!q) return true;
      return (
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q)
      );
    });

    const html = items
      .map((l) => {
        const isCurrent = normalizeLangCode(l.code) === currentLang;
        return `
          <button class="lang-item" type="button" data-lang="${escapeHtml(l.code)}">
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <div class="lang-name">${escapeHtml(l.name)}</div>
              <div class="lang-native">${escapeHtml(l.native)}</div>
            </div>
            ${isCurrent ? `<span class="lang-badge">✓</span>` : ""}
          </button>
        `;
      })
      .join("");

    list.innerHTML = html || `<div style="color:var(--text-muted);font-size:12px;padding:8px 2px;">No matches.</div>`;

    list.querySelectorAll(".lang-item").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const lang = normalizeLangCode(btn.getAttribute("data-lang"));
        await setLanguage(lang);
        closeLanguageModal();
      });
    });
  }

  function openLanguageModal() {
    const modal = document.getElementById("languageModal");
    if (!modal) return;
    modal.style.display = "block";

    const input = document.getElementById("languageSearch");
    if (input) {
      input.value = "";
      input.focus();
    }
    renderLanguageList("");
  }

  function closeLanguageModal() {
    const modal = document.getElementById("languageModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  async function setLanguage(lang) {
    const next = normalizeLangCode(lang) || "en";
    if (next === currentLang) return;

    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY_LANG, currentLang); } catch {}

    document.documentElement.lang = currentLang;
    await ensureLanguage(currentLang);
    applyDomTranslations();

    window.dispatchEvent(new CustomEvent("app:languageChanged", { detail: { lang: currentLang } }));
  }

  function getLanguage() {
    return currentLang;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const saved = (() => {
      try { return localStorage.getItem(STORAGE_KEY_LANG); } catch { return null; }
    })();

    currentLang = normalizeLangCode(saved) || "en";
    document.documentElement.lang = currentLang;
    await ensureLanguage(currentLang);
    applyDomTranslations();

    const openBtn = document.getElementById("openLanguageModal");
    if (openBtn) openBtn.addEventListener("click", openLanguageModal);

    const closeBtn = document.getElementById("closeLanguageModal");
    if (closeBtn) closeBtn.addEventListener("click", closeLanguageModal);

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("languageModal");
      if (modal && e.target === modal) closeLanguageModal();
    });

    const input = document.getElementById("languageSearch");
    if (input) {
      input.addEventListener("input", (e) => renderLanguageList(e.target.value));
    }
  });

  window.i18n = {
    t,
    getLanguage,
    setLanguage,
    relationKey,
    getNodeDisplayName,
  };
})();
