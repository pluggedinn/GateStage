import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dashboardIssues,
  eventIssueLabel,
  timelineDetail,
  timelineTitle,
} from "./dashboard-glance";
import {
  NO_ROUTINE_COMMAND,
  NOTHING_SENT_COMMAND,
  type RaceActionEnvelope,
  type RaceEventEnvelope,
} from "./types";

function heatEvent(
  type: "heat.go" | "heat.finished" | "heat.last_call",
  at: string,
  name = "Heat 3",
): RaceEventEnvelope {
  if (type === "heat.last_call") {
    return {
      type,
      at,
      payload: { type, seconds: 30, heat: { id: "3", name } },
    };
  }
  return {
    type,
    at,
    payload: { type, heat: { id: "3", name } },
  };
}

function crossing(at: string, lap: number): RaceEventEnvelope {
  return {
    type: "pilot.crossing",
    at,
    payload: {
      type: "pilot.crossing",
      pilot: {
        id: "pilot-1",
        name: "Alpha",
        color: { r: 255, g: 0, b: 0 },
      },
      crossing: { lap },
    },
  };
}

function action(
  partial: Partial<RaceActionEnvelope> &
    Pick<RaceActionEnvelope, "gateId" | "at">,
): RaceActionEnvelope {
  return {
    command: "turn_off",
    success: true,
    ...partial,
  };
}

describe("event text", () => {
  test("names a crossing by pilot and lap", () => {
    const event = crossing("2026-01-01T00:00:02.000Z", 3);
    assert.equal(timelineTitle(event), "Alpha");
    assert.equal(timelineDetail(event), "Lap 3");
  });

  test("names a go with its heat", () => {
    const event = heatEvent("heat.go", "2026-01-01T00:00:01.000Z");
    assert.equal(timelineTitle(event), "Go");
    assert.equal(timelineDetail(event), "Heat 3");
  });
});

describe("issues", () => {
  test("flags an event with no routine and ignores a healthy command", () => {
    const go = heatEvent("heat.go", "2026-01-01T00:00:01.000Z");
    const actions = [
      action({
        gateId: "routine",
        at: "2026-01-01T00:00:01.100Z",
        eventAt: go.at,
        command: NO_ROUTINE_COMMAND,
        success: false,
      }),
      action({
        gateId: "gate-a",
        at: "2026-01-01T00:00:00.100Z",
        command: "rgb(0,255,0) @ 5%",
        success: true,
      }),
    ];
    assert.equal(eventIssueLabel(go, actions), NO_ROUTINE_COMMAND);
    const issues = dashboardIssues([go], actions, []);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].tone, "warn");
    assert.equal(issues[0].title, "Go · No routine");
    assert.equal(issues[0].detail, "Heat 3");
  });

  test("keeps a failed command and a nothing-sent notice", () => {
    const go = heatEvent("heat.go", "2026-01-01T00:00:01.000Z");
    const actions = [
      action({
        gateId: "gate-a",
        at: "2026-01-01T00:00:01.200Z",
        eventAt: go.at,
        success: false,
        error: "HTTP 500",
        command: "rgb(0,255,0) @ 5%",
      }),
      action({
        gateId: "routine",
        at: "2026-01-01T00:00:02.000Z",
        command: NOTHING_SENT_COMMAND,
        success: false,
      }),
    ];
    assert.equal(eventIssueLabel(go, actions), "gate-a failed");
    const issues = dashboardIssues([go], actions, []);
    assert.equal(issues[0].title, "Nothing sent");
    assert.equal(issues[1].detail, "HTTP 500");
    assert.equal(issues[1].tone, "error");
  });

  test("lists offline, weak, and hot gates and skips disabled ones", () => {
    const issues = dashboardIssues(
      [],
      [],
      [
        {
          id: "gate-b",
          enabled: true,
          online: false,
          rssi: -90,
          tempC: 90,
        },
        {
          id: "gate-a",
          enabled: true,
          online: true,
          rssi: -85,
          tempC: 82,
        },
        {
          id: "gate-c",
          enabled: false,
          online: false,
          rssi: null,
          tempC: null,
        },
        {
          id: "gate-d",
          enabled: true,
          online: true,
          rssi: -60,
          tempC: 40,
        },
      ],
    );
    assert.deepEqual(
      issues.map((issue) => issue.detail),
      ["Weak signal · -85 dBm", "Hot · 82°C", "Offline"],
    );
  });
});
