// Inject nav.html into body
(async function () {
  const res = await fetch("/static/components/nav.html");
  const html = await res.text();
  document.body.insertAdjacentHTML("afterbegin", html);

  const rail   = document.querySelector(".rail");
  const toggle = document.querySelector(".rail__toggle");
  const list   = document.getElementById("rail-list");
  const currentPage = document.body.getAttribute("data-page");

  // Active page highlight
  document.querySelectorAll('.rail__list a[data-page-id]').forEach(a => {
    if (a.getAttribute("data-page-id") === currentPage) a.classList.add("is-active");
  });

  // Toggle open/close
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

  // Optional: close when a link is clicked (nice on mobile)
  list?.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) setExpanded(false);
  });
})();