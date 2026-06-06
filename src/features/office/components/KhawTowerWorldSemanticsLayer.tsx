"use client";

import { useEffect, useMemo, useState } from "react";

import { createRuntimeProvider } from "@/lib/runtime/createRuntimeProvider";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";
import { projectHermesSnapshotToTower } from "@/lib/world/hermesSnapshotProjection";
import {
  projectTowerToWorldSemantics,
  type KhawTowerWorldSemantics,
} from "@/lib/world/khawTowerWorldSemantics";

type SnapshotState =
  | { status: "loading"; snapshot: null; error: null }
  | { status: "ready"; snapshot: HermesSnapshot; error: null }
  | { status: "error"; snapshot: null; error: string };

const truthChipClass = (truth: string): string => {
  if (truth === "OBSERVED") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (truth === "VERIFIED") return "border-cyan-300/45 bg-cyan-500/15 text-cyan-100";
  if (truth === "SIMULATED") return "border-violet-300/45 bg-violet-500/15 text-violet-100";
  return "border-amber-300/45 bg-amber-500/15 text-amber-100";
};

const renderTruthChip = (truth: string, reason: string) => (
  <span
    className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${truthChipClass(truth)}`}
    title={reason}
    data-khaw-world-truth-chip={truth}
  >
    {truth}
  </span>
);

function WorldSemanticsView({ world }: { world: KhawTowerWorldSemantics }) {
  const floorSigns = world.floorSigns.slice(0, 3);
  const roomBadges = world.roomBadges.slice(0, 3);
  const workerPods = world.workerPods.slice(0, 3);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 font-mono text-white"
      aria-label="Khaw Tower world semantic signs"
      data-testid="khaw-world-semantics-layer"
      data-khaw-world-semantics="active"
    >
      <div className="absolute left-[272px] right-[400px] top-3 rounded-xl border border-cyan-300/25 bg-black/68 px-3 py-2 shadow-xl backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/75">World semantics</div>
        <div className="mt-1 text-[11px] text-white/72">{world.summary}</div>
      </div>

      <div className="absolute bottom-24 left-[272px] right-[400px] top-[96px] grid grid-rows-[auto_auto_auto] gap-2 overflow-hidden">
        <div className="grid grid-cols-3 gap-2">
          {floorSigns.map((sign) => (
            <div
              key={sign.id}
              className="min-w-0 rounded-xl border border-cyan-200/25 bg-slate-950/80 p-2 shadow-2xl backdrop-blur-sm"
              data-khaw-floor-sign={sign.label}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/60">Floor sign</div>
                {renderTruthChip(sign.truth, sign.truthChip.reason)}
              </div>
              <div className="mt-1 truncate text-[12px] font-semibold text-white">{sign.label}</div>
              <div className="mt-1 truncate text-[10px] text-white/58">
                {sign.laneLabel} · {sign.roomCount} room{sign.roomCount === 1 ? "" : "s"}
              </div>
              <div className="mt-1 truncate text-[9px] text-white/42">{sign.reason}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {roomBadges.map((badge) => (
            <div
              key={badge.id}
              className="min-w-0 rounded-lg border border-fuchsia-200/20 bg-black/74 p-2 shadow-xl backdrop-blur-sm"
              data-khaw-room-badge={badge.label}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[9px] uppercase tracking-[0.18em] text-fuchsia-100/62">Room badge</div>
                {renderTruthChip(badge.truth, badge.truthChip.reason)}
              </div>
              <div className="mt-1 truncate text-[11px] font-semibold text-white/90">{badge.label}</div>
              <div className="mt-1 truncate text-[9px] text-white/55">
                {badge.persona} · {badge.source ?? "unknown source"} · {badge.freshness}
              </div>
              <div className="mt-1 truncate text-[9px] text-white/40">model: {badge.model ?? "unknown"}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {workerPods.map((pod) => (
            <div
              key={pod.id}
              className="min-w-0 rounded-full border border-emerald-200/20 bg-emerald-950/68 px-3 py-2 shadow-xl backdrop-blur-sm"
              data-khaw-worker-pod={pod.label}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[10px] font-semibold text-emerald-50">{pod.label}</div>
                {renderTruthChip(pod.truth, pod.truthChip.reason)}
              </div>
              <div className="mt-0.5 truncate text-[9px] text-emerald-50/58">worker pod · {pod.model ?? "unknown model"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KhawTowerWorldSemanticsLayer() {
  const [state, setState] = useState<SnapshotState>({
    status: "loading",
    snapshot: null,
    error: null,
  });

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
        error: error instanceof Error ? error.message : "Hermes world semantics snapshot failed.",
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      provider.disconnect();
    };
  }, [provider]);

  const world = useMemo(() => {
    if (!state.snapshot) return null;
    return projectTowerToWorldSemantics(projectHermesSnapshotToTower(state.snapshot), {
      maxFloors: 4,
      maxRoomsPerFloor: 1,
      maxWorkersPerRoom: 1,
    });
  }, [state.snapshot]);

  if (world) return <WorldSemanticsView world={world} />;

  if (state.status === "error") {
    return (
      <div className="pointer-events-none absolute left-[272px] top-3 z-30 rounded-xl border border-amber-300/30 bg-black/70 px-3 py-2 font-mono text-[11px] text-amber-100 shadow-xl backdrop-blur-sm">
        World semantics GAP: {state.error}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-[272px] top-3 z-30 rounded-xl border border-white/15 bg-black/60 px-3 py-2 font-mono text-[11px] text-white/60 shadow-xl backdrop-blur-sm">
      Loading Khaw Tower world semantics…
    </div>
  );
}
