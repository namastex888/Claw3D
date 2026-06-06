import { describe, expect, it } from "vitest";

import { buildHermesSnapshot } from "@/lib/runtime/hermes-native/snapshot";
import { projectHermesSnapshotToTower } from "@/lib/world/hermesSnapshotProjection";

describe("Hermes native snapshot", () => {
  it("normalizes Hermes 9119 status, profiles, and sessions into an observed snapshot", async () => {
    const snapshot = await buildHermesSnapshot({
      baseUrl: "http://localhost:9119",
      fetchJson: async (pathname) => {
        if (pathname === "/api/status") {
          return {
            ok: true,
            status: 200,
            data: {
              version: "0.15.1",
              gateway_running: true,
              active_sessions: 2,
              gateway_platforms: {
                telegram: { state: "connected", updated_at: "2026-06-05T10:00:00Z" },
              },
            },
          };
        }
        if (pathname === "/api/profiles") {
          return {
            ok: true,
            status: 200,
            data: {
              profiles: [
                { name: "default", model: "gpt-5.5", provider: "openai-codex", gateway_running: true },
              ],
            },
          };
        }
        if (pathname.startsWith("/api/sessions")) {
          return {
            ok: true,
            status: 200,
            data: {
              sessions: [
                {
                  id: "sess_1",
                  source: "telegram",
                  title: "Build Hermes native Claw3D",
                  model: "gpt-5.5",
                  message_count: 7,
                  tool_call_count: 3,
                  model_config: JSON.stringify({ cwd: "/workspace/Claw3D" }),
                  started_at: 1000,
                  last_active: 1100,
                },
              ],
            },
          };
        }
        if (pathname === "/api/sessions/stats") {
          return { ok: true, status: 200, data: { total: 10, active_store: 9, messages: 42 } };
        }
        throw new Error(`Unexpected fetch ${pathname}`);
      },
    });

    expect(snapshot.truth).toBe("OBSERVED");
    expect(snapshot.server).toMatchObject({
      url: "http://localhost:9119",
      version: "0.15.1",
      gatewayRunning: true,
      activeSessions: 2,
    });
    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]).toMatchObject({
      id: "sess_1",
      source: "telegram",
      title: "Build Hermes native Claw3D",
      truth: "OBSERVED",
    });
    expect(snapshot.sources.every((source) => source.ok)).toBe(true);
  });

  it("keeps partial endpoint failures visible as GAP instead of empty work", async () => {
    const snapshot = await buildHermesSnapshot({
      baseUrl: "http://localhost:9119",
      fetchJson: async (pathname) => {
        if (pathname === "/api/status") {
          return { ok: true, status: 200, data: { version: "0.15.1", gateway_running: true } };
        }
        return { ok: false, status: 401, error: "Unauthorized" };
      },
    });

    expect(snapshot.truth).toBe("GAP");
    expect(snapshot.sources.some((source) => !source.ok && source.status === 401)).toBe(true);
  });
});

describe("Khaw Tower snapshot projection", () => {
  it("groups Wish floors under Office and Labs elevator banks with placement truth", () => {
    const tower = projectHermesSnapshotToTower({
      at: 123,
      truth: "OBSERVED",
      server: {
        url: "http://localhost:9119",
        version: "0.15.1",
        gatewayRunning: true,
        activeSessions: 3,
        platforms: { telegram: { state: "connected" } },
      },
      wishes: [],
      profiles: [{ id: "default", name: "default", model: "gpt-5.5", provider: "openai-codex", truth: "OBSERVED" }],
      sessions: [
        {
          id: "sess_acp_generic_older",
          source: "acp",
          title: "acp 00c94d7f",
          model: "codex",
          profileName: null,
          messageCount: 3,
          toolCallCount: 1,
          cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
          startedAt: 900,
          lastActiveAt: 900,
          truth: "OBSERVED",
        },
        {
          id: "sess_acp_generic_newer",
          source: "acp",
          title: "acp 00c94d7f",
          model: "codex",
          profileName: null,
          messageCount: 4,
          toolCallCount: 2,
          cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
          startedAt: 2000,
          lastActiveAt: 2100,
          truth: "OBSERVED",
        },
        {
          id: "sess_labs",
          source: "telegram",
          title: "Khaw Tower Office Labs Native Projection",
          model: "gpt-5.5",
          profileName: "default",
          messageCount: 7,
          toolCallCount: 3,
          cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
          startedAt: 1000,
          lastActiveAt: 1100,
          truth: "OBSERVED",
        },
        {
          id: "sess_office",
          source: "cli",
          title: "Eugenia Release Readiness",
          model: "codex",
          profileName: "engineer",
          messageCount: 9,
          toolCallCount: 4,
          cwd: "/home/genie/workspace/genie-hv-eugenia",
          startedAt: 1200,
          lastActiveAt: 1300,
          truth: "OBSERVED",
        },
        {
          id: "sess_unknown",
          source: "slack",
          title: "Unclassified support thread",
          model: "unknown-model",
          profileName: null,
          messageCount: 1,
          toolCallCount: 0,
          cwd: null,
          startedAt: 1400,
          lastActiveAt: 1500,
          truth: "OBSERVED",
        },
        {
          id: "sess_open_design",
          source: "acp",
          title: "Open Design duplicate key review",
          model: "codex",
          profileName: null,
          messageCount: 5,
          toolCallCount: 2,
          cwd: "/home/genie/workspace/src/open-design",
          startedAt: 1600,
          lastActiveAt: 1700,
          truth: "OBSERVED",
        },
        {
          id: "sess_khaw_desktop",
          source: "telegram",
          title: "KHAW Desktop Project Resume",
          model: "gpt-5.5",
          profileName: null,
          messageCount: 8,
          toolCallCount: 1,
          cwd: null,
          startedAt: 1800,
          lastActiveAt: 1900,
          truth: "OBSERVED",
        },
      ],
      agents: [],
      runs: [],
      tasks: [],
      sources: [],
    });

    expect(tower.title).toBe("Khaw Tower");
    expect(tower.president).toMatchObject({
      label: "Tower President",
      personaLabel: "Drogo",
      truth: "OBSERVED",
    });
    expect(tower.lanes.map((lane) => [lane.id, lane.label])).toEqual([
      ["office", "Office"],
      ["labs-university", "Labs / University"],
      ["unknown", "Unknown / Ground"],
    ]);

    const labsFloor = tower.floors.find((floor) => floor.rooms.some((room) => room.id === "sess_labs"));
    expect(labsFloor).toMatchObject({
      laneId: "labs-university",
      placement: { source: "repo-rule", truth: "GAP" },
    });

    const officeFloor = tower.floors.find((floor) => floor.rooms.some((room) => room.id === "sess_office"));
    expect(officeFloor).toMatchObject({
      laneId: "office",
      placement: { source: "repo-rule", truth: "GAP" },
    });

    const openDesignFloor = tower.floors.find((floor) => floor.rooms.some((room) => room.id === "sess_open_design"));
    expect(openDesignFloor).toMatchObject({
      laneId: "labs-university",
      placement: { source: "repo-rule", truth: "GAP" },
    });

    const claw3dFloor = tower.floors.find((floor) => floor.label === "Claw3D");
    expect(claw3dFloor).toMatchObject({
      laneId: "labs-university",
      placement: { source: "repo-rule", truth: "GAP" },
    });
    expect(claw3dFloor?.rooms.map((room) => room.id)).toEqual([
      "sess_acp_generic_newer",
      "sess_acp_generic_older",
    ]);
    expect(tower.floors.find((floor) => floor.label.startsWith("Acp "))).toBeUndefined();

    const khawDesktopFloor = tower.floors.find((floor) => floor.rooms.some((room) => room.id === "sess_khaw_desktop"));
    expect(khawDesktopFloor).toMatchObject({
      laneId: "office",
      placement: { source: "session-inference", truth: "GAP" },
    });

    const unknownFloor = tower.floors.find((floor) => floor.rooms.some((room) => room.id === "sess_unknown"));
    expect(unknownFloor).toMatchObject({
      laneId: "unknown",
      placement: { source: "unknown", truth: "GAP" },
    });

    const labsRoom = labsFloor?.rooms[0];
    expect(labsRoom?.personas[0]).toMatchObject({
      label: "default",
      kind: "profile-persona",
      truth: "OBSERVED",
    });
    expect(labsRoom?.workers[0]).toMatchObject({
      label: "telegram session",
      execution: "gpt-5.5",
      truth: "OBSERVED",
    });
    expect(tower.floors.flatMap((floor) => floor.rooms.flatMap((room) => room.workers)).some((worker) => worker.label === "Tower President")).toBe(false);
  });
});
