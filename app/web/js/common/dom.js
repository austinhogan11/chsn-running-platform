window.CH = window.CH || {};
window.CH.dom = {
  byId: (id) => document.getElementById(id),
  on: (el, ev, fn) => el && el.addEventListener(ev, fn),
  async copy(text) { await navigator.clipboard.writeText(text); }
};