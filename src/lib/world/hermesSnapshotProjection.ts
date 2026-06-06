import type {
  HermesSessionNode,
  HermesSnapshot,
  HermesTruthLabel,
} from "@/lib/runtime/hermes-native/types";

export type KhawTowerLaneId =
  | "office"
  | "labs-university"
  | "ops"
  | "platform"
  | "desktop"
  | "fde-operations"
  | "unknown";

export type KhawTowerPlacementSource =
  | "wish-frontmatter"
  | "path-rule"
  | "repo-rule"
  | "session-inference"
  | "manual-override"
  | "unknown";

export type KhawTowerLane = {
  id: KhawTowerLaneId;
  label: string;
  description: string;
  truth: HermesTruthLabel;
  floorCount: number;
  roomCount: number;
};

export type KhawTowerPresident = {
  id: "tower-president";
  label: "Tower President";
  personaLabel: "Drogo";
  role: "executive-operator";
  truth: HermesTruthLabel;
  presence: "tower-level";
};

export type KhawTowerWishPlacement = {
  laneId: KhawTowerLaneId;
  laneLabel: string;
  source: KhawTowerPlacementSource;
  truth: HermesTruthLabel;
};

export type HermesTowerPersona = {
  id: string;
  label: string;
  kind: "profile-persona" | "session-persona";
  truth: HermesTruthLabel;
};

export type HermesTowerWorker = {
  id: string;
  label: string;
  execution: string | null;
  role: string | null;
  truth: HermesTruthLabel;
};

export type HermesTowerDesk = {
  id: string;
  label: string;
  activity: string;
  truth: HermesTruthLabel;
};

export type HermesTowerRoom = {
  id: string;
  label: string;
  source: string | null;
  model: string | null;
  cwd: string | null;
  messageCount: number | null;
  toolCallCount: number | null;
  lastActiveAt: number | null;
  truth: HermesTruthLabel;
  personas: HermesTowerPersona[];
  workers: HermesTowerWorker[];
  desks: HermesTowerDesk[];
};

export type HermesTowerFloorProvenance = {
  nameSource: "session-title" | "cwd-path" | "unknown";
  nameEvidence: string | null;
  placementReason: string;
  truthReason: string;
};

export type HermesTowerFloor = {
  id: string;
  label: string;
  laneId: KhawTowerLaneId;
  truth: HermesTruthLabel;
  association: "verified" | "inferred" | "unassigned";
  placement: KhawTowerWishPlacement;
  provenance: HermesTowerFloorProvenance;
  rooms: HermesTowerRoom[];
};

export type HermesTowerProjection = {
  title: "Khaw Tower";
  truth: HermesTruthLabel;
  source: string;
  observedAt: number;
  president: KhawTowerPresident;
  lobby: {
    version: string | null;
    gatewayRunning: boolean | null;
    activeSessions: number | null;
    platformCount: number;
  };
  lanes: KhawTowerLane[];
  floors: HermesTowerFloor[];
  sourceGaps: number;
};

const LANE_DEFINITIONS: ReadonlyArray<Omit<KhawTowerLane, "floorCount" | "roomCount" | "truth">> = [
  {
    id: "office",
    label: "Office",
    description: "KHAL Office, products, customer/operator flows, release and live business operations.",
  },
  {
    id: "labs-university",
    label: "Labs / University",
    description: "Khaw Tower R&D, learning society, curriculum, prototypes, experiments, and training.",
  },
  {
    id: "unknown",
    label: "Unknown / Ground",
    description: "Visible holding lane for sessions whose Wish/lane placement is not yet proven.",
  },
];

const laneLabel = (laneId: KhawTowerLaneId): string =>
  LANE_DEFINITIONS.find((lane) => lane.id === laneId)?.label ?? "Unknown / Ground";

const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unassigned";
};

const searchableSessionText = (session: HermesSessionNode): string =>
  [session.title, session.cwd, session.source, session.profileName, session.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const GENERIC_SESSION_TITLE_RE = /^(acp|cli|session|thread)\s+[a-z0-9_-]{6,}$/i;
const TRAILING_RESUME_COUNTER_RE = /\s+#\d+$/;

const pathWorkstreamTitle = (cwd: string | null): string | null => {
  if (!cwd) return null;
  const parts = cwd.split("/").filter(Boolean);
  const wishesIndex = parts.indexOf("wishes");
  if (wishesIndex !== -1 && parts.length > wishesIndex + 4) {
    const wishSlug = parts.at(-1);
    return wishSlug ? titleCase(wishSlug) : null;
  }
  const leaf = parts.at(-1);
  if (!leaf) return null;
  if (["src", "workspace", "agents", "experiments"].includes(leaf.toLowerCase())) return null;
  return titleCase(leaf);
};

const normalizeWorkstreamTitle = (value: string): string =>
  titleCase(value.trim().replace(TRAILING_RESUME_COUNTER_RE, ""));

type WorkstreamIdentity = {
  title: string | null;
  nameSource: HermesTowerFloorProvenance["nameSource"];
  nameEvidence: string | null;
};

const extractWishIdentity = (session: HermesSessionNode): WorkstreamIdentity => {
  const title = session.title.trim();
  const pathTitle = pathWorkstreamTitle(session.cwd);
  if (title && GENERIC_SESSION_TITLE_RE.test(title) && pathTitle) {
    return { title: pathTitle, nameSource: "cwd-path", nameEvidence: session.cwd };
  }
  if (title) {
    return { title: normalizeWorkstreamTitle(title), nameSource: "session-title", nameEvidence: session.title };
  }
  if (pathTitle) {
    return { title: pathTitle, nameSource: "cwd-path", nameEvidence: session.cwd };
  }
  return { title: null, nameSource: "unknown", nameEvidence: null };
};

const classifyWishPlacement = (session: HermesSessionNode): KhawTowerWishPlacement => {
  const text = searchableSessionText(session);
  const cwd = session.cwd?.toLowerCase() ?? "";

  if (
    cwd.includes("/experiments/claw3d") ||
    cwd.includes("/workspace/src/open-design") ||
    cwd.includes("/.khaw/apps/open-design") ||
    text.includes("khaw tower") ||
    text.includes("claw3d") ||
    text.includes("open design")
  ) {
    return {
      laneId: "labs-university",
      laneLabel: laneLabel("labs-university"),
      source: "repo-rule",
      truth: "GAP",
    };
  }

  if (cwd.includes("/agents/university/") || cwd.includes("/brain/wishes/")) {
    return {
      laneId: "labs-university",
      laneLabel: laneLabel("labs-university"),
      source: "path-rule",
      truth: "GAP",
    };
  }

  if (
    text.includes("khaw desktop") ||
    text.includes("khal desktop") ||
    text.includes("desktop project")
  ) {
    return {
      laneId: "office",
      laneLabel: laneLabel("office"),
      source: "session-inference",
      truth: "GAP",
    };
  }

  if (
    text.includes("eugenia") ||
    text.includes("gupshup") ||
    text.includes("deploy ledger") ||
    text.includes("release readiness") ||
    cwd.includes("genie-hv-eugenia")
  ) {
    return {
      laneId: "office",
      laneLabel: laneLabel("office"),
      source: "repo-rule",
      truth: "GAP",
    };
  }

  return {
    laneId: "unknown",
    laneLabel: laneLabel("unknown"),
    source: "unknown",
    truth: "GAP",
  };
};

const buildPersona = (session: HermesSessionNode): HermesTowerPersona => {
  const profile = session.profileName?.trim();
  return {
    id: profile ? `profile:${slugify(profile)}` : `${session.id}:persona`,
    label: profile || "Unassigned persona",
    kind: profile ? "profile-persona" : "session-persona",
    truth: session.truth,
  };
};

const buildWorker = (session: HermesSessionNode): HermesTowerWorker => {
  const source = session.source?.trim();
  const execution = session.model?.trim() || null;
  return {
    id: `${session.id}:worker`,
    label: source ? `${source} session` : "Hermes session",
    execution,
    role: execution,
    truth: session.truth,
  };
};

const buildDesk = (session: HermesSessionNode): HermesTowerDesk => ({
  id: `${session.id}:desk`,
  label: "Current activity",
  activity: `${session.messageCount ?? "unknown"} messages · ${session.toolCallCount ?? "unknown"} tool calls`,
  truth: session.truth,
});

const buildRoom = (session: HermesSessionNode): HermesTowerRoom => ({
  id: session.id,
  label: session.title,
  source: session.source,
  model: session.model,
  cwd: session.cwd,
  messageCount: session.messageCount,
  toolCallCount: session.toolCallCount,
  lastActiveAt: session.lastActiveAt,
  truth: session.truth,
  personas: [buildPersona(session)],
  workers: [buildWorker(session)],
  desks: [buildDesk(session)],
});

const buildPresident = (snapshot: HermesSnapshot): KhawTowerPresident => ({
  id: "tower-president",
  label: "Tower President",
  personaLabel: "Drogo",
  role: "executive-operator",
  truth: snapshot.truth === "SIMULATED" ? "SIMULATED" : "OBSERVED",
  presence: "tower-level",
});

const floorLastActiveAt = (floor: HermesTowerFloor): number =>
  Math.max(0, ...floor.rooms.map((room) => room.lastActiveAt ?? 0));

const placementReason = (source: KhawTowerPlacementSource): string =>
  source === "unknown" ? "unknown placement" : source.replace(/-/g, " ");

const truthReason = (placement: KhawTowerWishPlacement): string =>
  placement.truth === "GAP"
    ? "floor grouping is inferred until Hermes provides first-class Wish IDs"
    : "directly provided by Hermes snapshot";

const buildFloorProvenance = (
  identity: WorkstreamIdentity,
  placement: KhawTowerWishPlacement,
): HermesTowerFloorProvenance => ({
  nameSource: identity.nameSource,
  nameEvidence: identity.nameEvidence,
  placementReason: placementReason(placement.source),
  truthReason: truthReason(placement),
});

const buildLanes = (floors: HermesTowerFloor[]): KhawTowerLane[] =>
  LANE_DEFINITIONS.map((lane) => {
    const laneFloors = floors.filter((floor) => floor.laneId === lane.id);
    return {
      ...lane,
      truth: laneFloors.some((floor) => floor.truth === "GAP") ? "GAP" : "OBSERVED",
      floorCount: laneFloors.length,
      roomCount: laneFloors.reduce((total, floor) => total + floor.rooms.length, 0),
    };
  });

export function projectHermesSnapshotToTower(snapshot: HermesSnapshot): HermesTowerProjection {
  const floorsById = new Map<string, HermesTowerFloor>();

  for (const session of snapshot.sessions) {
    const identity = extractWishIdentity(session);
    const placement = classifyWishPlacement(session);
    const association: HermesTowerFloor["association"] =
      placement.source === "unknown" ? "unassigned" : "inferred";
    const label = identity.title ? titleCase(identity.title) : "Ground Floor / Unassigned";
    const id = `${placement.laneId}:wish:${slugify(label)}`;
    const room = buildRoom(session);
    const existing = floorsById.get(id);
    if (existing) {
      existing.rooms.push(room);
    } else {
      floorsById.set(id, {
        id,
        label,
        laneId: placement.laneId,
        truth: placement.truth,
        association,
        placement,
        provenance: buildFloorProvenance(identity, placement),
        rooms: [room],
      });
    }
  }

  const floors = Array.from(floorsById.values()).map((floor) => ({
    ...floor,
    rooms: [...floor.rooms].sort(
      (left, right) =>
        (right.lastActiveAt ?? 0) - (left.lastActiveAt ?? 0) || left.label.localeCompare(right.label),
    ),
  })).sort((left, right) => {
    const laneDelta =
      LANE_DEFINITIONS.findIndex((lane) => lane.id === left.laneId) -
      LANE_DEFINITIONS.findIndex((lane) => lane.id === right.laneId);
    return laneDelta || floorLastActiveAt(right) - floorLastActiveAt(left) || right.rooms.length - left.rooms.length || left.label.localeCompare(right.label);
  });

  return {
    title: "Khaw Tower",
    truth: snapshot.truth,
    source: snapshot.server.url,
    observedAt: snapshot.at,
    president: buildPresident(snapshot),
    lobby: {
      version: snapshot.server.version,
      gatewayRunning: snapshot.server.gatewayRunning,
      activeSessions: snapshot.server.activeSessions,
      platformCount: Object.keys(snapshot.server.platforms).length,
    },
    lanes: buildLanes(floors),
    floors,
    sourceGaps: snapshot.sources.filter((source) => !source.ok).length,
  };
}
