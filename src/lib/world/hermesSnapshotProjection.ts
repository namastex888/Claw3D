import type {
  HermesSessionNode,
  HermesSnapshot,
  HermesTruthLabel,
} from "@/lib/runtime/hermes-native/types";

export type HermesTowerWorker = {
  id: string;
  label: string;
  role: string | null;
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
  workers: HermesTowerWorker[];
};

export type HermesTowerFloor = {
  id: string;
  label: string;
  truth: HermesTruthLabel;
  association: "verified" | "inferred" | "unassigned";
  rooms: HermesTowerRoom[];
};

export type HermesTowerProjection = {
  title: "Hermes Tower";
  truth: HermesTruthLabel;
  source: string;
  lobby: {
    version: string | null;
    gatewayRunning: boolean | null;
    activeSessions: number | null;
    platformCount: number;
  };
  floors: HermesTowerFloor[];
  sourceGaps: number;
};

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

const extractWishTitle = (session: HermesSessionNode): string | null => {
  const title = session.title.trim();
  if (title) return title;
  if (session.cwd) {
    const leaf = session.cwd.split("/").filter(Boolean).at(-1);
    if (leaf) return titleCase(leaf);
  }
  return null;
};

const buildWorker = (session: HermesSessionNode): HermesTowerWorker => {
  const profile = session.profileName?.trim();
  const source = session.source?.trim();
  return {
    id: `${session.id}:worker`,
    label: profile || source || "Hermes worker",
    role: session.model,
    truth: session.truth,
  };
};

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
  workers: [buildWorker(session)],
});

export function projectHermesSnapshotToTower(snapshot: HermesSnapshot): HermesTowerProjection {
  const floorsById = new Map<string, HermesTowerFloor>();

  for (const session of snapshot.sessions) {
    const inferredTitle = extractWishTitle(session);
    const association: HermesTowerFloor["association"] = inferredTitle ? "inferred" : "unassigned";
    const label = inferredTitle ? titleCase(inferredTitle) : "Ground Floor / Unassigned";
    const id = association === "unassigned" ? "wish:unassigned" : `wish:${slugify(label)}`;
    const existing = floorsById.get(id);
    if (existing) {
      existing.rooms.push(buildRoom(session));
    } else {
      floorsById.set(id, {
        id,
        label,
        truth: association === "unassigned" ? "GAP" : "GAP",
        association,
        rooms: [buildRoom(session)],
      });
    }
  }

  return {
    title: "Hermes Tower",
    truth: snapshot.truth,
    source: snapshot.server.url,
    lobby: {
      version: snapshot.server.version,
      gatewayRunning: snapshot.server.gatewayRunning,
      activeSessions: snapshot.server.activeSessions,
      platformCount: Object.keys(snapshot.server.platforms).length,
    },
    floors: Array.from(floorsById.values()).sort((left, right) =>
      right.rooms.length - left.rooms.length || left.label.localeCompare(right.label),
    ),
    sourceGaps: snapshot.sources.filter((source) => !source.ok).length,
  };
}
