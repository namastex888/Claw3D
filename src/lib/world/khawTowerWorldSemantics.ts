import type { HermesTruthLabel } from "@/lib/runtime/hermes-native/types";
import type {
  HermesTowerFloor,
  HermesTowerProjection,
  HermesTowerRoom,
} from "@/lib/world/hermesSnapshotProjection";

export type KhawWorldSemanticKind =
  | "floor-sign"
  | "room-badge"
  | "worker-pod"
  | "truth-chip";

export type KhawWorldSemanticPosition = {
  x: number;
  y: number;
  z: number;
};

export type KhawWorldTruthChip = {
  id: string;
  kind: "truth-chip";
  label: HermesTruthLabel;
  reason: string;
  ownerKind: Exclude<KhawWorldSemanticKind, "truth-chip">;
  ownerId: string;
  position: KhawWorldSemanticPosition;
};

export type KhawWorldFloorSign = {
  id: string;
  kind: "floor-sign";
  label: string;
  laneLabel: string;
  roomCount: number;
  truth: HermesTruthLabel;
  association: HermesTowerFloor["association"];
  reason: string;
  truthChip: KhawWorldTruthChip;
  position: KhawWorldSemanticPosition;
};

export type KhawWorldRoomBadge = {
  id: string;
  kind: "room-badge";
  label: string;
  floorLabel: string;
  source: string | null;
  model: string | null;
  persona: string;
  truth: HermesTruthLabel;
  freshness: string;
  reason: string;
  truthChip: KhawWorldTruthChip;
  position: KhawWorldSemanticPosition;
};

export type KhawWorldWorkerPod = {
  id: string;
  kind: "worker-pod";
  label: string;
  model: string | null;
  floorLabel: string;
  roomLabel: string;
  truth: HermesTruthLabel;
  reason: string;
  truthChip: KhawWorldTruthChip;
  position: KhawWorldSemanticPosition;
};

export type KhawTowerWorldSemantics = {
  title: "Khaw Tower world semantics";
  source: string;
  truth: HermesTruthLabel;
  floorSigns: KhawWorldFloorSign[];
  roomBadges: KhawWorldRoomBadge[];
  workerPods: KhawWorldWorkerPod[];
  truthChips: KhawWorldTruthChip[];
  summary: string;
};

export type KhawTowerWorldSemanticsOptions = {
  maxFloors?: number;
  maxRoomsPerFloor?: number;
  maxWorkersPerRoom?: number;
};

const DEFAULT_MAX_FLOORS = 5;
const DEFAULT_MAX_ROOMS_PER_FLOOR = 3;
const DEFAULT_MAX_WORKERS_PER_ROOM = 1;

const normalizeEpochMs = (value: number): number =>
  value < 10_000_000_000 ? value * 1000 : value;

const formatFreshness = (snapshotAt: number, lastActiveAt: number | null): string => {
  if (!lastActiveAt) return "unknown freshness";
  const diffMs = Math.max(0, normalizeEpochMs(snapshotAt) - normalizeEpochMs(lastActiveAt));
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const truthReason = (truth: HermesTruthLabel, fallback: string): string =>
  truth === "GAP"
    ? "inferred grouping; Hermes has not provided first-class Wish IDs"
    : fallback;

const positionForFloor = (floorIndex: number): KhawWorldSemanticPosition => ({
  x: -5.6 + floorIndex * 2.8,
  y: 2.8,
  z: -4.2,
});

const positionForRoom = (floorIndex: number, roomIndex: number): KhawWorldSemanticPosition => ({
  x: -5.6 + floorIndex * 2.8,
  y: 1.65,
  z: -2.8 + roomIndex * 0.9,
});

const positionForWorker = (
  floorIndex: number,
  roomIndex: number,
  workerIndex: number,
): KhawWorldSemanticPosition => ({
  x: -5.2 + floorIndex * 2.8 + workerIndex * 0.5,
  y: 0.9,
  z: -2.45 + roomIndex * 0.9,
});

const offsetChip = (position: KhawWorldSemanticPosition): KhawWorldSemanticPosition => ({
  x: position.x + 0.78,
  y: position.y + 0.28,
  z: position.z,
});

const buildTruthChip = (params: {
  id: string;
  label: HermesTruthLabel;
  reason: string;
  ownerKind: KhawWorldTruthChip["ownerKind"];
  ownerId: string;
  position: KhawWorldSemanticPosition;
}): KhawWorldTruthChip => ({
  id: params.id,
  kind: "truth-chip",
  label: params.label,
  reason: params.reason,
  ownerKind: params.ownerKind,
  ownerId: params.ownerId,
  position: params.position,
});

const buildRoomReason = (room: HermesTowerRoom): string =>
  `room identity observed from session ${room.id}; source ${room.source ?? "unknown"}`;

export function projectTowerToWorldSemantics(
  tower: HermesTowerProjection,
  options: KhawTowerWorldSemanticsOptions = {},
): KhawTowerWorldSemantics {
  const maxFloors = options.maxFloors ?? DEFAULT_MAX_FLOORS;
  const maxRoomsPerFloor = options.maxRoomsPerFloor ?? DEFAULT_MAX_ROOMS_PER_FLOOR;
  const maxWorkersPerRoom = options.maxWorkersPerRoom ?? DEFAULT_MAX_WORKERS_PER_ROOM;

  const floorSigns: KhawWorldFloorSign[] = [];
  const roomBadges: KhawWorldRoomBadge[] = [];
  const workerPods: KhawWorldWorkerPod[] = [];
  const truthChips: KhawWorldTruthChip[] = [];

  tower.floors.slice(0, maxFloors).forEach((floor, floorIndex) => {
    const position = positionForFloor(floorIndex);
    const floorChip = buildTruthChip({
      id: `${floor.id}:truth-chip`,
      label: floor.truth,
      reason: truthReason(floor.truth, floor.provenance.truthReason),
      ownerKind: "floor-sign",
      ownerId: floor.id,
      position: offsetChip(position),
    });
    truthChips.push(floorChip);
    floorSigns.push({
      id: `${floor.id}:floor-sign`,
      kind: "floor-sign",
      label: floor.label,
      laneLabel: floor.placement.laneLabel,
      roomCount: floor.rooms.length,
      truth: floor.truth,
      association: floor.association,
      reason: `lane ${floor.placement.laneLabel}; placement by ${floor.provenance.placementReason}`,
      truthChip: floorChip,
      position,
    });

    floor.rooms.slice(0, maxRoomsPerFloor).forEach((room, roomIndex) => {
      const roomPosition = positionForRoom(floorIndex, roomIndex);
      const roomChip = buildTruthChip({
        id: `${room.id}:room-truth-chip`,
        label: room.truth,
        reason: "session room is directly present in the Hermes snapshot",
        ownerKind: "room-badge",
        ownerId: room.id,
        position: offsetChip(roomPosition),
      });
      truthChips.push(roomChip);
      roomBadges.push({
        id: `${room.id}:room-badge`,
        kind: "room-badge",
        label: room.label,
        floorLabel: floor.label,
        source: room.source,
        model: room.model,
        persona: room.personas[0]?.label ?? "unknown persona",
        truth: room.truth,
        freshness: formatFreshness(tower.observedAt, room.lastActiveAt),
        reason: buildRoomReason(room),
        truthChip: roomChip,
        position: roomPosition,
      });

      room.workers.slice(0, maxWorkersPerRoom).forEach((worker, workerIndex) => {
        const workerPosition = positionForWorker(floorIndex, roomIndex, workerIndex);
        const workerChip = buildTruthChip({
          id: `${worker.id}:worker-truth-chip`,
          label: worker.truth,
          reason: "worker pod is derived from observed session source/model",
          ownerKind: "worker-pod",
          ownerId: worker.id,
          position: offsetChip(workerPosition),
        });
        truthChips.push(workerChip);
        workerPods.push({
          id: `${worker.id}:worker-pod`,
          kind: "worker-pod",
          label: worker.label,
          model: worker.execution,
          floorLabel: floor.label,
          roomLabel: room.label,
          truth: worker.truth,
          reason: `worker execution ${worker.execution ?? "unknown"}`,
          truthChip: workerChip,
          position: workerPosition,
        });
      });
    });
  });

  return {
    title: "Khaw Tower world semantics",
    source: tower.source,
    truth: tower.truth,
    floorSigns,
    roomBadges,
    workerPods,
    truthChips,
    summary: `${floorSigns.length} floor signs · ${roomBadges.length} room badges · ${workerPods.length} worker pods · ${truthChips.length} truth chips`,
  };
}
