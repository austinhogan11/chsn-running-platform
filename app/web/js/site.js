/* /static/js/site.js */
(async function () {
  try {
    const res = await fetch("/static/components/nav.html", { cache: "no-store" });
    const html = await res.text();
    document.body.insertAdjacentHTML("afterbegin", html);

    // Active page highlight
    const currentPage = document.body.getAttribute("data-page");
    document.querySelectorAll('.rail__list a[data-page-id]').forEach(a => {
      if (a.getAttribute("data-page-id") === currentPage) a.classList.add("is-active");
    });

    // Toggle open/close
    const rail = document.querySelector(".rail");
    const toggle = document.querySelector(".rail__toggle");
    const list   = document.getElementById("rail-list");

    const setExpanded = (state) => {
      rail.setAttribute("aria-expanded", String(state));
      toggle.setAttribute("aria-expanded", String(state));
    };

    toggle?.addEventListener("click", () => {
      const expanded = rail.getAttribute("aria-expanded") === "true";
      setExpanded(!expanded);
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      const expanded = rail.getAttribute("aria-expanded") === "true";
      if (!expanded) return;
      if (!rail.contains(e.target)) setExpanded(false);
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setExpanded(false);
    });

    // Close after link click (nice on mobile)
    list?.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) setExpanded(false);
    });

    // Bind theme toggle now that it exists
    window.__bindThemeToggle?.();
  } catch (e) {
    console.error("Failed to inject nav:", e);
  }
})();