"use client";

import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";

import { createRuntimeProvider } from "@/lib/runtime/createRuntimeProvider";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";
import { projectHermesSnapshotToTower } from "@/lib/world/hermesSnapshotProjection";
import {
  projectTowerToWorldSemantics,
  type KhawTowerWorldSemantics,
  type KhawWorldFloorSign,
  type KhawWorldRoomBadge,
  type KhawWorldWorkerPod,
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

const truthMaterialColor = (truth: string): string =>
  truth === "OBSERVED" ? "#10b981" : truth === "VERIFIED" ? "#22d3ee" : truth === "SIMULATED" ? "#8b5cf6" : "#f59e0b";

const htmlPosition = (position: { x: number; y: number; z: number }): [number, number, number] => [
  position.x,
  position.y,
  position.z,
];

const chip = (truth: string, reason: string) => (
  <span
    className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${truthChipClass(truth)}`}
    title={reason}
    data-khaw-world-truth-chip={truth}
  >
    {truth}
  </span>
);

function FloorSignObject({ sign }: { sign: KhawWorldFloorSign }) {
  return (
    <group position={htmlPosition(sign.position)} data-khaw-spatial-object="floor-sign">
      <mesh position={[0, -0.12, -0.04]}>
        <boxGeometry args={[2.45, 0.92, 0.08]} />
        <meshStandardMaterial color="#0f172a" emissive="#083344" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[1.04, 0.22, 0.02]}>
        <boxGeometry args={[0.26, 0.18, 0.1]} />
        <meshStandardMaterial color={truthMaterialColor(sign.truth)} emissive={truthMaterialColor(sign.truth)} emissiveIntensity={0.35} />
      </mesh>
      <Html transform center distanceFactor={5.5} position={[0, 0, 0.08]}>
        <div
          className="w-[170px] rounded-xl border border-cyan-200/25 bg-slate-950/88 p-2 font-mono text-white shadow-2xl backdrop-blur-sm"
          data-khaw-floor-sign={sign.label}
          data-khaw-world-diegetic="floor-sign"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/60">Floor sign</div>
            {chip(sign.truth, sign.truthChip.reason)}
          </div>
          <div className="mt-1 truncate text-[12px] font-semibold text-white">{sign.label}</div>
          <div className="mt-1 truncate text-[10px] text-white/58">
            {sign.laneLabel} · {sign.roomCount} room{sign.roomCount === 1 ? "" : "s"}
          </div>
          <div className="mt-1 truncate text-[9px] text-white/42">{sign.reason}</div>
        </div>
      </Html>
    </group>
  );
}

function RoomBadgeObject({ badge }: { badge: KhawWorldRoomBadge }) {
  return (
    <group position={htmlPosition(badge.position)} data-khaw-spatial-object="room-badge">
      <mesh position={[0, -0.08, -0.03]}>
        <boxGeometry args={[2.25, 0.72, 0.06]} />
        <meshStandardMaterial color="#1f1028" emissive="#4a044e" emissiveIntensity={0.14} />
      </mesh>
      <Html transform center distanceFactor={5.5} position={[0, 0, 0.08]}>
        <div
          className="w-[155px] rounded-lg border border-fuchsia-200/20 bg-black/82 p-2 font-mono text-white shadow-xl backdrop-blur-sm"
          data-khaw-room-badge={badge.label}
          data-khaw-world-diegetic="room-badge"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-fuchsia-100/62">Room badge</div>
            {chip(badge.truth, badge.truthChip.reason)}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-white/90">{badge.label}</div>
          <div className="mt-1 truncate text-[9px] text-white/55">
            {badge.persona} · {badge.source ?? "unknown source"} · {badge.freshness}
          </div>
          <div className="mt-1 truncate text-[9px] text-white/40">model: {badge.model ?? "unknown"}</div>
        </div>
      </Html>
    </group>
  );
}

function WorkerPodObject({ pod }: { pod: KhawWorldWorkerPod }) {
  return (
    <group position={htmlPosition(pod.position)} data-khaw-spatial-object="worker-pod">
      <mesh position={[-0.82, 0, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color={truthMaterialColor(pod.truth)} emissive={truthMaterialColor(pod.truth)} emissiveIntensity={0.28} />
      </mesh>
      <Html transform center distanceFactor={5.5} position={[0, 0, 0.08]}>
        <div
          className="w-[145px] rounded-full border border-emerald-200/20 bg-emerald-950/78 px-3 py-2 font-mono text-white shadow-xl backdrop-blur-sm"
          data-khaw-worker-pod={pod.label}
          data-khaw-world-diegetic="worker-pod"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[10px] font-semibold text-emerald-50">{pod.label}</div>
            {chip(pod.truth, pod.truthChip.reason)}
          </div>
          <div className="mt-0.5 truncate text-[9px] text-emerald-50/58">worker pod · {pod.model ?? "unknown model"}</div>
        </div>
      </Html>
    </group>
  );
}

function WorldSemanticsObjects({ world }: { world: KhawTowerWorldSemantics }) {
  const floorSigns = world.floorSigns.slice(0, 3);
  const roomBadges = world.roomBadges.slice(0, 3);
  const workerPods = world.workerPods.slice(0, 3);

  return (
    <group
      aria-label="Khaw Tower diegetic world semantic signs"
    >
      <Html transform center distanceFactor={6} position={[0, 3.85, -4.8]}>
        <div
          className="w-[285px] rounded-xl border border-cyan-300/25 bg-black/72 px-3 py-2 font-mono text-white shadow-xl backdrop-blur-sm"
          data-testid="khaw-world-semantics-layer"
          data-khaw-world-semantics="diegetic"
          data-khaw-world-diegetic="summary"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/75">World semantics</div>
          <div className="mt-1 text-[11px] text-white/72">{world.summary}</div>
        </div>
      </Html>
      {floorSigns.map((sign) => <FloorSignObject key={sign.id} sign={sign} />)}
      {roomBadges.map((badge) => <RoomBadgeObject key={badge.id} badge={badge} />)}
      {workerPods.map((pod) => <WorkerPodObject key={pod.id} pod={pod} />)}
    </group>
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

    void (async () => {
      try {
        await provider.connect({ gatewayUrl: "/api/hermes/snapshot" });
        const snapshot = await provider.call<HermesSnapshot>("hermes.snapshot", {});
        if (!cancelled) setState({ status: "ready", snapshot, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          snapshot: null,
          error: error instanceof Error ? error.message : "Hermes world semantics snapshot failed.",
        });
      }
    })();

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

  if (world) return <WorldSemanticsObjects world={world} />;

  if (state.status === "error") {
    return (
      <Html transform center distanceFactor={10} position={[0, 3.85, -4.8]}>
        <div className="rounded-xl border border-amber-300/30 bg-black/75 px-3 py-2 font-mono text-[11px] text-amber-100 shadow-xl backdrop-blur-sm">
          World semantics GAP: {state.error}
        </div>
      </Html>
    );
  }

  return (
    <Html transform center distanceFactor={10} position={[0, 3.85, -4.8]}>
      <div className="rounded-xl border border-white/15 bg-black/65 px-3 py-2 font-mono text-[11px] text-white/60 shadow-xl backdrop-blur-sm">
        Loading Khaw Tower world semantics…
      </div>
    </Html>
  );
}
