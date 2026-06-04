import { describe, expect, it } from "vitest";

import {
  isHermesOrchestratorAgent,
  resolveRuntimeProjection,
} from "@/lib/world/runtimeProjection";
import { DROGO_SERVER_GOD_AVATAR_PROFILE } from "@/lib/avatars/presets";

describe("runtime projection", () => {
  it("projects the Hermes orchestrator as Drogo server-god without changing runtime id", () => {
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
    expect(projection.name).toBe("Drogo");
    expect(projection.subtitle).toBe("Server God / Orchestrator");
    expect(projection.avatarProfile).toBe(DROGO_SERVER_GOD_AVATAR_PROFILE);
    expect(projection.projection).toMatchObject({
      kind: "server-god",
      runtimeAgentId: "hermes",
      runtimeName: "Hermes",
      displayName: "Drogo",
      roleLabel: "Server God / Orchestrator",
      sourceLabel: "Hermes runtime",
      truth: "OBSERVED",
      omnipresent: true,
      controlSurface: "skyview",
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
