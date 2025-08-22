const form = document.getElementById("pace-form");
const result = document.getElementById("result");
const submitBtn = form.querySelector('button[type="submit"]');

function renderResult(data) {
  // Expecting keys: distance, time, pace (from your API)
  const rows = [
    ["Distance (mi)", data.distance],
    ["Time", data.time],
    ["Pace (min/mi)", data.pace],
  ];
  const lines = rows.map(([k, v]) => `${k}: ${v}`);
  result.textContent = lines.join("\n");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const distanceRaw = document.getElementById("distance").value.trim();
  const time = document.getElementById("time").value.trim();
  const pace = document.getElementById("pace").value.trim();

  // Build params with exactly two fields
  const params = new URLSearchParams();
  if (distanceRaw) params.set("distance", distanceRaw);
  if (time) params.set("time", time);
  if (pace) params.set("pace", pace);

  const keys = Array.from(params.keys());
  if (keys.length !== 2) {
    result.textContent = "Please provide exactly two of: distance, time, pace.";
    return;
  }

  // Quick sanity check on distance if provided
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
      // FastAPI returns {"detail": "..."} on 400
      const message = data?.detail || "Invalid input.";
      result.textContent = `Error (${resp.status}): ${message}`;
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