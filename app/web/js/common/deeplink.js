/* global window */
window.CH = window.CH || {};
window.CH.deeplink = (function () {
  function normalizeUnitForUI(u) {
    if (!u) return "mi";
    const s = String(u).toLowerCase();
    if (["mi", "mile", "miles"].includes(s)) return "mi";
    if (["km", "kilometer", "kilometers"].includes(s)) return "km";
    return "mi";
  }
  function toShortUnit(u) { return u === "km" ? "km" : "mi"; }

  function getSelectedUnit() {
    return document.querySelector('input[name="unit"]:checked')?.value || "mi";
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
    const d = qs.get("distance");
    const t = qs.get("time");
    const p = qs.get("pace");
    if (d) document.getElementById("distance").value = d;
    if (t) document.getElementById("time").value = t;
    if (p) document.getElementById("pace").value = p;
  }

  function updateQueryFromForm(distanceRaw, time, pace, unitUIValue) {
    const keys = providedKeys(distanceRaw, time, pace);
    if (keys.length !== 2) return null;

    const qs = new URLSearchParams();
    qs.set("unit", toShortUnit(unitUIValue));
    if (distanceRaw) qs.set("distance", distanceRaw);
    if (time)        qs.set("time", time);
    if (pace)        qs.set("pace", pace);

    const newUrl = `${window.location.pathname}?${qs.toString()}`;
    history.replaceState(null, "", newUrl);
    return newUrl;
  }

  return {
    normalizeUnitForUI,
    toShortUnit,
    getSelectedUnit,
    setSelectedUnit,
    providedKeys,
    prefillFromQuery,
    updateQueryFromForm,
  };
})();