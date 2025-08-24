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