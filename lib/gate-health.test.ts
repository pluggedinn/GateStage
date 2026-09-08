import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  appendRssiHistory,
  formatLastSeen,
  hostFromSighting,
  minRssi,
  parseUdpPacket,
} from "./gate-health";

describe("parseUdpPacket", () => {
  test("parses a full beacon", () => {
    const parsed = parseUdpPacket(
      '{"v":1,"id":"gate-start","rssi":-62,"tC":47.5,"port":80}',
    );
    assert.deepEqual(parsed, {
      kind: "beacon",
      id: "gate-start",
      rssi: -62,
      tempC: 47.5,
      port: 80,
      uptimeSec: null,
      disconnects: null,
      rssiMin: null,
    });
  });

  test("parses a beacon without telemetry", () => {
    const parsed = parseUdpPacket('{"v":1,"id":"gate-2"}');
    assert.equal(parsed?.kind, "beacon");
    if (parsed?.kind !== "beacon") return;
    assert.equal(parsed.id, "gate-2");
    assert.equal(parsed.rssi, null);
    assert.equal(parsed.tempC, null);
    assert.equal(parsed.port, 80);
    assert.equal(parsed.uptimeSec, null);
    assert.equal(parsed.disconnects, null);
    assert.equal(parsed.rssiMin, null);
  });

  test("parses link telemetry", () => {
    const parsed = parseUdpPacket(
      '{"v":1,"id":"gate-2","rssi":-54,"tC":41.2,"up":120,"dc":3,"rssiMin":-81}',
    );
    assert.equal(parsed?.kind, "beacon");
    if (parsed?.kind !== "beacon") return;
    assert.equal(parsed.uptimeSec, 120);
    assert.equal(parsed.disconnects, 3);
    assert.equal(parsed.rssiMin, -81);
  });

  test("treats zero rssiMin as missing", () => {
    const parsed = parseUdpPacket(
      '{"v":1,"id":"gate-2","up":5,"dc":0,"rssiMin":0}',
    );
    assert.equal(parsed?.kind, "beacon");
    if (parsed?.kind !== "beacon") return;
    assert.equal(parsed.disconnects, 0);
    assert.equal(parsed.rssiMin, null);
  });

  test("parses a who packet", () => {
    assert.deepEqual(parseUdpPacket('{"v":1,"q":"who"}'), { kind: "who" });
  });

  test("rejects garbage", () => {
    assert.equal(parseUdpPacket("not json"), null);
    assert.equal(parseUdpPacket("{}"), null);
  });
});

describe("hostFromSighting", () => {
  test("strips ipv4-mapped ipv6", () => {
    assert.equal(
      hostFromSighting("::ffff:192.168.1.41", 80),
      "192.168.1.41:80",
    );
  });
});

describe("formatLastSeen", () => {
  test("formats seconds", () => {
    const now = Date.parse("2026-08-25T12:00:10.000Z");
    assert.equal(formatLastSeen("2026-08-25T12:00:03.000Z", now), "7s ago");
  });

  test("never when missing", () => {
    assert.equal(formatLastSeen(null), "never");
  });
});

describe("rssi history", () => {
  test("caps length and reports the worst sample", () => {
    let history: number[] = [];
    for (const rssi of [-50, -60, -55, -72]) {
      history = appendRssiHistory(history, rssi, 3);
    }
    assert.deepEqual(history, [-60, -55, -72]);
    assert.equal(minRssi([-50, ...history, null]), -72);
  });
});
