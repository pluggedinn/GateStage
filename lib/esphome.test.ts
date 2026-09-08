import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { parseLightStateJson, sendEsphomeCommand, testGate } from "./esphome";

const originalFetch = globalThis.fetch;
const ENV_KEYS = [
  "GATESTAGE_GATE_COMMAND_TIMEOUT_MS",
  "GATESTAGE_GATE_COMMAND_RETRIES",
  "GATESTAGE_GATE_COMMAND_RETRY_DELAY_MS",
  "GATESTAGE_GATE_TEST_DURATION_MS",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

function okResponse() {
  return new Response(null, { status: 200 });
}

function hungUntilAbort(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      reject(new Error("expected abort signal"));
      return;
    }
    // AbortSignal.timeout uses an unref'd timer; keep the event loop alive
    // so node:test does not finish before the abort fires.
    const keepAlive = setTimeout(() => {}, 30_000);
    const abort = () => {
      clearTimeout(keepAlive);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.GATESTAGE_GATE_COMMAND_TIMEOUT_MS = "800";
  process.env.GATESTAGE_GATE_COMMAND_RETRIES = "2";
  process.env.GATESTAGE_GATE_COMMAND_RETRY_DELAY_MS = "0";
  process.env.GATESTAGE_GATE_TEST_DURATION_MS = "0";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sendEsphomeCommand retries", () => {
  test("retries after a network error then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return okResponse();
    }) as typeof fetch;

    const res = await sendEsphomeCommand("10.0.0.2:80", { kind: "off" });
    assert.equal(res.ok, true);
    assert.equal(calls, 2);
  });

  test("aborts a hung POST at timeout then retries", async () => {
    process.env.GATESTAGE_GATE_COMMAND_TIMEOUT_MS = "40";
    let calls = 0;
    globalThis.fetch = (async (input, init) => {
      calls += 1;
      if (calls === 1) return hungUntilAbort(input, init);
      return okResponse();
    }) as typeof fetch;

    const res = await sendEsphomeCommand("10.0.0.2:80", { kind: "off" });
    assert.equal(res.ok, true);
    assert.equal(calls, 2);
  });

  test("retries HTTP 500 then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response(null, { status: 500 });
      return okResponse();
    }) as typeof fetch;

    const res = await sendEsphomeCommand("10.0.0.2:80", { kind: "off" });
    assert.equal(res.ok, true);
    assert.equal(calls, 2);
  });

  test("does not retry HTTP 404", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const res = await sendEsphomeCommand("10.0.0.2:80", { kind: "off" });
    assert.equal(res.status, 404);
    assert.equal(calls, 1);
  });

  test("exhausts retries and throws the last network error", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await assert.rejects(
      () => sendEsphomeCommand("10.0.0.2:80", { kind: "off" }),
      (err: unknown) => {
        assert.ok(err instanceof TypeError);
        assert.equal(err.message, "fetch failed");
        return true;
      },
    );
    assert.equal(calls, 3);
  });

  test("writes strobe start delay last and does not retry it", async () => {
    const urls: string[] = [];
    let startDelayCalls = 0;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("FX%20Strobe%20Start%20Delay")) {
        startDelayCalls += 1;
        if (startDelayCalls === 1) throw new TypeError("fetch failed");
      }
      return okResponse();
    }) as typeof fetch;

    await assert.rejects(
      () =>
        sendEsphomeCommand("10.0.0.2:80", {
          kind: "effect",
          effectId: "strobe",
          params: {
            period_ms: 240,
            on_ms: 80,
            start_delay_ms: 250,
          },
          brightnessPercent: 5,
          r: 255,
          g: 0,
          b: 0,
        }),
      (err: unknown) => {
        assert.ok(err instanceof TypeError);
        return true;
      },
    );

    const startDelayIndex = urls.findIndex((url) =>
      url.includes("FX%20Strobe%20Start%20Delay"),
    );
    const periodIndex = urls.findIndex((url) =>
      url.includes("FX%20Strobe%20Period"),
    );
    const onIndex = urls.findIndex((url) =>
      url.includes("FX%20Strobe%20On%20Time"),
    );
    const turnOnIndex = urls.findIndex((url) => url.includes("/light/"));
    assert.ok(periodIndex >= 0);
    assert.ok(onIndex >= 0);
    assert.ok(startDelayIndex >= 0);
    assert.equal(turnOnIndex, -1);
    assert.ok(startDelayIndex > periodIndex);
    assert.ok(startDelayIndex > onIndex);
    assert.equal(startDelayCalls, 1);
  });
});

describe("parseLightStateJson", () => {
  test("reads on, effect, brightness, and nested RGB", () => {
    const snapshot = parseLightStateJson({
      state: "ON",
      brightness: 153,
      effect: "Rainbow",
      color: { r: 255, g: 0, b: 128 },
    });
    assert.equal(snapshot.on, true);
    assert.equal(snapshot.effectName, "Rainbow");
    assert.equal(snapshot.brightness, 153);
    assert.equal(snapshot.r, 255);
    assert.equal(snapshot.g, 0);
    assert.equal(snapshot.b, 128);
  });

  test("treats missing effect as None and scales 0-1 channels", () => {
    const snapshot = parseLightStateJson({
      state: "ON",
      brightness: 0.6,
      r: 1,
      g: 0,
      b: 0.5,
    });
    assert.equal(snapshot.effectName, "None");
    assert.equal(snapshot.brightness, 153);
    assert.equal(snapshot.r, 255);
    assert.equal(snapshot.g, 0);
    assert.equal(snapshot.b, 128);
  });

  test("treats OFF as off", () => {
    const snapshot = parseLightStateJson({ state: "OFF", effect: "Strobe" });
    assert.equal(snapshot.on, false);
    assert.equal(snapshot.effectName, "Strobe");
  });
});

describe("testGate", () => {
  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  test("strobes then restores the previous effect", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/light/") && !url.includes("turn_")) {
        return jsonResponse({
          state: "ON",
          brightness: 153,
          effect: "Rainbow",
          color: { r: 255, g: 255, b: 255 },
        });
      }
      if (url.includes("/number/") && !url.includes("/set")) {
        if (url.includes("Period")) return jsonResponse({ value: 400 });
        if (url.includes("On%20Time")) return jsonResponse({ value: 200 });
        return jsonResponse({ value: 0 });
      }
      return okResponse();
    }) as typeof fetch;

    const result = await testGate("10.0.0.2:80");
    assert.equal(result.ok, true);

    const strobeOn = urls.find(
      (url) => url.includes("/light/") && url.includes("effect=Strobe"),
    );
    assert.ok(strobeOn);
    const restoreOn = urls.filter(
      (url) => url.includes("/light/") && url.includes("turn_on"),
    );
    const lastTurnOn = restoreOn.at(-1);
    assert.ok(lastTurnOn);
    assert.match(lastTurnOn, /effect=Rainbow/);
    assert.match(lastTurnOn, /brightness=153/);

    const periodSets = urls.filter((url) =>
      url.includes("FX%20Strobe%20Period"),
    );
    assert.ok(periodSets.some((url) => url.includes("value=80")));
    assert.ok(periodSets.some((url) => url.includes("value=400")));
  });

  test("restores a gate that was off", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/light/") && !url.includes("turn_")) {
        return jsonResponse({ state: "OFF", effect: "None" });
      }
      if (url.includes("/number/") && !url.includes("/set")) {
        return jsonResponse({ value: 400 });
      }
      return okResponse();
    }) as typeof fetch;

    await testGate("10.0.0.3:80");
    const lastLight = urls.findLast((url) => url.includes("/light/"));
    assert.ok(lastLight);
    assert.match(lastLight, /turn_off/);
  });

  test("restores a solid color", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/light/") && !url.includes("turn_")) {
        return jsonResponse({
          state: "ON",
          effect: "None",
          brightness: 100,
          color: { r: 255, g: 0, b: 0 },
        });
      }
      if (url.includes("/number/") && !url.includes("/set")) {
        return jsonResponse({ value: 200 });
      }
      return okResponse();
    }) as typeof fetch;

    await testGate("10.0.0.4:80");
    const lastTurnOn = urls.findLast(
      (url) => url.includes("/light/") && url.includes("turn_on"),
    );
    assert.ok(lastTurnOn);
    assert.match(lastTurnOn, /effect=None/);
    assert.match(lastTurnOn, /r=255/);
    assert.match(lastTurnOn, /g=0/);
    assert.match(lastTurnOn, /b=0/);
    assert.match(lastTurnOn, /brightness=100/);
  });
});
