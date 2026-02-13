(function () {
  const DEFAULT_LANG = "en";
  const SUPPORTED = new Set(["en", "zh", "ja"]);
  const STORAGE_KEY = "irp_lang";

  function getLang() {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("lang");
    const stored = localStorage.getItem(STORAGE_KEY);
    const lang = String(qp || stored || DEFAULT_LANG).toLowerCase();

    return SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  }

  async function loadDict(lang) {
    const res = await fetch(`/assets/i18n/${lang}.json`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`i18n load failed: ${lang}`);
    }

    return res.json();
  }

  function applyDict(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      if (dict[key]) el.innerHTML = dict[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      if (dict[key]) el.setAttribute("placeholder", dict[key]);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      if (dict[key]) el.setAttribute("title", dict[key]);
    });
  }

  function setHtmlLang(lang) {
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : lang);
  }

  function setSelectorState(lang) {
    const btn = document.querySelector("[data-lang-current]");
    if (!btn) return;

    btn.textContent = lang.toUpperCase();

    document.querySelectorAll("[data-lang-option]").forEach((el) => {
      const v = String(el.getAttribute("data-lang-option") || "").toLowerCase();
      el.setAttribute("aria-checked", v === lang ? "true" : "false");
    });
  }

  async function boot() {
    const lang = getLang();
    localStorage.setItem(STORAGE_KEY, lang);

    try {
      const dict = await loadDict(lang);
      applyDict(dict);
      setSelectorState(lang);
      setHtmlLang(lang);
    } catch (e) {
      setSelectorState(DEFAULT_LANG);
      setHtmlLang(DEFAULT_LANG);
    }
  }

  function setLang(lang) {
    const clean = String(lang || "").toLowerCase();
    localStorage.setItem(STORAGE_KEY, clean);

    const url = new URL(window.location.href);
    url.searchParams.set("lang", clean);

    window.location.href = url.toString();
  }

  window.IRP_I18N = {
    setLang
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();