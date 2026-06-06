import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HermesTowerPanel } from "@/features/office/components/HermesTowerPanel";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HermesTowerPanel Khaw Tower lobby", () => {
  const buildSnapshot = (): HermesSnapshot => ({
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
        id: "sess_labs",
        source: "telegram",
        title: "Khaw Tower Office Labs Native Projection",
        model: "gpt-5.5",
        profileName: "default",
        messageCount: 7,
        toolCallCount: 3,
        cwd: "/home/genie/workspace/agents/university/experiments/Claw3D",
        startedAt: 1000,
        lastActiveAt: 1_769_999_996_000,
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
        lastActiveAt: 1_769_999_940,
        truth: "OBSERVED",
      },
    ],
    agents: [],
    runs: [],
    tasks: [],
    sources: [
      { endpoint: "/api/status", ok: true, status: 200, at: 1_770_000_000_000 },
      { endpoint: "/api/sessions", ok: false, status: 504, at: 1_770_000_000_000, error: "timeout" },
    ],
  });

  const renderWithSnapshot = async (snapshot: HermesSnapshot = buildSnapshot()) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => snapshot,
      }),
    );

    render(React.createElement(HermesTowerPanel));
    await waitFor(() => expect(screen.getByText("Khaw Tower")).toBeTruthy());
  };

  it("renders Khaw Tower identity, Tower President, and lane elevator banks from snapshot projection", async () => {
    await renderWithSnapshot();

    expect(screen.getByText(/President: Tower President/)).toBeTruthy();
    expect(screen.getByText("Office")).toBeTruthy();
    expect(screen.getByText("Labs / University")).toBeTruthy();
    expect(screen.queryByText("Hermes Tower")).toBeNull();
  });

  it("renders a floor selector and inspector with provenance, health, freshness, and room identity", async () => {
    await renderWithSnapshot();

    const labsButton = screen.getByRole("button", { name: /Inspect floor Khaw Tower Office Labs Native Projection/i });
    const officeButton = screen.getByRole("button", { name: /Inspect floor Eugenia Release Readiness/i });
    expect(labsButton).toBeTruthy();
    expect(officeButton).toBeTruthy();

    fireEvent.click(officeButton);

    const inspector = screen.getByRole("region", { name: "Floor inspector" });
    expect(within(inspector).getByText("Eugenia Release Readiness")).toBeTruthy();
    expect(within(inspector).getByText("who is working here, on what, and is it healthy?")).toBeTruthy();
    expect(within(inspector).getByText("why: title from session title · placement by repo rule")).toBeTruthy();
    expect(within(inspector).getByText("truth: GAP because floor grouping is inferred until Hermes provides first-class Wish IDs")).toBeTruthy();
    expect(within(inspector).getByText("persona: engineer")).toBeTruthy();
    expect(within(inspector).getByText("model: codex")).toBeTruthy();
    expect(within(inspector).getByText("source: cli")).toBeTruthy();
    expect(within(inspector).getByText("cwd: /home/genie/workspace/genie-hv-eugenia")).toBeTruthy();
    expect(within(inspector).getByText("activity: 60s ago · 9 messages · 4 tool calls")).toBeTruthy();
    expect(within(inspector).getByText("/api/status: 200 OBSERVED")).toBeTruthy();
    expect(within(inspector).getByText("/api/sessions: 504 GAP timeout")).toBeTruthy();
  });
});
