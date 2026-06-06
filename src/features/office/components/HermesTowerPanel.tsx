"use client";

import { useEffect, useMemo, useState } from "react";
import { createRuntimeProvider } from "@/lib/runtime/createRuntimeProvider";
import type { HermesSnapshot, HermesSourceProbe } from "@/lib/runtime/hermes-native/types";
import {
  projectHermesSnapshotToTower,
  type HermesTowerFloor,
  type HermesTowerRoom,
} from "@/lib/world/hermesSnapshotProjection";

type SnapshotState =
  | { status: "loading"; snapshot: null; error: null }
  | { status: "ready"; snapshot: HermesSnapshot; error: null }
  | { status: "error"; snapshot: null; error: string };

const formatGateway = (value: boolean | null) => {
  if (value === true) return "running";
  if (value === false) return "stopped";
  return "unknown";
};

const formatSourceProbe = (probe: HermesSourceProbe): string => {
  const truth = probe.ok ? "OBSERVED" : "GAP";
  const error = probe.error ? ` ${probe.error}` : "";
  return `${probe.endpoint}: ${probe.status} ${truth}${error}`;
};

const normalizeEpochMs = (value: number): number => (value < 10_000_000_000 ? value * 1000 : value);

const formatFreshness = (snapshotAt: number, room: HermesTowerRoom): string => {
  if (!room.lastActiveAt) return "unknown freshness";
  const diffMs = Math.max(0, normalizeEpochMs(snapshotAt) - normalizeEpochMs(room.lastActiveAt));
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const floorSummary = (floor: HermesTowerFloor): string =>
  `${floor.rooms.length} room${floor.rooms.length === 1 ? "" : "s"} · ${floor.placement.laneLabel} · ${floor.truth}`;

export function HermesTowerPanel() {
  const [state, setState] = useState<SnapshotState>({
    status: "loading",
    snapshot: null,
    error: null,
  });
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  const provider = useMemo(
    () => createRuntimeProvider("hermes-native", null, "/api/hermes/snapshot"),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = provider.onRuntimeEvent((event) => {
      if (event.type !== "summary-refresh") return;
      const snapshot = event.snapshot ?? (event.frame.payload as HermesSnapshot | undefined);
      if (!snapshot || cancelled) return;
      setState({ status: "ready", snapshot, error: null });
    });

    void provider.connect({ gatewayUrl: "/api/hermes/snapshot" }).catch((error) => {
      if (cancelled) return;
      setState({
        status: "error",
        snapshot: null,
        error: error instanceof Error ? error.message : "Hermes snapshot failed.",
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      provider.disconnect();
    };
  }, [provider]);

  const tower = useMemo(
    () => (state.snapshot ? projectHermesSnapshotToTower(state.snapshot) : null),
    [state.snapshot],
  );
  const selectedFloor = useMemo(() => {
    if (!tower?.floors.length) return null;
    return tower.floors.find((floor) => floor.id === selectedFloorId) ?? tower.floors[0];
  }, [selectedFloorId, tower]);

  useEffect(() => {
    if (!tower?.floors.length) {
      setSelectedFloorId(null);
      return;
    }
    if (!selectedFloorId || !tower.floors.some((floor) => floor.id === selectedFloorId)) {
      setSelectedFloorId(tower.floors[0].id);
    }
  }, [selectedFloorId, tower]);

  return (
    <aside
      className="pointer-events-auto fixed right-3 top-3 z-[70] w-[380px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/20 bg-black/82 font-mono text-white shadow-2xl backdrop-blur"
      aria-label="Khaw Tower native state"
      data-testid="hermes-tower-panel"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              Native Hermes protocol
            </div>
            <h2 className="mt-1 text-sm font-semibold tracking-[0.18em] text-white">
              {tower?.title ?? "Khaw Tower"}
            </h2>
          </div>
          <span
            className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
              tower?.truth === "OBSERVED"
                ? "border-emerald-300/40 text-emerald-100"
                : "border-amber-300/40 text-amber-100"
            }`}
          >
            {tower?.truth ?? (state.status === "error" ? "GAP" : "loading")}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-white/55">
          source: same-origin /api/hermes/snapshot
        </div>
        {tower ? (
          <div className="mt-1 text-[11px] text-white/55">
            President: {tower.president.label} · {tower.president.personaLabel}
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="px-4 py-4 text-xs text-white/60">Reading Khaw Tower snapshot…</div>
      ) : null}

      {state.status === "error" ? (
        <div className="px-4 py-4 text-xs text-amber-100">
          <div className="mb-1 uppercase tracking-[0.18em] text-amber-200/70">GAP</div>
          {state.error}
        </div>
      ) : null}

      {tower ? (
        <div className="max-h-[52vh] overflow-auto px-4 py-3 text-xs">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Lobby</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/70">
              <div>version: {tower.lobby.version ?? "unknown"}</div>
              <div>gateway: {formatGateway(tower.lobby.gatewayRunning)}</div>
              <div>sessions: {tower.lobby.activeSessions ?? "unknown"}</div>
              <div>platforms: {tower.lobby.platformCount}</div>
            </div>
          </section>

          <section className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Elevator banks
            </div>
            <div className="mt-2 grid gap-2">
              {tower.lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="rounded border border-white/8 bg-black/25 px-2 py-1"
                  data-khaw-lane={lane.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white/80">{lane.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                      {lane.floorCount} floor{lane.floorCount === 1 ? "" : "s"} · {lane.truth}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-white/40">{lane.description}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Floor selector: {tower.floors.length || "none"}
            </div>
            {tower.floors.length === 0 ? (
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-amber-100/80">
                No session rooms visible yet. If `/api/sessions` is unavailable this is a source GAP, not proof that no one is working.
              </div>
            ) : null}
            <div className="grid gap-2" role="listbox" aria-label="Khaw Tower floor selector">
              {tower.floors.slice(0, 12).map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  aria-label={`Inspect floor ${floor.label}`}
                  aria-pressed={selectedFloor?.id === floor.id}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedFloor?.id === floor.id
                      ? "border-amber-200/50 bg-amber-300/[0.10]"
                      : "border-white/10 bg-white/[0.035] hover:border-white/25"
                  }`}
                  data-hermes-floor={floor.id}
                  onClick={() => setSelectedFloorId(floor.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold text-white">{floor.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-amber-100/70">
                      {floor.placement.laneLabel} · {floor.placement.source} · {floor.truth}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">{floorSummary(floor)}</div>
                </button>
              ))}
            </div>
          </section>

          {selectedFloor ? (
            <section
              className="mt-3 rounded-lg border border-amber-200/20 bg-amber-200/[0.055] p-3"
              role="region"
              aria-label="Floor inspector"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100/65">
                Floor inspector
              </div>
              <h3 className="mt-1 truncate text-[13px] font-semibold text-white">{selectedFloor.label}</h3>
              <div className="mt-1 text-[11px] text-white/60">
                who is working here, on what, and is it healthy?
              </div>

              <div className="mt-3 space-y-1 rounded border border-white/10 bg-black/25 p-2 text-[10px] text-white/62">
                <div>{`lane: ${selectedFloor.placement.laneLabel}`}</div>
                <div>{`why: title from ${selectedFloor.provenance.nameSource.replace(/-/g, " ")} · placement by ${selectedFloor.provenance.placementReason}`}</div>
                <div>{`truth: ${selectedFloor.truth} because ${selectedFloor.provenance.truthReason}`}</div>
                {selectedFloor.provenance.nameEvidence ? (
                  <div className="truncate">{`name evidence: ${selectedFloor.provenance.nameEvidence}`}</div>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {selectedFloor.rooms.slice(0, 5).map((room) => (
                  <article key={room.id} className="rounded border border-white/10 bg-black/25 p-2">
                    <div className="truncate text-[11px] font-semibold text-white/85">Room: {room.label}</div>
                    <div className="mt-1 grid gap-1 text-[10px] text-white/55">
                      <div>{`persona: ${room.personas[0]?.label ?? "unknown"}`}</div>
                      <div>{`worker: ${room.workers[0]?.label ?? "unknown"}`}</div>
                      <div>{`model: ${room.model ?? "unknown"}`}</div>
                      <div>{`source: ${room.source ?? "unknown"}`}</div>
                      <div className="truncate">{`cwd: ${room.cwd ?? "unknown"}`}</div>
                      <div>{`activity: ${formatFreshness(state.snapshot?.at ?? 0, room)} · ${room.messageCount ?? "unknown"} messages · ${room.toolCallCount ?? "unknown"} tool calls`}</div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-3 rounded border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Source endpoint health</div>
                <div className="mt-2 space-y-1 text-[10px] text-white/60">
                  {(state.snapshot?.sources ?? []).length ? (
                    (state.snapshot?.sources ?? []).map((probe) => (
                      <div key={`${probe.endpoint}:${probe.status}`}>{formatSourceProbe(probe)}</div>
                    ))
                  ) : (
                    <div>No source probes reported.</div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
