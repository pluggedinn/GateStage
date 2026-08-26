import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatLastSeen,
  hostFromSighting,
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
