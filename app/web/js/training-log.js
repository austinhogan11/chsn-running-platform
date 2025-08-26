// Training Log UI logic
const runListEl    = document.getElementById("run-list");
const runModal     = document.getElementById("run-modal");
const runFormModal = document.getElementById("run-form-modal");
const runForm      = document.getElementById("run-form");
const addBtn       = document.getElementById("add-run-btn");
const weekTotalPill = document.getElementById("week-total-pill");

let runs = [];

/* -------------------------- data load/cache -------------------------- */
function cacheRuns() {
  try { localStorage.setItem("runs-cache", JSON.stringify(runs)); } catch {}
}

async function loadRuns() {
  try {
    const res = await fetch("/runs");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    runs = await res.json();
  } catch (e) {
    // fall back to cache if API is down
    try {
      const raw = localStorage.getItem("runs-cache");
      runs = raw ? JSON.parse(raw) : [];
    } catch { runs = []; }
  }
  cacheRuns();
  renderRuns();
  tlRenderCharts(); // keep charts in sync with the same runs array
}

/* -------------------------- list rendering -------------------------- */
function renderRuns() {
  if (!runListEl) return;
  runListEl.innerHTML = "";

  if (!runs.length) {
    runListEl.innerHTML = `<div class="tl-empty"><p>No runs yet. Add one!</p></div>`;
    return;
  }

  for (const run of runs) {
    const el = document.createElement("div");
    el.className = "tl-item";
    const mins = Math.round(run.duration_s / 60);

    el.innerHTML = `
      <div class="tl-item__main">
        <div class="tl-item__title">${run.title ?? "Untitled run"}</div>
        <div class="tl-item__meta">
          ${run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
          • ${run.distance ?? 0} ${run.unit ?? "mi"}
          • ${isFinite(mins) ? mins : 0} min
          • ${run.type ?? "Easy Run"}
        </div>
      </div>
      <div class="tl-item__actions">
        <button class="btn-secondary" data-view="${run.id}">View</button>
        <button class="btn-secondary" data-edit="${run.id}">Edit</button>
        <button class="btn-secondary" data-delete="${run.id}">Delete</button>
      </div>
    `;
    runListEl.appendChild(el);
  }
}

/* -------------------------- modals -------------------------- */
function openModal(modal)  { if (modal) modal.hidden = false; }
function closeModal(modal) { if (modal) modal.hidden = true; }

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", e => {
    const modal = e.target.closest(".modal");
    closeModal(modal);
  });
});

/* -------------------------- charts (no libs) -------------------------- */
// We expose a function tlRenderCharts(rangeKey?) so list/save can call it.
(function () {
  const WEEKS_12 = "12w";
  const MONTHS_6 = "6m";
  const YEARS_1  = "1y";

  const weekCanvas  = document.getElementById("weekChart");
  const trendCanvas = document.getElementById("trendChart");
  const seg = document.querySelector('[data-seg="trend-range"]');

  // helpers
  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday=0
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - day);
    return x;
  }

  function buildWeekDailyMiles(list) {
    const days = [0,0,0,0,0,0,0];
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

    for (const r of list) {
      if (!r?.started_at || r.distance == null) continue;
      const d = new Date(r.started_at);
      if (d >= weekStart && d < weekEnd) {
        const idx = (d.getDay() + 6) % 7;
        const miles = r.unit === "km" ? r.distance * 0.621371 : r.distance;
        days[idx] += miles;
      }
    }
    return days;
  }

  function buildWeeklyTotals(list, rangeKey) {
    const now = new Date(), totals = [];
    const endWeek = startOfWeek(now);

    let periods = 12;
    if (rangeKey === MONTHS_6) periods = 26;
    if (rangeKey === YEARS_1)  periods = 52;

    for (let i = periods - 1; i >= 0; i--) {
      const start = new Date(endWeek); start.setDate(start.getDate() - i * 7);
      const end   = new Date(start);   end.setDate(start.getDate() + 7);

      let sum = 0;
      for (const r of list) {
        if (!r?.started_at || r.distance == null) continue;
        const d = new Date(r.started_at);
        if (d >= start && d < end) {
          sum += (r.unit === "km" ? r.distance * 0.621371 : r.distance);
        }
      }
      totals.push(sum);
    }
    return totals;
  }

  function clearCanvas(c) {
    const ctx = c.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = Math.floor(cssW * ratio);
    c.height = Math.floor(cssH * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    return ctx;
  }

  function drawBars(c, values, labels) {
    const ctx = clearCanvas(c);
    const w = c.clientWidth, h = c.clientHeight;
    const pad = 24, innerW = w - pad*2, innerH = h - pad*2;
    const max = Math.max(1, ...values);
    const bw = innerW / values.length * 0.7;
    const gap = innerW / values.length * 0.3;

    ctx.fillStyle = getCSS("--border");
    ctx.fillRect(pad, h - pad, innerW, 1);

    ctx.fillStyle = getCSS("--green-600") || "#169b80";
    values.forEach((v, i) => {
      const x = pad + i * (bw + gap) + gap*0.5;
      const bh = max ? (v / max) * (innerH - 16) : 0;
      ctx.fillRect(x, h - pad - bh, bw, bh);
    });

    ctx.fillStyle = getCSS("--muted");
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    labels.forEach((lab, i) => {
      const x = pad + i * (bw + gap) + gap*0.5 + bw/2;
      ctx.fillText(lab, x, h - 6);
    });
  }

  function drawLine(c, values) {
    const ctx = clearCanvas(c);
    const w = c.clientWidth, h = c.clientHeight;
    const pad = 24, innerW = w - pad*2, innerH = h - pad*2;
    const max = Math.max(1, ...values);
    const step = innerW / Math.max(1, values.length - 1);

    ctx.fillStyle = getCSS("--border");
    ctx.fillRect(pad, h - pad, innerW, 1);

    const stroke = getCSS("--green-600") || "#169b80";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (max ? (v / max) * (innerH - 16) : 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = stroke;
    values.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (max ? (v / max) * (innerH - 16) : 0);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });
  }

  function getCSS(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function updateWeekTotalPill(weekMiles) {
    const total = weekMiles.reduce((a,b)=>a+b,0);
    if (weekTotalPill) weekTotalPill.textContent = `${Math.round(total)} mi`;
  }

  // expose a callable renderer that uses the global `runs`
  window.tlRenderCharts = function tlRenderCharts(rangeKey = WEEKS_12) {
    if (!weekCanvas || !trendCanvas) return;
    const week = buildWeekDailyMiles(runs);
    drawBars(weekCanvas, week, ["M","T","W","T","F","S","S"]);
    updateWeekTotalPill(week);

    const totals = buildWeeklyTotals(runs, rangeKey);
    drawLine(trendCanvas, totals);

    // update seg active
    seg?.querySelectorAll(".seg__btn")?.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.range === rangeKey);
    });
  };

  seg?.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg__btn");
    if (!btn) return;
    tlRenderCharts(btn.dataset.range);
  });

  window.addEventListener("resize", () => {
    const active = seg?.querySelector(".seg__btn.is-active")?.dataset.range || WEEKS_12;
    tlRenderCharts(active);
  });
})();

/* -------------------------- add/edit/delete -------------------------- */
addBtn?.addEventListener("click", () => {
  if (!runForm) return;
  runForm.reset();
  document.getElementById("run-id").value = "";
  document.getElementById("run-form-title").textContent = "Add run";
  openModal(runFormModal);
});

runForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("run-id").value;
  const payload = {
    title:        document.getElementById("f-title").value,
    description:  document.getElementById("f-description").value,
    started_at:   document.getElementById("f-started").value,
    distance:     parseFloat(document.getElementById("f-distance").value),
    unit:         document.getElementById("f-unit").value,
    duration_s:   parseInt(document.getElementById("f-duration").value, 10),
    type:         document.getElementById("f-type").value
  };

  const url = id ? `/runs/${id}` : "/runs";
  const method = id ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  closeModal(runFormModal);
  await loadRuns(); // refresh list & charts
});

runListEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-view],[data-edit],[data-delete]");
  if (!btn) return;

  const viewId = btn.getAttribute("data-view");
  const editId = btn.getAttribute("data-edit");
  const delId  = btn.getAttribute("data-delete");

  if (viewId) {
    const run = runs.find(r => String(r.id) === String(viewId));
    if (!run) return;
    document.getElementById("modal-title").textContent = run.title ?? "Run";
    document.getElementById("modal-body").innerHTML = `
      <p><strong>Date:</strong> ${run.started_at ? new Date(run.started_at).toLocaleString() : "—"}</p>
      <p><strong>Distance:</strong> ${run.distance ?? 0} ${run.unit ?? "mi"}</p>
      <p><strong>Duration:</strong> ${Math.round((run.duration_s ?? 0)/60)} min</p>
      <p><strong>Type:</strong> ${run.type ?? "Easy Run"}</p>
      <p><strong>Description:</strong> ${run.description ?? "—"}</p>
    `;
    openModal(runModal);
  }

  if (editId) {
    const run = runs.find(r => String(r.id) === String(editId));
    if (!run) return;
    document.getElementById("run-id").value        = run.id;
    document.getElementById("f-title").value       = run.title ?? "";
    document.getElementById("f-description").value = run.description ?? "";
    document.getElementById("f-started").value     = run.started_at ? run.started_at.slice(0,16) : "";
    document.getElementById("f-distance").value    = run.distance ?? "";
    document.getElementById("f-unit").value        = run.unit ?? "mi";
    document.getElementById("f-duration").value    = run.duration_s ?? "";
    document.getElementById("f-type").value        = run.type ?? "Easy Run";

    document.getElementById("run-form-title").textContent = "Edit run";
    openModal(runFormModal);
  }

  if (delId) {
    if (confirm("Delete this run?")) {
      await fetch(`/runs/${delId}`, { method: "DELETE" });
      await loadRuns();
    }
  }
});

/* -------------------------- init -------------------------- */
loadRuns();