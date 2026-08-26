import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { sendEsphomeCommand } from "./esphome";

const originalFetch = globalThis.fetch;
const ENV_KEYS = [
  "GATESTAGE_GATE_COMMAND_TIMEOUT_MS",
  "GATESTAGE_GATE_COMMAND_RETRIES",
  "GATESTAGE_GATE_COMMAND_RETRY_DELAY_MS",
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
});
