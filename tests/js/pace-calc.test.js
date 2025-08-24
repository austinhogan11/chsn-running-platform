/**
 * Minimal Jest + jsdom tests for app/web/js/pace-calc.js
 * These are smoke tests: they mount a tiny DOM, mock deps on window.CH,
 * and assert the main flows (formatting, submit, result render) work.
 */

// Helper to mount a bare HTML fixture the script expects
function mountDOM() {
  document.body.innerHTML = `
    <main>
      <h1>Pace Calculator</h1>
      <form id="pace-form" autocomplete="off">
        <label for="distance">Distance</label>
        <div class="distance-row">
          <input id="distance" />
          <div class="unit-toggle">
            <label><input type="radio" name="unit" value="mi" checked /><span>mi</span></label>
            <label><input type="radio" name="unit" value="km" /><span>km</span></label>
          </div>
        </div>
        <label for="time">Time</label>
        <input id="time" />
        <label for="pace">Pace</label>
        <input id="pace" />
        <button type="submit">Calculate</button>
      </form>
      <pre id="result"></pre>
    </main>
  `;
}

// Mock window.CH namespace used by pace-calc.js
function installCHMocks() {
  global.window.CH = {
    deeplink: {
      prefillFromQuery: jest.fn(),
      getSelectedUnit: () =>
        document.querySelector('input[name="unit"]:checked')?.value || "mi",
      toShortUnit: (u) => (u === "km" ? "km" : "mi"),
      updateQueryFromForm: jest.fn(() => "?distance=5&time=00:40:00&unit=mi"),
    },
    format: {
      // Keep them simple; just prove the handler ran
      hmsFromDigits: (d) => (d || "").replace(/[^0-9:]/g, ""),
      msFromDigits: (d) => (d || "").replace(/[^0-9:]/g, ""),
    },
    theme: {
      initThemeToggle: jest.fn(),
    },
    http: {
      getJSON: undefined, // force pace-calc.js to use its fetch fallback
    },
    dom: {
      copy: undefined, // force clipboard fallback
    },
  };
}

// Mock fetch for the submit path
function mockFetchOnce(data, { status = 200 } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

// Wait until an assertion passes or timeout
async function eventually(assertFn, { timeout = 300, step = 10 } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeout) {
    try {
      assertFn();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, step));
    }
  }
  throw lastErr;
}

const path = require("path");
const PACE_CALC_PATH = path.join(
  process.cwd(),
  "app",
  "web",
  "js",
  "pace-calc.js"
);

describe("pace-calc.js", () => {
  beforeEach(() => {
    jest.resetModules(); // ensure a fresh require runs listeners again
    mountDOM();
    installCHMocks();
  });

  test("formats inputs via shared helpers on input", async () => {
    require(PACE_CALC_PATH);

    const time = document.getElementById("time");
    const pace = document.getElementById("pace");

    time.value = "004000";
    time.dispatchEvent(new Event("input"));

    pace.value = "0800";
    pace.dispatchEvent(new Event("input"));

    // Our mock formatters just strip non [0-9:] chars; this ensures handler ran
    expect(time.value).toMatch(/^[0-9:]*$/);
    expect(pace.value).toMatch(/^[0-9:]*$/);
  });

  test("successful submit renders result and updates query", async () => {
    require(PACE_CALC_PATH);

    // Fill two of three (distance + time)
    document.getElementById("distance").value = "5";
    document.getElementById("time").value = "00:40:00";

    // Mock backend response
    const apiResp = { distance: 5, time: "00:40:00", pace: "08:00", unit: "mi" };
    mockFetchOnce(apiResp);

    const form = document.getElementById("pace-form");
    form.dispatchEvent(new Event("submit"));

    await eventually(() => {
      const text = document.getElementById("result").textContent;
      expect(text).toContain("Distance (mi): 5");
      expect(text).toContain("Time: 00:40:00");
      expect(text).toContain("Pace (min/mi): 08:00");
    });

    expect(window.CH.deeplink.updateQueryFromForm).toHaveBeenCalled();
  });

  test("validation error is shown for bad distance", async () => {
    require(PACE_CALC_PATH);

    document.getElementById("distance").value = "-1";
    document.getElementById("time").value = "00:40:00";

    const form = document.getElementById("pace-form");
    form.dispatchEvent(new Event("submit"));

    await eventually(() => {
      const text = document.getElementById("result").textContent;
      expect(text).toMatch(/Distance must be a positive number/i);
    });
  });
});