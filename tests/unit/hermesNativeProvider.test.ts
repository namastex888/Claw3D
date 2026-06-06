import { describe, expect, it, vi } from "vitest";

import { createRuntimeProvider } from "@/lib/runtime/createRuntimeProvider";
import { HermesNativeProvider } from "@/lib/runtime/hermes-native/provider";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";

const makeSnapshot = (params: {
  at: number;
  sessions?: Array<Partial<HermesSnapshot["sessions"][number]> & { id: string }>;
}): HermesSnapshot => ({
  at: params.at,
  truth: "OBSERVED",
  server: {
    url: "http://127.0.0.1:9119",
    version: "0.15.1",
    gatewayRunning: true,
    activeSessions: params.sessions?.length ?? 0,
    platforms: { telegram: { state: "connected" } },
  },
  wishes: [],
  profiles: [{ id: "default", name: "default", model: "gpt-5.5", provider: "openai-codex", truth: "OBSERVED" }],
  sessions: (params.sessions ?? []).map((session) => ({
    source: "telegram",
    title: session.title ?? `Session ${session.id}`,
    model: "gpt-5.5",
    profileName: "default",
    messageCount: 1,
    toolCallCount: 0,
    cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
    startedAt: params.at - 100,
    lastActiveAt: params.at,
    truth: "OBSERVED",
    ...session,
  })),
  agents: [],
  runs: [],
  tasks: [],
  sources: [{ endpoint: "/api/status", status: 200, ok: true, at: params.at }],
});

const responseFor = (snapshot: HermesSnapshot) =>
  ({
    ok: true,
    status: 200,
    json: async () => snapshot,
  }) as Response;

describe("HermesNativeProvider", () => {
  it("connects by polling same-origin /api/hermes/snapshot and returns the latest snapshot", async () => {
    const firstSnapshot = makeSnapshot({ at: 1000, sessions: [{ id: "sess_1" }] });
    const fetchImpl = vi.fn(async () => responseFor(firstSnapshot));
    const provider = new HermesNativeProvider({
      fetchImpl,
      pollIntervalMs: 10_000,
      snapshotUrl: "/api/hermes/snapshot",
    });
    const statuses: string[] = [];
    const runtimeEvents: string[] = [];

    provider.onStatus((status) => statuses.push(status));
    provider.onRuntimeEvent((event) => runtimeEvents.push(event.type));

    await provider.connect({ gatewayUrl: "ws://localhost:18789" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/hermes/snapshot",
      expect.objectContaining({ cache: "no-store", headers: { Accept: "application/json" } }),
    );
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining("9119"), expect.anything());
    await expect(provider.call("hermes.snapshot", {})).resolves.toEqual(firstSnapshot);
    expect(statuses).toEqual(["disconnected", "connecting", "connected"]);
    expect(runtimeEvents).toContain("summary-refresh");

    provider.disconnect();
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("adapts snapshot profiles and sessions to legacy read-only runtime calls for the office shell", async () => {
    const snapshot = makeSnapshot({ at: 1000, sessions: [{ id: "sess_1", title: "Native Provider Work" }] });
    const fetchImpl = vi.fn(async () => responseFor(snapshot));
    const provider = new HermesNativeProvider({ fetchImpl, snapshotUrl: "/api/hermes/snapshot" });

    await provider.connect({ gatewayUrl: "ignored-by-native-provider" });

    await expect(provider.call("agents.list", {})).resolves.toMatchObject({
      defaultId: "default",
      mainKey: "main",
      agents: [{ id: "default", name: "default" }],
    });
    await expect(provider.call("sessions.list", {})).resolves.toMatchObject({
      sessions: [{ key: "sess_1", displayName: "Native Provider Work" }],
    });
    await expect(provider.call("config.get", {})).resolves.toMatchObject({
      config: { agents: { list: [{ id: "default" }] } },
    });
    provider.disconnect();
  });

  it("emits synthetic session lifecycle events from snapshot diffs", async () => {
    const snapshots = [
      makeSnapshot({ at: 1000, sessions: [{ id: "sess_a", title: "A" }] }),
      makeSnapshot({ at: 2000, sessions: [{ id: "sess_a", title: "A updated" }, { id: "sess_b", title: "B" }] }),
      makeSnapshot({ at: 3000, sessions: [{ id: "sess_b", title: "B" }] }),
    ];
    const fetchImpl = vi.fn(async () => responseFor(snapshots.shift() ?? makeSnapshot({ at: 4000 })));
    const provider = new HermesNativeProvider({ fetchImpl, snapshotUrl: "/api/hermes/snapshot" });
    const events: string[] = [];

    provider.onRuntimeEvent((event) => events.push(event.type));

    await provider.connect({ gatewayUrl: "ignored-by-native-provider" });
    await provider.refresh();
    await provider.refresh();

    expect(events).toEqual(expect.arrayContaining([
      "summary-refresh",
      "session.started",
      "session.updated",
      "session.ended",
    ]));
    provider.disconnect();
  });
});

describe("createRuntimeProvider Hermes native selection", () => {
  it("routes the Hermes adapter to the Hermes native provider instead of the OpenClaw gateway wrapper", () => {
    const fakeGatewayClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      call: vi.fn(),
      onStatus: vi.fn(),
      onGap: vi.fn(),
      onEvent: vi.fn(),
    };

    const provider = createRuntimeProvider("hermes", fakeGatewayClient as never, "ws://localhost:18789");

    expect(provider.id).toBe("hermes-native");
    expect(provider.label).toBe("Khaw Tower Native");
    expect(provider.client).toBeNull();
    expect(provider.capabilities.has("sessions")).toBe(true);
  });
});
