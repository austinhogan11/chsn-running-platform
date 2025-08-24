/* global window */
window.CH = window.CH || {};
window.CH.format = (function () {
  function onlyDigits(str) {
    return (str || "").replace(/\D/g, "");
  }

  // HH:MM:SS (accepts "", "S", "MMSS", "HHMMSS")
  function hmsFromDigits(digits) {
    const d = onlyDigits(digits).slice(-6);
    if (!d) return "";
    if (d.length <= 2) return `00:00:${d.padStart(2, "0")}`;
    if (d.length <= 4) return `00:${d.slice(0, -2).padStart(2, "0")}:${d.slice(-2)}`;
    return `${d.slice(0, -4).padStart(2, "0")}:${d.slice(-4, -2)}:${d.slice(-2)}`;
  }

  // MM:SS (accepts "", "S", "MMSS")
  function msFromDigits(digits) {
    const d = onlyDigits(digits).slice(-4);
    if (!d) return "";
    if (d.length <= 2) return `00:${d.padStart(2, "0")}`;
    return `${d.slice(0, -2).padStart(2, "0")}:${d.slice(-2)}`;
  }

  return { onlyDigits, hmsFromDigits, msFromDigits };
})();