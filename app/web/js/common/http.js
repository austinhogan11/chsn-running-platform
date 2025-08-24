window.CH = window.CH || {};
window.CH.http = {
  async getJSON(url) {
    const resp = await fetch(url);
    let data = {};
    try { data = await resp.json(); } catch {}
    if (!resp.ok) {
      const detail = typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map(d => d.msg || JSON.stringify(d)).join("; ")
          : "Request failed";
      const err = new Error(detail);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }
};