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

// Bring in shared helpers from the common namespace
const { prefillFromQuery, getSelectedUnit, toShortUnit, updateQueryFromForm } =
  (window.CH && window.CH.deeplink) || {};

const { hmsFromDigits, msFromDigits } =
  (window.CH && window.CH.format) || {};

// Initialize site-wide theme toggle (safe if not present)
if (window.CH?.theme?.initThemeToggle) {
  window.CH.theme.initThemeToggle();
}

// Live input formatting using shared formatters (allow empty values)
timeInput.addEventListener("input", () => {
  const caretAtEnd =
    document.activeElement === timeInput &&
    timeInput.selectionStart === timeInput.value.length;

  if (typeof hmsFromDigits === "function") {
    timeInput.value = hmsFromDigits(timeInput.value);
  }

  if (caretAtEnd) {
    timeInput.setSelectionRange(
      timeInput.value.length,
      timeInput.value.length
    );
  }
});

paceInput.addEventListener("input", () => {
  const caretAtEnd =
    document.activeElement === paceInput &&
    paceInput.selectionStart === paceInput.value.length;

  if (typeof msFromDigits === "function") {
    paceInput.value = msFromDigits(paceInput.value);
  }

  if (caretAtEnd) {
    paceInput.setSelectionRange(
      paceInput.value.length,
      paceInput.value.length
    );
  }
});

// Prefill from URL first (shared helper)
if (typeof prefillFromQuery === "function") {
  prefillFromQuery();
}

/* ==================== Render helper ==================== */
function renderResult(data) {
  const currentUnit =
    (data && data.unit) || getSelectedUnit() || "mi";
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
  const unit = toShortUnit(getSelectedUnit());
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
    const data = await CH.http.getJSON(`/pace-calc?${params.toString()}`);
    renderResult(data);
    const url = updateQueryFromForm(distanceRaw, time, pace, unit);

    // Show copy button after successful calc
    copyBtn.style.display = "inline-block";
    copyBtn.onclick = async () => {
      try {
        await CH.dom.copy(window.location.origin + url);
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "Copied ✅";
        setTimeout(() => (copyBtn.textContent = oldText), 1500);
      } catch (e) {
        alert("Failed to copy link");
      }
    };
  } catch (err) {
    result.textContent = `Error${err.status ? ` (${err.status})` : ""}: ${err.message || err}`;
    copyBtn.style.display = "none";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prev;
  }
});