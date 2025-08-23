// ---------- Elements ----------
const form = document.getElementById("pace-form");
const result = document.getElementById("result");
const submitBtn = form.querySelector('button[type="submit"]');
const timeInput = document.getElementById("time");
const paceInput = document.getElementById("pace");

// ---------- Render helper ----------
function renderResult(data) {
  const currentUnit =
    (data && data.unit) ||
    document.querySelector('input[name="unit"]:checked')?.value ||
    "miles";
  const u = currentUnit === "km" ? "km" : "mi";

  const rows = [
    [`Distance (${u})`, data.distance],
    ["Time", data.time],
    [`Pace (min/${u})`, data.pace],
  ];
  result.textContent = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

// ---------- Submit ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const distanceRaw = document.getElementById("distance").value.trim();
  const timeVal = timeInput.value.trim();
  const paceVal = paceInput.value.trim();

  // Treat empty or zeroed masks as empty
  const time = timeVal && timeVal !== "00:00:00" ? timeVal : "";
  const pace = paceVal && paceVal !== "00:00" ? paceVal : "";

  const provided = [];
  if (distanceRaw) provided.push("distance");
  if (time)        provided.push("time");
  if (pace)        provided.push("pace");

  if (provided.length !== 2) {
    result.textContent =
      "Please provide exactly two of: distance, time, pace. (Unit is selected separately.)";
    return;
  }

  const params = new URLSearchParams();
  const unit = document.querySelector('input[name="unit"]:checked')?.value || "miles";
  params.set("unit", unit);
  if (distanceRaw) params.set("distance", distanceRaw);
  if (time)        params.set("time", time);
  if (pace)        params.set("pace", pace);

  if (params.has("distance")) {
    const d = Number(params.get("distance"));
    if (!Number.isFinite(d) || d <= 0) {
      result.textContent = "Distance must be a positive number (e.g., 5 or 5.25).";
      return;
    }
  }

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

// ---------- Theme toggle ----------
const root = document.documentElement;
const toggleBtn = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light" || savedTheme === "dark") {
  root.setAttribute("data-theme", savedTheme);
}
toggleBtn?.addEventListener("click", () => {
  const current =
    root.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

// ---------- Input formatters (no seeding, allow clearing to empty) ----------
function onlyDigits(str) {
  return (str || "").replace(/\D/g, "");
}

// Time: HH:MM:SS when digits exist; empty stays empty
function formatHMSFromDigits(digits) {
  const d = onlyDigits(digits).slice(-6);
  if (!d) return "";                        // <-- key change
  if (d.length <= 2) {
    const ss = d.padStart(2, "0");
    return `00:00:${ss}`;
  } else if (d.length <= 4) {
    const mm = d.slice(0, -2).padStart(2, "0");
    const ss = d.slice(-2);
    return `00:${mm}:${ss}`;
  } else {
    const hh = d.slice(0, -4).padStart(2, "0");
    const mm = d.slice(-4, -2);
    const ss = d.slice(-2);
    return `${hh}:${mm}:${ss}`;
  }
}

timeInput.addEventListener("input", () => {
  const caretAtEnd =
    document.activeElement === timeInput &&
    timeInput.selectionStart === timeInput.value.length;

  const formatted = formatHMSFromDigits(timeInput.value);
  timeInput.value = formatted;              // "" if user cleared all digits

  if (caretAtEnd) {
    timeInput.setSelectionRange(timeInput.value.length, timeInput.value.length);
  }
});

// Pace: MM:SS when digits exist; empty stays empty
function formatMSFromDigits(digits) {
  const d = onlyDigits(digits).slice(-4);
  if (!d) return "";                        // <-- key change
  if (d.length <= 2) {
    const ss = d.padStart(2, "0");
    return `00:${ss}`;
  } else {
    const mm = d.slice(0, -2).padStart(2, "0");
    const ss = d.slice(-2);
    return `${mm}:${ss}`;
  }
}

paceInput.addEventListener("input", () => {
  const caretAtEnd =
    document.activeElement === paceInput &&
    paceInput.selectionStart === paceInput.value.length;

  const formatted = formatMSFromDigits(paceInput.value);
  paceInput.value = formatted;              // "" if user cleared all digits

  if (caretAtEnd) {
    paceInput.setSelectionRange(paceInput.value.length, paceInput.value.length);
  }
});