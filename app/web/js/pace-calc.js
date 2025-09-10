// Pace Calculator page script
// Responsibilities:
//  - Handle form submission
//  - Live-format time (HH:MM:SS) and pace (MM:SS)
//  - Call the /pace-calc API with exactly two of distance/time/pace
//  - Render results and expose a copyable deeplink

// ========================== Shared helpers ===============================
// Safely destructure shared helpers from the global CH namespace with defaults
const {
  prefillFromQuery = () => {},
  getSelectedUnit = () => "mi",
  toShortUnit = (u) => (u === "km" ? "km" : "mi"),
  updateQueryFromForm = () => location.pathname + location.search,
} = (window.CH && window.CH.deeplink) || {};

const {
  hmsFromDigits = (s) => s,
  msFromDigits = (s) => s,
} = (window.CH && window.CH.format) || {};

// Initialize site-wide theme toggle if available
if (window.CH?.theme?.initThemeToggle) {
  window.CH.theme.initThemeToggle();
}

// Simple fetch helper with readable errors
async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    let msg = "";
    try { msg = await resp.text(); } catch {}
    const err = new Error(msg || resp.statusText || "Request failed");
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// Clipboard helper with fallback
async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// Flash a button's label temporarily (e.g., after successful copy)
function flashButton(btn, okText = "Copied ✅", ms = 1500) {
  const prev = btn.textContent;
  btn.textContent = okText;
  setTimeout(() => (btn.textContent = prev), ms);
}

// Caret-preserving input formatter
function formatWithCaret(input, formatter) {
  const atEnd = document.activeElement === input &&
                input.selectionStart === input.value.length;
  input.value = formatter(input.value);
  if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
}

// Result helper
function setResult(el, text) { el.textContent = text; }

// ============================== Elements =================================
// DOM references
const form       = document.getElementById("pace-form");
const result     = document.getElementById("result");
const submitBtn  = form.querySelector('button[type="submit"]');
const timeInput  = document.getElementById("time");
const paceInput  = document.getElementById("pace");
const distanceEl = document.getElementById("distance");

// Create the Copy Link button (hidden until a successful calculation)
const copyBtn = document.createElement("button");
copyBtn.type = "button";
copyBtn.textContent = "Copy Link";
copyBtn.style.display = "none";
// Inline styles kept to avoid dependency on CSS; migrate to a class if desired
copyBtn.style.marginTop = "10px";
copyBtn.style.padding = ".6rem 1rem";
copyBtn.style.borderRadius = "8px";
copyBtn.style.border = "1px solid var(--border)";
copyBtn.style.background = "var(--surface)";
copyBtn.style.cursor = "pointer";
copyBtn.style.fontWeight = "600";
copyBtn.style.color = "var(--text)";
result.insertAdjacentElement("afterend", copyBtn);

// ======================= Input formatting & prefill =======================
// Live-format time and pace while preserving the caret
timeInput.addEventListener("input", () => formatWithCaret(timeInput, hmsFromDigits));
paceInput.addEventListener("input", () => formatWithCaret(paceInput, msFromDigits));

// Prefill fields from the URL query params (no-op if helper is missing)
prefillFromQuery();

// ============================ Rendering ==================================
// Render the API response in the <pre id="result"> element
function renderResult(data) {
  const u = (data?.unit === "km") ? "km" : "mi";
  const rows = [
    [`Distance (${u})`, data?.distance],
    ["Time",            data?.time],
    [`Pace (min/${u})`, data?.pace],
  ];
  setResult(result, rows.map(([k, v]) => `${k}: ${v}`).join("\n"));
}

// ============================= Submit ====================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const distanceRaw = distanceEl.value.trim();
  const timeVal     = timeInput.value.trim();
  const paceVal     = paceInput.value.trim();

  // Treat zeroed values as empty
  const time = timeVal === "00:00:00" ? "" : timeVal;
  const pace = paceVal === "00:00"    ? "" : paceVal;

  const provided = [distanceRaw && "distance", time && "time", pace && "pace"].filter(Boolean);
  if (provided.length !== 2) {
    setResult(result, "Please provide exactly two of: distance, time, pace. (Unit is selected separately.)");
    copyBtn.style.display = "none";
    return;
  }

  // Build query params from an object, filtering out empties
  const unit = toShortUnit(getSelectedUnit());
  const params = new URLSearchParams(
    Object.entries({ unit, distance: distanceRaw, time, pace }).filter(([, v]) => v)
  );

  // Validate distance if present
  if (params.has("distance")) {
    const d = Number(params.get("distance"));
    if (!Number.isFinite(d) || d <= 0) {
      setResult(result, "Distance must be a positive number (e.g., 5 or 5.25).");
      copyBtn.style.display = "none";
      return;
    }
  }

  // UI: show loading
  submitBtn.disabled = true;
  const prev = submitBtn.textContent;
  submitBtn.textContent = "Calculating…";
  setResult(result, "Loading…");

  try {
    // Call API and render
    const data = await fetchJSON(`/pace-calc?${params.toString()}`);
    renderResult(data);

    // Update the URL query and enable copying a shareable link
    const url = updateQueryFromForm(distanceRaw, time, pace, unit);
    copyBtn.style.display = "inline-block";
    copyBtn.onclick = async () => {
      try {
        await copyText(window.location.origin + url);
        flashButton(copyBtn);
      } catch {
        // Optional: surface a toast or inline error if you have a UI system
      }
    };
  } catch (err) {
    setResult(result, `Error${err.status ? ` (${err.status})` : ""}: ${err.message || err}`);
    copyBtn.style.display = "none";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prev;
  }
});