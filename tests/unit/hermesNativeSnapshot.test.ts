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

describe("Hermes snapshot tower projection", () => {
  it("groups sessions into human-readable wish floors and labels inferred wish truth as GAP", () => {
    const tower = projectHermesSnapshotToTower({
      at: 123,
      truth: "OBSERVED",
      server: {
        url: "http://localhost:9119",
        version: "0.15.1",
        gatewayRunning: true,
        activeSessions: 1,
        platforms: { telegram: { state: "connected" } },
      },
      wishes: [],
      profiles: [{ id: "default", name: "default", model: "gpt-5.5", provider: "openai-codex", truth: "OBSERVED" }],
      sessions: [
        {
          id: "sess_1",
          source: "telegram",
          title: "Build Hermes native Claw3D",
          model: "gpt-5.5",
          profileName: "default",
          messageCount: 7,
          toolCallCount: 3,
          cwd: "/workspace/Claw3D",
          startedAt: 1000,
          lastActiveAt: 1100,
          truth: "OBSERVED",
        },
      ],
      agents: [],
      runs: [],
      tasks: [],
      sources: [],
    });

    expect(tower.title).toBe("Hermes Tower");
    expect(tower.floors).toHaveLength(1);
    expect(tower.floors[0]).toMatchObject({
      id: "wish:build-hermes-native-claw3d",
      label: "Build Hermes Native Claw3D",
      truth: "GAP",
      association: "inferred",
    });
    expect(tower.floors[0].rooms[0]).toMatchObject({
      id: "sess_1",
      label: "Build Hermes native Claw3D",
      source: "telegram",
      truth: "OBSERVED",
    });
    expect(tower.floors[0].rooms[0].workers[0]).toMatchObject({
      label: "default",
      role: "gpt-5.5",
      truth: "OBSERVED",
    });
  });
});
