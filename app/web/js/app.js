// ---------- Pace form ----------
const form = document.getElementById("pace-form");
const result = document.getElementById("result");
const submitBtn = form.querySelector('button[type="submit"]');

function renderResult(data) {
  // prefer unit from backend; fallback to currently selected radio
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // grab & trim
  const distanceRaw = document.getElementById("distance").value.trim();
  const time = document.getElementById("time").value.trim();
  const pace = document.getElementById("pace").value.trim();

  // build query with exactly two params (+ unit)
  const params = new URLSearchParams();

  // selected unit from radios: 'miles' or 'km'
  const unit = document.querySelector('input[name="unit"]:checked')?.value || "miles";
  params.set("unit", unit);

  if (distanceRaw) params.set("distance", distanceRaw);
  if (time) params.set("time", time);
  if (pace) params.set("pace", pace);

  const keys = Array.from(params.keys());
  if (keys.length !== 3) {
    result.textContent = "Please provide exactly two of: distance, time, pace. (Unit is selected separately.)";
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

// ---------- Time Input Auto-Formatter ----------
function onlyDigits(str) {
  return (str || "").replace(/\D/g, "").slice(-6); // keep last 6 digits
}

function formatHMSFromDigits(d) {
  d = onlyDigits(d);
  if (d.length <= 2) {
    // SS
    const ss = d.padStart(2, "0");
    return `00:00:${ss}`;
  } else if (d.length <= 4) {
    // MMSS
    const mm = d.slice(0, d.length - 2).padStart(2, "0");
    const ss = d.slice(-2);
    return `00:${mm}:${ss}`;
  } else {
    // HHMMSS
    const hh = d.slice(0, d.length - 4).padStart(2, "0");
    const mm = d.slice(-4, -2);
    const ss = d.slice(-2);
    return `${hh}:${mm}:${ss}`;
  }
}

const timeInput = document.getElementById("time");
if (timeInput) {
  timeInput.addEventListener("input", () => {
    const caretAtEnd =
      document.activeElement === timeInput &&
      timeInput.selectionStart === timeInput.value.length;
    const formatted = formatHMSFromDigits(timeInput.value);
    timeInput.value = formatted;
    if (caretAtEnd) {
      timeInput.setSelectionRange(
        timeInput.value.length,
        timeInput.value.length
      );
    }
  });

  timeInput.addEventListener("focus", () => {
    if (!onlyDigits(timeInput.value)) timeInput.value = "00:00:00";
  });
}

// ---------- Pace Input Auto-Formatter (MM:SS) ----------
function formatMSFromDigits(d) {
  d = (d || "").replace(/\D/g, "").slice(-4); // keep last 4 digits
  if (d.length <= 2) {
    // SS
    const ss = d.padStart(2, "0");
    return `00:${ss}`;
  } else {
    // MMSS
    const mm = d.slice(0, d.length - 2).padStart(2, "0");
    const ss = d.slice(-2);
    return `${mm}:${ss}`;
  }
}

const paceInput = document.getElementById("pace");
if (paceInput) {
  paceInput.addEventListener("input", () => {
    const caretAtEnd =
      document.activeElement === paceInput &&
      paceInput.selectionStart === paceInput.value.length;
    const formatted = formatMSFromDigits(paceInput.value);
    paceInput.value = formatted;
    if (caretAtEnd) {
      paceInput.setSelectionRange(
        paceInput.value.length,
        paceInput.value.length
      );
    }
  });

  paceInput.addEventListener("focus", () => {
    // Seed default "00:00" if empty
    const digits = paceInput.value.replace(/\D/g, "");
    if (!digits) paceInput.value = "00:00";
  });
}
