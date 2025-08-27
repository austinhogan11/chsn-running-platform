// /static/js/training-log.js

// ---------- DOM refs ----------
const runListEl     = document.getElementById("run-list");
const runModal      = document.getElementById("run-modal");
const runFormModal  = document.getElementById("run-form-modal");
const runForm       = document.getElementById("run-form");
const addBtn        = document.getElementById("add-run-btn");
const weekTotalPill = document.getElementById("week-total-pill");

let runs = [];

// ---------- persistence ----------
function cacheRuns(){ try{ localStorage.setItem("runs-cache", JSON.stringify(runs)); }catch{} }
function getCachedRuns(){ try{ const raw = localStorage.getItem("runs-cache"); return raw?JSON.parse(raw):[]; }catch{ return [];}}

// ---------- data load ----------
async function loadRuns(){
  try{
    const res = await fetch("/runs");
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    runs = await res.json();
  }catch{
    runs = getCachedRuns();
  }
  cacheRuns();
  renderRuns();
  tlRenderCharts?.();  // draw charts
}

// ---------- list render ----------
function paceFrom(run){
  const d = Number(run?.distance) || 0;
  const s = Number(run?.duration_s) || 0;
  if(d <= 0 || s <= 0) return "—";
  return secondsToMMSS(Math.round(s/d));
}
function unitAbbrev(run){ return (run?.unit === "km") ? "km" : "mi"; }

function renderRuns(){
  if(!runListEl) return;
  runListEl.innerHTML = "";

  if(!runs.length){
    runListEl.innerHTML = `<div class="tl-empty"><p>No runs yet. Add one!</p></div>`;
    return;
  }

  for(const run of runs){
    const el = document.createElement("div");
    el.className = "tl-item";
    const mins = run?.duration_s ? Math.round(run.duration_s/60) : 0;
    const p = paceFrom(run);

    el.innerHTML = `
      <div class="tl-item__main">
        <div class="tl-item__title">${escapeHTML(run.title || "Untitled run")}</div>
        <div class="tl-item__meta">
          ${run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
          • ${num(run.distance)} ${unitAbbrev(run)}
          • ${mins} min
          • pace ${p} / ${unitAbbrev(run)}
          • elev ${num(run.elevation_ft || 0)} ft
          • ${escapeHTML(run.type || "Easy Run")}
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

// ---------- layers (sheet / modal) ----------
function openLayer(el){
  if(!el) return;
  el.hidden = false;
  if(addBtn) addBtn.style.display = "none";
}
function closeLayer(el){
  if(!el) return;
  el.hidden = true;
  if(addBtn) addBtn.style.display = ""; // restore default
}

// close buttons work for both .modal and .sheet
document.querySelectorAll("[data-close]").forEach(btn=>{
  btn.addEventListener("click", e => closeLayer(e.target.closest(".modal, .sheet")));
});
document.addEventListener("click", e=>{
  if(e.target.classList.contains("modal__backdrop") || e.target.classList.contains("sheet__backdrop")){
    closeLayer(e.target.closest(".modal, .sheet"));
  }
});
document.addEventListener("keydown", e=>{
  if(e.key !== "Escape") return;
  if(runFormModal && !runFormModal.hidden) return closeLayer(runFormModal);
  if(runModal && !runModal.hidden) return closeLayer(runModal);
});

// ---------- charts (tiny canvas helpers, no libs) ----------
(function () {
  const WEEKS_12 = "12w";
  const MONTHS_6 = "6m";
  const YEARS_1  = "1y";

  const weekCanvas  = document.getElementById("weekChart");
  const trendCanvas = document.getElementById("trendChart");
  const seg = document.querySelector('[data-seg="trend-range"]');

  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Mon=0
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - day);
    return x;
  }

  function weekDailyMiles(list){
    const days = [0,0,0,0,0,0,0];
    const now = new Date();
    const a = startOfWeek(now);
    const b = new Date(a); b.setDate(a.getDate()+7);
    for(const r of list||[]){
      if(!r?.started_at || r.distance == null) continue;
      const d = new Date(r.started_at);
      if(d>=a && d<b){
        const i = (d.getDay()+6)%7;
        days[i] += (r.unit==="km" ? r.distance*0.621371 : r.distance);
      }
    }
    return days;
  }

  function weeklyTotals(list, rangeKey){
    const out = [];
    const end = startOfWeek(new Date());
    let periods = 12;
    if(rangeKey===MONTHS_6) periods = 26;
    if(rangeKey===YEARS_1)  periods = 52;

    for(let i=periods-1;i>=0;i--){
      const s = new Date(end); s.setDate(s.getDate()-i*7);
      const e = new Date(s);   e.setDate(s.getDate()+7);
      let sum = 0;
      for(const r of list||[]){
        if(!r?.started_at || r.distance==null) continue;
        const d = new Date(r.started_at);
        if(d>=s && d<e) sum += (r.unit==="km"? r.distance*0.621371 : r.distance);
      }
      out.push(sum);
    }
    return out;
  }

  function clearCanvas(c){
    if(!c) return null;
    const ctx = c.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width  = Math.max(1, Math.floor(w*ratio));
    c.height = Math.max(1, Math.floor(h*ratio));
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,w,h);
    return ctx;
  }
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function drawBars(c, values, labels){
    const ctx = clearCanvas(c); if(!ctx) return;
    const w=c.clientWidth, h=c.clientHeight;
    const pad=24, W=w-pad*2, H=h-pad*2;
    const max = Math.max(1, ...values);
    const bw = W/values.length * 0.7;
    const gap= W/values.length * 0.3;

    ctx.fillStyle = cssVar("--border");
    ctx.fillRect(pad, h-pad, W, 1);

    ctx.fillStyle = cssVar("--green-600") || "#169b80";
    values.forEach((v,i)=>{
      const x = pad + i*(bw+gap) + gap*0.5;
      const bh = max ? (v/max)*(H-16) : 0;
      ctx.fillRect(x, h-pad-bh, bw, bh);
    });

    ctx.fillStyle = cssVar("--muted");
    ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.textAlign = "center";
    labels.forEach((lab,i)=>{
      const x = pad + i*(bw+gap) + gap*0.5 + bw/2;
      ctx.fillText(lab, x, h-6);
    });
  }

  function drawLine(c, values){
    const ctx = clearCanvas(c); if(!ctx) return;
    const w=c.clientWidth, h=c.clientHeight;
    const pad=24, W=w-pad*2, H=h-pad*2;
    const max = Math.max(1, ...values);
    const step = W/Math.max(1, values.length-1);

    ctx.fillStyle = cssVar("--border");
    ctx.fillRect(pad, h-pad, W, 1);

    const stroke = cssVar("--green-600") || "#169b80";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v,i)=>{
      const x = pad + i*step;
      const y = h - pad - (max ? (v/max)*(H-16) : 0);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle = stroke;
    values.forEach((v,i)=>{
      const x = pad + i*step;
      const y = h - pad - (max ? (v/max)*(H-16) : 0);
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
  }

  window.tlRenderCharts = function tlRenderCharts(range = WEEKS_12){
    const week = weekDailyMiles(runs);
    drawBars(weekCanvas, week, ["M","T","W","T","F","S","S"]);

    const total = week.reduce((a,b)=>a+b,0);
    if(weekTotalPill) weekTotalPill.textContent = `${total.toFixed(1)} mi`;

    drawLine(trendCanvas, weeklyTotals(runs, range));

    seg?.querySelectorAll(".seg__btn")?.forEach(b=>{
      const active = b.dataset.range === range;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  seg?.addEventListener("click", e=>{
    const btn = e.target.closest(".seg__btn");
    if(btn) tlRenderCharts(btn.dataset.range);
  });

  window.addEventListener("resize", ()=>{
    const active = seg?.querySelector(".seg__btn.is-active")?.dataset.range || WEEKS_12;
    tlRenderCharts(active);
  });
})();

// ---------- Add/Edit flow ----------
addBtn?.addEventListener("click", ()=>{
  if(!runForm) return;
  runForm.reset();
  setText("run-form-title","Add run");

  const now = new Date();
  setVal("run-id","");
  setVal("f-date", now.toISOString().slice(0,10));
  setVal("f-time", `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  setVal("f-duration-hms","00:00:00");
  setVal("f-elev","0");
  const mi = document.getElementById("unit-mi"); if(mi) mi.checked = true;

  openLayer(runFormModal);
});

// ensure the unit slider updates when we set radios programmatically
function setUnit(unit){
  const target = document.getElementById(unit === "km" ? "unit-km" : "unit-mi");
  if(target){
    target.checked = true;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// init segmented unit control: set data-active and CSS vars for sliding highlight
function initUnitToggle(){
  const wrap = document.querySelector(".unit-toggle");
  if(!wrap) return;

  const mi = document.getElementById("unit-mi");
  const km = document.getElementById("unit-km");
  const miLabel = document.querySelector('label[for="unit-mi"]');
  const kmLabel = document.querySelector('label[for="unit-km"]');

  function positionHighlight(){
    const active = (km && km.checked) ? "km" : "mi";
    wrap.dataset.active = active;

    // compute highlight geometry (center the text)
    const targetLabel = active === "km" ? kmLabel : miLabel;
    const wrapBox = wrap.getBoundingClientRect();
    const labBox  = targetLabel?.getBoundingClientRect?.();
    if (wrapBox && labBox) {
      const left  = Math.max(0, labBox.left - wrapBox.left);
      const width = labBox.width;
      wrap.style.setProperty("--seg-left",  `${left}px`);
      wrap.style.setProperty("--seg-width", `${width}px`);
    }

    // accessibility states
    mi?.setAttribute("aria-checked", active === "mi" ? "true" : "false");
    km?.setAttribute("aria-checked", active === "km" ? "true" : "false");
  }

  mi?.addEventListener("change", positionHighlight);
  km?.addEventListener("change", positionHighlight);
  window.addEventListener("resize", positionHighlight);

  // initial
  positionHighlight();
}

// smart HH:MM:SS typing (mirror pace calculator behavior; right-align last 6 digits)
(function(){
  const input = document.getElementById("f-duration-hms");
  if(!input) return;

  const hmsFromDigits = (window.CH?.format?.hmsFromDigits) || function(raw){
    // take LAST 6 digits typed, right-aligned
    const digits = String(raw || "").replace(/\D/g, "");
    const right  = digits.slice(-6);              // <= key fix vs earlier slice(0,6)
    const s = right.padStart(6,"0");
    return `${s.slice(0,2)}:${s.slice(2,4)}:${s.slice(4,6)}`;
  };

  function formatAndKeepCaretEnd(){
    const caretAtEnd = document.activeElement === input &&
                       input.selectionStart === input.value.length;
    input.value = hmsFromDigits(input.value);
    if (caretAtEnd) {
      const end = input.value.length;
      requestAnimationFrame(()=> input.setSelectionRange(end, end));
    }
  }

  input.addEventListener("input",  formatAndKeepCaretEnd);
  input.addEventListener("change", formatAndKeepCaretEnd);

  input.addEventListener("paste", (e)=>{
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    input.value = hmsFromDigits(text);
    const end = input.value.length;
    requestAnimationFrame(()=> input.setSelectionRange(end, end));
  });
})();

// submit
runForm?.addEventListener("submit", async e=>{
  e.preventDefault();
  const payload = {
    title:        val("f-title"),
    description:  val("f-description"),
    started_at:   `${val("f-date")}T${val("f-time")}:00`,
    distance:     parseFloat(val("f-distance")),
    unit:         document.querySelector('input[name="f-unit"]:checked')?.value || "mi",
    duration_s:   hmsToSeconds(val("f-duration-hms")),
    elevation_ft: parseInt(val("f-elev")||"0",10),
    type:         val("f-type")
  };
  const id = val("run-id");
  const url = id ? `/runs/${id}` : "/runs";
  const method = id ? "PUT" : "POST";

  await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  closeLayer(runFormModal);
  await loadRuns();
});

// delegated actions
runListEl?.addEventListener("click", async e=>{
  const btn = e.target.closest("[data-view],[data-edit],[data-delete]"); if(!btn) return;
  const viewId = btn.dataset.view, editId = btn.dataset.edit, delId = btn.dataset.delete;

  if(viewId){
    const run = runs.find(r=>String(r.id)===viewId); if(!run) return;
    setText("modal-title", run.title || "Run");
    setHTML("modal-body", `
      <p><strong>Date:</strong> ${new Date(run.started_at).toLocaleString()}</p>
      <p><strong>Distance:</strong> ${num(run.distance)} ${unitAbbrev(run)}</p>
      <p><strong>Duration:</strong> ${secondsToHms(run.duration_s)}</p>
      <p><strong>Pace:</strong> ${paceFrom(run)} / ${unitAbbrev(run)}</p>
      <p><strong>Elevation gain:</strong> ${num(run.elevation_ft)} ft</p>
      <p><strong>Type:</strong> ${escapeHTML(run.type)}</p>
      <p><strong>Description:</strong> ${escapeHTML(run.description)}</p>
    `);
    openLayer(runModal);
  }

  if(editId){
    const run = runs.find(r=>String(r.id)===editId); if(!run) return;
    setVal("run-id", run.id);
    setText("run-form-title","Edit run");
    setVal("f-title", run.title || "");
    setVal("f-description", run.description || "");
    const d = new Date(run.started_at);
    setVal("f-date", d.toISOString().slice(0,10));
    setVal("f-time", `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
    setVal("f-distance", run.distance);
    setUnit(run.unit === "km" ? "km" : "mi");
    setVal("f-duration-hms", secondsToHms(run.duration_s));
    setVal("f-type", run.type);
    setVal("f-elev", String(run.elevation_ft ?? 0));
    openLayer(runFormModal);
  }

  if(delId && confirm("Delete this run?")){
    await fetch(`/runs/${delId}`,{method:"DELETE"});
    await loadRuns();
  }
});

// ---------- helpers ----------
function val(id){ return document.getElementById(id)?.value || ""; }
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=v; }
function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function setHTML(id,v){ const el=document.getElementById(id); if(el) el.innerHTML=v; }
function num(n){ return Number.isFinite(+n)?+n:0; }
function escapeHTML(s=""){ return String(s).replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])); }
function hmsToSeconds(hms){
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(hms||"");
  if(!m) return 0;
  return (+m[1])*3600 + (+m[2])*60 + (+m[3]);
}
function secondsToHms(sec=0){
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function secondsToMMSS(sec=0){
  const m=Math.floor(sec/60), s=sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ---------- init ----------
initUnitToggle();
loadRuns();