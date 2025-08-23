// ---------- Elements ----------
const form = document.getElementById("pace-form");
const result = document.getElementById("result");
const submitBtn = form.querySelector('button[type="submit"]');
const timeInput = document.getElementById("time");
const paceInput = document.getElementById("pace");

// Create Copy Link button (hidden by default)
const copyBtn = document.createElement("button");
copyBtn.textContent = "Copy Link";
copyBtn.type = "button";
copyBtn.style.display = "none";
copyBtn.style.marginTop = "10px";
copyBtn.style.padding = ".6rem 1rem";
copyBtn.style.borderRadius = "8px";
copyBtn.style.border = "1px solid var(--border)";
copyBtn.style.background = "var(--surface)";
copyBtn.style.cursor = "pointer";
copyBtn.style.fontWeight = "600";
copyBtn.style.color = "var(--text)";
result.insertAdjacentElement("afterend", copyBtn);

// Prefill from URL first
prefillFromQuery();

/* ==================== Deep-link helpers ==================== */
function normalizeUnitForUI(u) {
  if (!u) return "miles";
  const s = String(u).toLowerCase();
  if (["mi", "mile", "miles"].includes(s)) return "miles";
  if (["km", "kilometer", "kilometers"].includes(s)) return "km";
  return "miles";
}
function toShortUnit(u) { return u === "km" ? "km" : "mi"; }
function getSelectedUnit() {
  return document.querySelector('input[name="unit"]:checked')?.value || "miles";
}
function setSelectedUnit(u) {
  const target = normalizeUnitForUI(u);
  const el = document.querySelector(`input[name="unit"][value="${target}"]`);
  if (el) el.checked = true;
}
function providedKeys(distanceRaw, time, pace) {
  const keys = [];
  if (distanceRaw) keys.push("distance");
  if (time)        keys.push("time");
  if (pace)        keys.push("pace");
  return keys;
}

function prefillFromQuery() {
  const qs = new URLSearchParams(window.location.search);
  setSelectedUnit(qs.get("unit"));
  if (qs.get("distance")) document.getElementById("distance").value = qs.get("distance");
  if (qs.get("time"))     document.getElementById("time").value = qs.get("time");
  if (qs.get("pace"))     document.getElementById("pace").value = qs.get("pace");
}

function updateQueryFromForm(distanceRaw, time, pace, unitUIValue) {
  const keys = providedKeys(distanceRaw, time, pace);
  if (keys.length !== 2) return;
  const qs = new URLSearchParams();
  qs.set("unit", toShortUnit(unitUIValue));
  if (distanceRaw) qs.set("distance", distanceRaw);
  if (time)        qs.set("time", time);
  if (pace)        qs.set("pace", pace);
  const newUrl = `${window.location.pathname}?${qs.toString()}`;
  history.replaceState(null, "", newUrl);
  return newUrl; // so we can copy it
}

/* ==================== Render helper ==================== */
function renderResult(data) {
  const currentUnit =
    (data && data.unit) || getSelectedUnit() || "miles";
  const u = currentUnit === "km" ? "km" : "mi";

  const rows = [
    [`Distance (${u})`, data.distance],
    ["Time", data.time],
    [`Pace (min/${u})`, data.pace],
  ];
  result.textContent = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

/* ==================== Submit ==================== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const distanceRaw = document.getElementById("distance").value.trim();
  const timeVal = timeInput.value.trim();
  const paceVal = paceInput.value.trim();

  const time = timeVal && timeVal !== "00:00:00" ? timeVal : "";
  const pace = paceVal && paceVal !== "00:00" ? paceVal : "";

  const provided = [];
  if (distanceRaw) provided.push("distance");
  if (time)        provided.push("time");
  if (pace)        provided.push("pace");

  if (provided.length !== 2) {
    result.textContent =
      "Please provide exactly two of: distance, time, pace. (Unit is selected separately.)";
    copyBtn.style.display = "none";
    return;
  }

  const params = new URLSearchParams();
  const unit = getSelectedUnit();
  params.set("unit", unit);
  if (distanceRaw) params.set("distance", distanceRaw);
  if (time)        params.set("time", time);
  if (pace)        params.set("pace", pace);

  if (params.has("distance")) {
    const d = Number(params.get("distance"));
    if (!Number.isFinite(d) || d <= 0) {
      result.textContent = "Distance must be a positive number (e.g., 5 or 5.25).";
      copyBtn.style.display = "none";
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
      copyBtn.style.display = "none";
      return;
    }
    renderResult(data);
    const url = updateQueryFromForm(distanceRaw, time, pace, unit);

    // Show copy button after successful calc
    copyBtn.style.display = "inline-block";
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin + url);
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "Copied ✅";
        setTimeout(() => (copyBtn.textContent = oldText), 1500);
      } catch {
        alert("Failed to copy link");
      }
    };
  } catch (err) {
    result.textContent = `Network error: ${err}`;
    copyBtn.style.display = "none";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prev;
  }
});

/* ==================== Theme toggle ==================== */
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

/* ==================== Input formatters ==================== */
function onlyDigits(str) { return (str || "").replace(/\D/g, ""); }

// Time: HH:MM:SS
function formatHMSFromDigits(digits) {
  const d = onlyDigits(digits).slice(-6);
  if (!d) return "";
  if (d.length <= 2) return `00:00:${d.padStart(2, "0")}`;
  if (d.length <= 4) return `00:${d.slice(0, -2).padStart(2, "0")}:${d.slice(-2)}`;
  return `${d.slice(0, -4).padStart(2, "0")}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}
timeInput.addEventListener("input", () => {
  const caretAtEnd = document.activeElement === timeInput &&
    timeInput.selectionStart === timeInput.value.length;
  timeInput.value = formatHMSFromDigits(timeInput.value);
  if (caretAtEnd) timeInput.setSelectionRange(timeInput.value.length, timeInput.value.length);
});

// Pace: MM:SS
function formatMSFromDigits(digits) {
  const d = onlyDigits(digits).slice(-4);
  if (!d) return "";
  if (d.length <= 2) return `00:${d.padStart(2, "0")}`;
  return `${d.slice(0, -2).padStart(2, "0")}:${d.slice(-2)}`;
}
paceInput.addEventListener("input", () => {
  const caretAtEnd = document.activeElement === paceInput &&
    paceInput.selectionStart === paceInput.value.length;
  paceInput.value = formatMSFromDigits(paceInput.value);
  if (caretAtEnd) paceInput.setSelectionRange(paceInput.value.length, paceInput.value.length);
});