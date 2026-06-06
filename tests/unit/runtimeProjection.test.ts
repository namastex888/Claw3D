import { describe, expect, it } from "vitest";

import {
  isHermesOrchestratorAgent,
  resolveRuntimeProjection,
} from "@/lib/world/runtimeProjection";
import { TOWER_PRESIDENT_AVATAR_PROFILE } from "@/lib/avatars/presets";

describe("runtime projection", () => {
  it("projects the Hermes orchestrator as the Tower President without changing runtime id", () => {
    const projection = resolveRuntimeProjection(
      {
        agentId: "hermes",
        name: "Hermes",
        runtimeName: "Hermes",
        role: "Orchestrator",
      },
      { activeAdapterType: "hermes" },
    );

    expect(projection.id).toBe("hermes");
    expect(projection.name).toBe("Tower President");
    expect(projection.subtitle).toBe("Tower President / Executive Operator");
    expect(projection.avatarProfile).toBe(TOWER_PRESIDENT_AVATAR_PROFILE);
    expect(projection.projection).toMatchObject({
      kind: "tower-president",
      runtimeAgentId: "hermes",
      runtimeName: "Hermes",
      displayName: "Tower President",
      roleLabel: "Tower President / Executive Operator",
      sourceLabel: "Hermes runtime",
      truth: "OBSERVED",
      omnipresent: true,
      controlSurface: "executive",
    });
  });

  it("detects a Hermes orchestrator even when the runtime id is adapter-specific", () => {
    expect(
      isHermesOrchestratorAgent(
        {
          agentId: "main",
          name: "Hermes",
          runtimeName: "Hermes",
          role: "Orchestrator",
        },
        { activeAdapterType: "hermes" },
      ),
    ).toBe(true);
  });

  it("keeps normal runtime agents as room-scoped projections", () => {
    const projection = resolveRuntimeProjection(
      {
        agentId: "qa-wolf",
        name: "QA Wolf",
        role: "Regression tester",
      },
      { activeAdapterType: "hermes" },
    );

    expect(projection.id).toBe("qa-wolf");
    expect(projection.name).toBe("QA Wolf");
    expect(projection.avatarProfile).toBeNull();
    expect(projection.projection).toMatchObject({
      kind: "runtime-agent",
      runtimeAgentId: "qa-wolf",
      displayName: "QA Wolf",
      roleLabel: "Regression tester",
      sourceLabel: "runtime",
      truth: "OBSERVED",
      omnipresent: false,
      controlSurface: "room",
    });
  });
});
