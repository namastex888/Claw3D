import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HermesTowerPanel } from "@/features/office/components/HermesTowerPanel";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HermesTowerPanel Khaw Tower lobby", () => {
  it("renders Khaw Tower identity, Tower President, and lane elevator banks from snapshot projection", async () => {
    const snapshot: HermesSnapshot = {
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
      profiles: [],
      sessions: [
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
      ],
      agents: [],
      runs: [],
      tasks: [],
      sources: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => snapshot,
      }),
    );

    render(React.createElement(HermesTowerPanel));

    await waitFor(() => expect(screen.getByText("Khaw Tower")).toBeTruthy());
    expect(screen.getByText(/President: Tower President/)).toBeTruthy();
    expect(screen.getByText("Office")).toBeTruthy();
    expect(screen.getByText("Labs / University")).toBeTruthy();
    expect(screen.queryByText("Hermes Tower")).toBeNull();
  });
});
