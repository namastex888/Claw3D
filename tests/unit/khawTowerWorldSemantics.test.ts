import { describe, expect, it } from "vitest";

import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";
import { projectHermesSnapshotToTower } from "@/lib/world/hermesSnapshotProjection";
import { projectTowerToWorldSemantics } from "@/lib/world/khawTowerWorldSemantics";

const snapshot: HermesSnapshot = {
  at: 1_770_000_000_000,
  truth: "OBSERVED",
  server: {
    url: "http://localhost:9119",
    version: "0.15.1",
    gatewayRunning: true,
    activeSessions: 2,
    platforms: { telegram: { state: "connected" } },
  },
  wishes: [],
  profiles: [],
  sessions: [
    {
      id: "sess_claw3d",
      source: "telegram",
      title: "Khaw Tower Office Labs Native Projection",
      model: "gpt-5.5",
      profileName: "default",
      messageCount: 7,
      toolCallCount: 3,
      cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
      startedAt: 1000,
      lastActiveAt: 1_769_999_996,
      truth: "OBSERVED",
    },
    {
      id: "sess_eugenia",
      source: "cli",
      title: "Eugenia Release Readiness",
      model: "codex",
      profileName: "engineer",
      messageCount: 9,
      toolCallCount: 4,
      cwd: "/home/genie/workspace/genie-hv-eugenia",
      startedAt: 1200,
      lastActiveAt: 1_769_999_940,
      truth: "OBSERVED",
    },
  ],
  agents: [],
  runs: [],
  tasks: [],
  sources: [
    { endpoint: "/api/status", ok: true, status: 200, at: 1_770_000_000_000 },
    { endpoint: "/api/sessions", ok: true, status: 200, at: 1_770_000_000_000 },
  ],
};

describe("Khaw Tower world semantics projection", () => {
  it("projects floor signs, room badges, worker pods, and truth chips from the tower read model", () => {
    const tower = projectHermesSnapshotToTower(snapshot);
    const world = projectTowerToWorldSemantics(tower, { maxFloors: 2, maxRoomsPerFloor: 2 });

    expect(world.title).toBe("Khaw Tower world semantics");
    expect(world.floorSigns).toEqual([
      expect.objectContaining({
        kind: "floor-sign",
        label: "Eugenia Release Readiness",
        laneLabel: "Office",
        roomCount: 1,
        truth: "GAP",
        truthChip: expect.objectContaining({ label: "GAP", reason: expect.stringContaining("inferred") }),
      }),
      expect.objectContaining({
        kind: "floor-sign",
        label: "Khaw Tower Office Labs Native Projection",
        laneLabel: "Labs / University",
        roomCount: 1,
        truth: "GAP",
      }),
    ]);

    expect(world.roomBadges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "room-badge",
          label: "Eugenia Release Readiness",
          floorLabel: "Eugenia Release Readiness",
          source: "cli",
          model: "codex",
          persona: "engineer",
          truth: "OBSERVED",
          freshness: "60s ago",
        }),
      ]),
    );

    expect(world.workerPods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "worker-pod",
          label: "cli session",
          model: "codex",
          floorLabel: "Eugenia Release Readiness",
          roomLabel: "Eugenia Release Readiness",
          truth: "OBSERVED",
        }),
      ]),
    );

    expect(world.truthChips.map((chip) => chip.label)).toEqual(expect.arrayContaining(["GAP", "OBSERVED"]));
    expect(world.summary).toBe("2 floor signs · 2 room badges · 2 worker pods · 6 truth chips");
  });
});
