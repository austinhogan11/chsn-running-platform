/* Training Log page scripts */

(function () {
  const listEl = document.getElementById("run-list");
  const sumMiEl = document.getElementById("sum-week-mi");
  const sumTimeEl = document.getElementById("sum-week-time");
  const sumElevEl = document.getElementById("sum-week-elev");

  const typeSel = document.getElementById("f-type");
  const startInp = document.getElementById("f-start");
  const endInp = document.getElementById("f-end");
  const clearBtn = document.getElementById("f-clear");

  const modal = document.getElementById("run-modal");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  /** Utilities */
  const pad2 = (n) => String(n).padStart(2, "0");
  function fmtTimeFromSeconds(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  }
  function fmtPace(pace_s, unit = "mi") {
    if (!Number.isFinite(pace_s) || pace_s <= 0) return "—";
    const m = Math.floor(pace_s / 60), s = pace_s % 60;
    return `${pad2(m)}:${pad2(s)} / ${unit}`;
  }
  function within(dateISO, startISO, endISO) {
    const t = new Date(dateISO).getTime();
    if (startISO && t < new Date(startISO).getTime()) return false;
    if (endISO) {
      // include entire end day
      const endT = new Date(endISO); endT.setHours(23,59,59,999);
      if (t > endT.getTime()) return false;
    }
    return true;
  }

  /** State */
  let runs = [];
  let filtered = [];

  /** Fetch runs (v1: get all; we can add server filters later) */
  async function loadRuns() {
    const resp = await fetch("/runs");
    runs = await resp.json();
    // optional: ensure pace fields exist
    runs.forEach(r => {
      if (!r.pace_s && r.distance > 0 && r.duration_s > 0) {
        r.pace_s = Math.round(r.duration_s / r.distance);
      }
    });
    applyFilters();
  }

  /** Compute PB by best pace among runs of the same rounded distance (to nearest .1) */
  function tagPersonalBests(items) {
    const bestByDist = new Map(); // key "mi:26.2" => {pace_s, idx}
    items.forEach((r, idx) => {
      const unit = r.unit || "mi";
      const key = `${unit}:${Math.round((r.distance || 0) * 10) / 10}`;
      const p = r.pace_s ?? Infinity;
      const best = bestByDist.get(key);
      if (!best || p < best.pace_s) bestByDist.set(key, { pace_s: p, idx });
    });
    items.forEach((r, idx) => {
      const unit = r.unit || "mi";
      const key = `${unit}:${Math.round((r.distance || 0) * 10) / 10}`;
      const best = bestByDist.get(key);
      r._isPB = best && best.idx === idx && Number.isFinite(best.pace_s);
    });
  }

  /** Filters + render */
  function applyFilters() {
    const type = (typeSel.value || "").trim();
    const start = startInp.value || "";
    const end = endInp.value || "";

    filtered = runs
      .filter(r => (type ? r.run_type === type : true))
      .filter(r => within(r.started_at, start, end))
      .sort((a,b) => new Date(b.started_at) - new Date(a.started_at));

    tagPersonalBests(filtered);
    renderList(filtered);
    renderWeekTotals(filtered);
  }

  function renderList(items) {
    listEl.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "card placeholder";
      empty.textContent = "No runs match the current filters.";
      listEl.appendChild(empty);
      return;
    }

    for (const r of items) {
      const el = document.createElement("article");
      el.className = "run" + (r.run_type === "race" ? " --race" : "");
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.dataset.runId = r.id;

      const dt = new Date(r.started_at);
      const dateStr = dt.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
      const timeStr = dt.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});

      el.innerHTML = `
        <div>
          <div class="run__title">${escapeHtml(r.title || "Untitled")}</div>
          <div class="run__desc">${escapeHtml(r.description || "")}</div>
        </div>
        <div class="run__type">
          ${r.run_type ? `<span class="badge ${r.run_type === 'race' ? 'race' : ''}">${r.run_type}</span>` : ""}
          ${r._isPB ? `<span class="badge pb" title="Personal Best">PB</span>` : ""}
        </div>
        <div class="run__dt">${dateStr} ${timeStr}</div>
        <div class="run__mi">${(r.distance ?? 0).toFixed(2)} ${r.unit || "mi"}</div>
        <div class="run__pace">${fmtPace(r.pace_s, r.unit || "mi")}</div>
        <div class="run__hr">${r.avg_hr ? `${r.avg_hr} bpm` : "—"}</div>
        <div class="run__elev">${r.elev_gain ? `${r.elev_gain} ft` : "—"}</div>
      `;

      el.addEventListener("click", () => openModal(r));
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openModal(r); }
      });

      listEl.appendChild(el);
    }
  }

  function renderWeekTotals(items) {
    // limit to current week (Mon–Sun)
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Mon=0
    const monday = new Date(now); monday.setDate(now.getDate() - day); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999);

    const inWeek = items.filter(r => {
      const t = new Date(r.started_at).getTime();
      return t >= monday.getTime() && t <= sunday.getTime();
    });

    const totalMi = inWeek.reduce((s,r) => r.unit === "km" ? s + (r.distance||0)*0.621371 : s + (r.distance||0), 0);
    const totalTime = inWeek.reduce((s,r) => s + (r.duration_s || 0), 0);
    const totalElev = inWeek.reduce((s,r) => s + (r.elev_gain || 0), 0);

    sumMiEl.textContent = totalMi.toFixed(1);
    sumTimeEl.textContent = fmtTimeFromSeconds(totalTime);
    sumElevEl.textContent = `${Math.round(totalElev)} ft`;
  }

  /** Modal */
  function openModal(r) {
    const dt = new Date(r.started_at);
    const dateStr = dt.toLocaleString();

    modalBody.innerHTML = `
      <div class="kv"><strong>Title</strong><div>${escapeHtml(r.title || "Untitled")}</div></div>
      <div class="kv"><strong>Type</strong><div>${r.run_type || "—"}</div></div>
      <div class="kv"><strong>Date/Time</strong><div>${dateStr}</div></div>
      <div class="kv"><strong>Distance</strong><div>${(r.distance ?? 0).toFixed(2)} ${r.unit || "mi"}</div></div>
      <div class="kv"><strong>Duration</strong><div>${fmtTimeFromSeconds(r.duration_s || 0)}</div></div>
      <div class="kv"><strong>Pace</strong><div>${fmtPace(r.pace_s, r.unit || "mi")}</div></div>
      <div class="kv"><strong>Avg HR</strong><div>${r.avg_hr ? `${r.avg_hr} bpm` : "—"}</div></div>
      <div class="kv"><strong>Elev Gain</strong><div>${r.elev_gain ? `${r.elev_gain} ft` : "—"}</div></div>

      ${r.description ? `<h3>Description</h3><pre>${escapeHtml(r.description)}</pre>` : ""}

      ${r.splits ? `<h3>Splits</h3><pre>${escapeHtml(JSON.stringify(r.splits, null, 2))}</pre>` : ""}
      ${r.hr_series ? `<h3>Heart Rate</h3><pre>${escapeHtml(JSON.stringify(r.hr_series, null, 2))}</pre>` : ""}
      ${r.elev_series ? `<h3>Elevation</h3><pre>${escapeHtml(JSON.stringify(r.elev_series, null, 2))}</pre>` : ""}
      ${r.route_polyline ? `<h3>Route</h3><div>(map placeholder)</div>` : ""}
    `;

    document.getElementById("modal-title").textContent = r.title || "Run Details";
    modal.hidden = false;
  }

  function closeModal() { modal.hidden = true; }
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal__backdrop")) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* Filters */
  typeSel.addEventListener("change", applyFilters);
  startInp.addEventListener("change", applyFilters);
  endInp.addEventListener("change", applyFilters);
  clearBtn.addEventListener("click", () => {
    typeSel.value = ""; startInp.value = ""; endInp.value = ""; applyFilters();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // init
  loadRuns().catch(err => {
    listEl.innerHTML = `<div class="card placeholder">Failed to load runs: ${escapeHtml(err)}</div>`;
  });
})();