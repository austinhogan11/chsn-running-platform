/* 
 * This script dynamically injects the navigation rail into the page,
 * manages its open/close behavior, highlights the active page link,
 * and binds the theme toggle functionality.
 */

/* /static/js/site.js */
(async function () {
  try {
    // Fetch and inject the navigation HTML into the page
    const res = await fetch("/static/components/nav.html", { cache: "no-store" });
    const html = await res.text();
    document.body.insertAdjacentHTML("afterbegin", html);

    // Highlight the active page link based on the data-page attribute
    const currentPage = document.body.getAttribute("data-page");
    document.querySelectorAll('.rail__list a[data-page-id]').forEach(a => {
      if (a.getAttribute("data-page-id") === currentPage) a.classList.add("is-active");
    });

    // Set up references to the rail container, toggle button, and list element
    const rail = document.querySelector(".rail");
    const toggle = document.querySelector(".rail__toggle");
    const list   = document.getElementById("rail-list");

    // Helper function to set the aria-expanded attribute on rail and toggle
    const setExpanded = (state) => {
      rail.setAttribute("aria-expanded", String(state));
      toggle.setAttribute("aria-expanded", String(state));
    };

    // Click handler for toggling the open/close state of the rail
    toggle?.addEventListener("click", () => {
      const expanded = rail.getAttribute("aria-expanded") === "true";
      setExpanded(!expanded);
    });

    // Close the rail if clicking outside of it when it is expanded
    document.addEventListener("click", (e) => {
      const expanded = rail.getAttribute("aria-expanded") === "true";
      if (!expanded) return;
      if (!rail.contains(e.target)) setExpanded(false);
    });

    // Close the rail when pressing the ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setExpanded(false);
    });

    // Close the rail after clicking a link inside the list (useful on mobile)
    list?.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) setExpanded(false);
    });

    // Bind the theme toggle functionality if available
    window.__bindThemeToggle?.();
  } catch (e) {
    // Log an error if the navigation injection fails
    console.error("Failed to inject nav:", e);
  }
})();