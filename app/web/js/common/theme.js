/* global window */
window.CH = window.CH || {};
window.CH.theme = (function () {
  function initThemeToggle(buttonId = "theme-toggle") {
    const root = document.documentElement;
    const toggleBtn = document.getElementById(buttonId);
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

    toggleBtn?.addEventListener("click", () => {
      const current =
        root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  return { initThemeToggle };
})();
/* /static/js/common/theme.js */
(function () {
  const root = document.documentElement;

  function applySaved() {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      root.setAttribute("data-theme", saved);
    }
  }

  function bindToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current =
        root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  // Run immediately, and again after nav is injected (site.js will call window.__bindThemeToggle)
  applySaved();
  window.__bindThemeToggle = bindToggle;
})();