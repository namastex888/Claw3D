import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";
import type { RuntimeEvent, RuntimeProvider } from "@/lib/runtime/types";

const providerHandlers = vi.hoisted(() => ({
  runtimeEventHandlers: [] as Array<(event: RuntimeEvent) => void>,
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(),
  createRuntimeProvider: vi.fn(),
}));

vi.mock("@/lib/runtime/createRuntimeProvider", () => ({
  createRuntimeProvider: providerHandlers.createRuntimeProvider,
}));

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

afterEach(() => {
  vi.restoreAllMocks();
  providerHandlers.runtimeEventHandlers.length = 0;
  providerHandlers.connect.mockClear();
  providerHandlers.disconnect.mockClear();
  providerHandlers.createRuntimeProvider.mockReset();
});

describe("HermesTowerPanel provider path", () => {
  it("renders Khaw Tower from RuntimeProvider summary-refresh events, not direct component fetches", async () => {
    const directFetch = vi.fn(async () => {
      throw new Error("HermesTowerPanel must use the runtime provider path");
    });
    vi.stubGlobal("fetch", directFetch);

    providerHandlers.createRuntimeProvider.mockReturnValue({
      id: "hermes-native",
      label: "Khaw Tower Native",
      metadata: { id: "hermes-native", label: "Khaw Tower Native", runtimeName: "Hermes native snapshot" },
      capabilities: new Set(["sessions"]),
      client: null,
      connect: providerHandlers.connect.mockImplementation(async () => {
        for (const handler of providerHandlers.runtimeEventHandlers) {
          handler({
            type: "summary-refresh",
            at: snapshot.at,
            snapshot,
            frame: { type: "event", event: "hermes.snapshot.refreshed", payload: snapshot },
          });
        }
      }),
      disconnect: providerHandlers.disconnect,
      call: async <T = unknown>(_method: string, _params: unknown) => snapshot as T,
      onStatus: vi.fn(() => () => {}),
      onGap: vi.fn(() => () => {}),
      onEvent: vi.fn(() => () => {}),
      onRuntimeEvent: vi.fn((handler: (event: RuntimeEvent) => void) => {
        providerHandlers.runtimeEventHandlers.push(handler);
        return () => {
          const index = providerHandlers.runtimeEventHandlers.indexOf(handler);
          if (index >= 0) providerHandlers.runtimeEventHandlers.splice(index, 1);
        };
      }),
    } satisfies RuntimeProvider);

    const { HermesTowerPanel } = await import("@/features/office/components/HermesTowerPanel");

    render(React.createElement(HermesTowerPanel));

    await waitFor(() => expect(screen.getByText("Khaw Tower")).toBeTruthy());
    expect(providerHandlers.createRuntimeProvider).toHaveBeenCalledWith(
      "hermes-native",
      null,
      "/api/hermes/snapshot",
    );
    expect(providerHandlers.connect).toHaveBeenCalledWith({ gatewayUrl: "/api/hermes/snapshot" });
    expect(directFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/President: Tower President/)).toBeTruthy();
    expect(screen.getByText("Labs / University")).toBeTruthy();
  });
});
