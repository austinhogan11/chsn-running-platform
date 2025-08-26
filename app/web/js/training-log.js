// /static/js/training-log.js

document.addEventListener("DOMContentLoaded", () => {
  boot();
});

async function boot() {
  const state = {
    allRuns: [],
    filtered: [],
    trendRange: "12w", // 12w | 6m | 1y
  };

  // DOM
  const weekCanvas = document.getElementById("week-chart");
  const trendCanvas = document.getElementById("trend-chart");
  const weekTotalEl = document.getElementById("week-total");
  const runList = document.getElementById("run-list");
  const typeSel = document.getElementById("filter-type");
  const fromInput = document.getElementById("filter-from");
  const toInput = document.getElementById("filter-to");
  const clearBtn = document.getElementById("filter-clear");
  const segBtns = document.querySelectorAll(".seg__btn");

  // Modal
  const modal = document.getElementById("run-modal");
  const modalBody = document.getElementById("modal-body");
  modal?.addEventListener("click", (e) => {
    if (e.target.matches("[data-close], .modal__backdrop")) {
      modal.hidden = true;
      modalBody.innerHTML = "";
    }
  });

  try {
    const res = await fetch("/runs");
    if (!res.ok) throw new Error("Failed to fetch runs");
    const runs = await res.json();
    state.allRuns = runs.map(normalizeRun);
  } catch (err) {
    console.error(err);
    runList.innerHTML = `<div class="tl-empty">⚠️ Error loading runs</div>`;
    return;
  }

  // Events
  typeSel.addEventListener("change", () => applyFilters(state));
  fromInput.addEventListener("change", () => applyFilters(state));
  toInput.addEventListener("change", () => applyFilters(state));
  clearBtn.addEventListener("click", () => {
    typeSel.value = "all";
    fromInput.value = "";
    toInput.value = "";
    applyFilters(state);
  });

  segBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      segBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.trendRange = btn.dataset.range;
      renderTrend(trendCanvas, state);
    })
  );

  // Initial render
  applyFilters(state);
  renderWeek(weekCanvas, state, weekTotalEl);
  renderTrend(trendCanvas, state);

  /*** helpers ***/

  function applyFilters(st) {
    const type = typeSel.value;
    const from = fromInput.value ? new Date(fromInput.value) : null;
    const to = toInput.value ? new Date(toInput.value) : null;

    st.filtered = st.allRuns.filter((r) => {
      if (type !== "all" && r.run_type !== type) return false;
      if (from && r.started_at < from) return false;
      if (to && r.started_at > endOfDay(to)) return false;
      return true;
    });

    renderList(runList, st.filtered);
  }
}

/* ---------- Data utils ---------- */
function normalizeRun(r) {
  return {
    id: r.id,
    title: r.title || "Untitled run",
    description: r.description || "",
    run_type: r.run_type || "Easy Run",
    started_at: new Date(r.started_at),
    distance_mi: r.unit === "km" ? r.distance * 0.621371 : r.distance,
    unit: "mi",
    duration_s: r.duration_s ?? 0,
  };
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/* ---------- Charts ---------- */

function renderWeek(canvas, state, totalEl) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const now = new Date();
  const weekStart = startOfWeek(now);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const data = [0, 0, 0, 0, 0, 0, 0];

  let total = 0;
  state.allRuns.forEach((r) => {
    if (r.started_at >= weekStart) {
      const idx = (r.started_at.getDay() + 6) % 7;
      data[idx] += r.distance_mi;
      total += r.distance_mi;
    }
  });
  totalEl.textContent = `${total.toFixed(1)} mi`;

  drawBars(ctx, canvas, labels, data);
}

function renderTrend(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const { rangeLabels, values } = bucketWeeklyTotals(state.allRuns, state.trendRange);
  drawLine(ctx, canvas, rangeLabels, values);
}

function bucketWeeklyTotals(runs, range = "12w") {
  // Build week buckets ending on Sunday
  let weeks = 12;
  if (range === "6m") weeks = 26;
  if (range === "1y") weeks = 52;

  const today = new Date();
  const end = startOfWeek(today); // Monday start—use end of week labels
  const labels = [];
  const values = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(end);
    start.setDate(start.getDate() - i * 7);
    const stop = new Date(start);
    stop.setDate(stop.getDate() + 6); // through Sunday

    const label = `${start.getMonth() + 1}/${start.getDate()}`;
    labels.push(label);

    const sum = runs
      .filter((r) => r.started_at >= start && r.started_at <= endOfDay(stop))
      .reduce((acc, r) => acc + r.distance_mi, 0);

    values.push(sum);
  }

  return { rangeLabels: labels, values };
}

/* ---------- Canvas drawing (minimal) ---------- */

function drawBars(ctx, canvas, labels, values) {
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  const pad = 28 * devicePixelRatio;

  // axes
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border");
  ctx.lineWidth = 1 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  const max = Math.max(1, Math.ceil(Math.max(...values)));
  const bw = (w - pad * 2) / values.length * 0.7;
  const gap = (w - pad * 2) / values.length * 0.3;

  const green = getComputedStyle(document.documentElement).getPropertyValue("--green-600").trim() || "#169b80";
  ctx.fillStyle = green;

  values.forEach((v, i) => {
    const x = pad + i * (bw + gap) + gap * 0.5;
    const hVal = ((h - pad * 2) * v) / max;
    ctx.fillRect(x, h - pad - hVal, bw, hVal);

    // label
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.font = `${12 * devicePixelRatio}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + bw / 2, h - pad + 16 * devicePixelRatio);
    ctx.fillStyle = green;
  });
}

function drawLine(ctx, canvas, labels, values) {
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  const pad = 28 * devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  const max = Math.max(1, Math.ceil(Math.max(...values)));
  const stepX = (w - pad * 2) / (values.length - 1);

  const green = getComputedStyle(document.documentElement).getPropertyValue("--green-600").trim() || "#169b80";
  ctx.strokeStyle = green;
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.beginPath();

  values.forEach((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((h - pad * 2) * v) / max;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // x labels (sparse)
  ctx.fillStyle = getComputedStyle(document.body).color;
  ctx.font = `${11 * devicePixelRatio}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textAlign = "center";
  const every = Math.ceil(labels.length / 6);
  labels.forEach((lb, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    const x = pad + i * stepX;
    ctx.fillText(lb, x, h - pad + 16 * devicePixelRatio);
  });
}

/* ---------- List & modal ---------- */

function renderList(container, runs) {
  if (!runs.length) {
    container.innerHTML = `
      <div class="tl-empty">
        <p>No runs match the current filters.</p>
      </div>`;
    return;
  }

  container.innerHTML = runs
    .sort((a, b) => b.started_at - a.started_at)
    .map(runToRow)
    .join("");

  // Click -> modal
  container.querySelectorAll(".run").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-id");
      const run = runs.find((r) => String(r.id) === id);
      openRunModal(run);
    });
  });
}

function runToRow(r) {
  const dt = r.started_at.toLocaleString();
  const pace = r.distance_mi > 0 ? secsToPace(r.duration_s / r.distance_mi) : "–";
  return `
    <div class="run" data-id="${r.id}">
      <div>
        <div class="run__title">${escapeHtml(r.title)}</div>
        <div class="run__meta">${dt}</div>
        <div class="run__desc">${escapeHtml(r.description)}</div>
      </div>
      <div style="text-align:right">
        <div class="run__type">${r.run_type}</div>
        <div class="run__meta">${r.distance_mi.toFixed(2)} mi • ${secsToHMS(r.duration_s)} • ${pace}/mi</div>
      </div>
    </div>
  `;
}

function openRunModal(r) {
  const modal = document.getElementById("run-modal");
  const body = document.getElementById("modal-body");
  const title = document.getElementById("modal-title");

  title.textContent = r.title;
  body.innerHTML = `
    <p><strong>Type:</strong> ${r.run_type}</p>
    <p><strong>Date:</strong> ${r.started_at.toLocaleString()}</p>
    <p><strong>Distance:</strong> ${r.distance_mi.toFixed(2)} mi</p>
    <p><strong>Duration:</strong> ${secsToHMS(r.duration_s)}</p>
    <p><strong>Pace:</strong> ${r.distance_mi > 0 ? secsToPace(r.duration_s / r.distance_mi) : "–"} / mi</p>
    ${r.description ? `<p style="margin-top:8px">${escapeHtml(r.description)}</p>` : ""}
    <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
    <p class="muted">Map, splits, HR, elevation will appear here once we import GPX.</p>
  `;
  modal.hidden = false;
}

/* ---------- Small format helpers ---------- */
function secsToHMS(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, "0"))).join(":");
}
function secsToPace(minPerMi) {
  const totalSecs = Math.round(minPerMi * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}`;
}
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}