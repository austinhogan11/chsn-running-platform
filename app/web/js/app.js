// ---------- Pace form ----------
const form = document.getElementById("pace-form");
const result = document.getElementById("result");
const submitBtn = form.querySelector('button[type="submit"]');

function renderResult(data) {
  const rows = [
    ["Distance (mi)", data.distance],
    ["Time", data.time],
    ["Pace (min/mi)", data.pace],
  ];
  result.textContent = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // grab & trim
  const distanceRaw = document.getElementById("distance").value.trim();
  const time = document.getElementById("time").value.trim();
  const pace = document.getElementById("pace").value.trim();

  // build query with exactly two params
  const params = new URLSearchParams();
  if (distanceRaw) params.set("distance", distanceRaw);
  if (time) params.set("time", time);
  if (pace) params.set("pace", pace);

  const keys = Array.from(params.keys());
  if (keys.length !== 2) {
    result.textContent = "Please provide exactly two of: distance, time, pace.";
    return;
  }

  // basic sanity for distance
  if (params.has("distance")) {
    const d = Number(params.get("distance"));
    if (!Number.isFinite(d) || d <= 0) {
      result.textContent = "Distance must be a positive number (e.g., 5 or 5.25).";
      return;
    }
  }

  // UI: loading state
  submitBtn.disabled = true;
  const prev = submitBtn.textContent;
  submitBtn.textContent = "Calculating…";
  result.textContent = "Loading…";

  try {
    const resp = await fetch(`/pace-calc?${params.toString()}`);
    const data = await resp.json();

    if (!resp.ok) {
      result.textContent = `Error (${resp.status}): ${data?.detail ?? "Invalid input"}`;
      return;
    }

    renderResult(data);
  } catch (err) {
    result.textContent = `Network error: ${err}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prev;
  }
});

// ---------- Theme toggle (SVG icons shown via CSS) ----------
const root = document.documentElement;
const toggleBtn = document.getElementById("theme-toggle");

// apply saved theme if present
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light" || savedTheme === "dark") {
  root.setAttribute("data-theme", savedTheme);
}

// toggle handler
toggleBtn?.addEventListener("click", () => {
  const current =
    root.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});