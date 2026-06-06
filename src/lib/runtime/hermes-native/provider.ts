import type {
  EventFrame,
  GatewayConnectOptions,
  GatewayGapInfo,
  GatewayStatus,
} from "@/lib/gateway/GatewayClient";
import type { HermesSessionNode, HermesSnapshot } from "@/lib/runtime/hermes-native/types";
import type { RuntimeCapability, RuntimeEvent, RuntimeProvider } from "@/lib/runtime/types";

export type HermesNativeProviderOptions = {
  snapshotUrl?: string;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_SNAPSHOT_URL = "/api/hermes/snapshot";
const DEFAULT_POLL_INTERVAL_MS = 2_500;

const HERMES_NATIVE_CAPABILITIES: ReadonlySet<RuntimeCapability> = new Set([
  "sessions",
  "runtime-agent-events",
  "models",
  "skills",
  "cron",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (isRecord(payload)) {
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    const error = payload.error;
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  return fallback;
};

const snapshotSessionMap = (snapshot: HermesSnapshot | null): Map<string, HermesSessionNode> => {
  const sessions = new Map<string, HermesSessionNode>();
  for (const session of snapshot?.sessions ?? []) {
    sessions.set(session.id, session);
  }
  return sessions;
};

const sessionsDiffer = (left: HermesSessionNode, right: HermesSessionNode): boolean =>
  left.title !== right.title ||
  left.source !== right.source ||
  left.model !== right.model ||
  left.profileName !== right.profileName ||
  left.messageCount !== right.messageCount ||
  left.toolCallCount !== right.toolCallCount ||
  left.cwd !== right.cwd ||
  left.startedAt !== right.startedAt ||
  left.lastActiveAt !== right.lastActiveAt ||
  left.truth !== right.truth;

export class HermesNativeProvider implements RuntimeProvider {
  readonly id = "hermes-native" as const;
  readonly label = "Khaw Tower Native";
  readonly metadata = {
    id: this.id,
    label: this.label,
    runtimeName: "Hermes native snapshot",
    routeProfile: "hermes-native",
  } as const;
  readonly capabilities = HERMES_NATIVE_CAPABILITIES;
  readonly client = null;

  private readonly snapshotUrl: string;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private status: GatewayStatus = "disconnected";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private connectPromise: Promise<void> | null = null;
  private latestSnapshot: HermesSnapshot | null = null;
  private sequence = 0;
  private statusHandlers = new Set<(status: GatewayStatus) => void>();
  private gapHandlers = new Set<(info: GatewayGapInfo) => void>();
  private eventHandlers = new Set<(event: EventFrame) => void>();
  private runtimeEventHandlers = new Set<(event: RuntimeEvent) => void>();

  constructor(options: HermesNativeProviderOptions = {}) {
    this.snapshotUrl = options.snapshotUrl ?? DEFAULT_SNAPSHOT_URL;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async connect(_options: GatewayConnectOptions): Promise<void> {
    if (this.status === "connected") return;
    if (this.connectPromise) return this.connectPromise;

    this.updateStatus("connecting");
    this.connectPromise = (async () => {
      try {
        await this.refresh();
        this.updateStatus("connected");
        this.scheduleNextPoll();
      } catch (error) {
        this.updateStatus("disconnected");
        throw error;
      } finally {
        this.connectPromise = null;
      }
    })();
    return this.connectPromise;
  }

  disconnect(): void {
    this.clearTimer();
    this.connectPromise = null;
    this.updateStatus("disconnected");
  }

  async call<T = unknown>(method: string, _params: unknown = {}): Promise<T> {
    if (!this.latestSnapshot) {
      await this.refresh();
    }
    const snapshot = this.latestSnapshot;
    if (!snapshot) throw new Error("Hermes snapshot is unavailable.");

    switch (method) {
      case "hermes.snapshot":
        return snapshot as T;
      case "config.get":
        return this.buildConfigSnapshot(snapshot) as T;
      case "exec.approvals.get":
        return { file: { agents: {} } } as T;
      case "agents.list":
        return this.buildAgentsList(snapshot) as T;
      case "sessions.list":
        return this.buildSessionsList(snapshot) as T;
      case "sessions.preview":
        return this.buildSessionsPreview(snapshot, _params) as T;
      case "status":
        return this.buildStatusSummary(snapshot) as T;
      case "chat.history":
        return { messages: [] } as T;
      default:
        throw new Error(`Hermes native provider does not support runtime method: ${method}`);
    }
  }

  onStatus(handler: (status: GatewayStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  onGap(handler: (info: GatewayGapInfo) => void): () => void {
    this.gapHandlers.add(handler);
    return () => {
      this.gapHandlers.delete(handler);
    };
  }

  onEvent(handler: (event: EventFrame) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onRuntimeEvent(handler: (event: RuntimeEvent) => void): () => void {
    this.runtimeEventHandlers.add(handler);
    return () => {
      this.runtimeEventHandlers.delete(handler);
    };
  }

  async refresh(): Promise<HermesSnapshot> {
    const previousSnapshot = this.latestSnapshot;
    const response = await this.fetchImpl(this.snapshotUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message = extractErrorMessage(payload, `Hermes snapshot failed (${response.status}).`);
      throw new Error(message);
    }

    const snapshot = payload as HermesSnapshot;
    this.latestSnapshot = snapshot;
    this.emitSnapshotEvents(snapshot, previousSnapshot);
    return snapshot;
  }

  private scheduleNextPoll(): void {
    if (this.status !== "connected") return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh()
        .catch(() => {
          this.gapHandlers.forEach((handler) => handler({ expected: this.sequence + 1, received: this.sequence }));
        })
        .finally(() => {
          this.scheduleNextPoll();
        });
    }, this.pollIntervalMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private updateStatus(status: GatewayStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private buildAgentsList(snapshot: HermesSnapshot) {
    const profiles = snapshot.profiles.length
      ? snapshot.profiles
      : [{ id: "default", name: "default", model: null, provider: null, truth: "GAP" as const }];
    return {
      defaultId: profiles[0]?.id ?? "default",
      mainKey: "main",
      scope: "hermes-native",
      agents: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        role: profile.id === "default" || profile.name === "default" ? "Tower President" : "Hermes profile",
        identity: {
          name: profile.name,
          theme: "khaw-tower",
          emoji: profile.id === "default" || profile.name === "default" ? "🏢" : "👤",
        },
      })),
    };
  }

  private buildSessionsList(snapshot: HermesSnapshot) {
    return {
      sessions: snapshot.sessions.map((session) => ({
        key: session.id,
        updatedAt: session.lastActiveAt ?? session.startedAt,
        displayName: session.title,
        origin: { label: session.source, provider: session.profileName },
        model: session.model ?? undefined,
        modelProvider: session.profileName ?? undefined,
      })),
    };
  }

  private buildSessionsPreview(snapshot: HermesSnapshot, params: unknown) {
    const requestedKeys = isRecord(params) && Array.isArray(params.keys)
      ? params.keys.filter((key): key is string => typeof key === "string" && key.trim().length > 0)
      : snapshot.sessions.map((session) => session.id);
    const sessionsById = snapshotSessionMap(snapshot);
    return {
      ts: snapshot.at,
      previews: requestedKeys.map((key) => {
        const session = sessionsById.get(key);
        if (!session) return { key, status: "missing" as const, items: [] };
        return {
          key,
          status: "ok" as const,
          items: [
            {
              role: "system" as const,
              text: `${session.title} · ${session.source ?? "unknown source"} · ${session.truth}`,
              timestamp: session.lastActiveAt ?? session.startedAt ?? snapshot.at,
            },
          ],
        };
      }),
    };
  }

  private buildStatusSummary(snapshot: HermesSnapshot) {
    return {
      sessions: {
        recent: snapshot.sessions.map((session) => ({
          key: session.id,
          updatedAt: session.lastActiveAt ?? session.startedAt,
        })),
      },
    };
  }

  private buildConfigSnapshot(snapshot: HermesSnapshot) {
    return {
      config: {
        agents: {
          defaults: {
            model: snapshot.profiles[0]?.model ?? snapshot.sessions[0]?.model ?? null,
          },
          list: this.buildAgentsList(snapshot).agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            model: snapshot.profiles.find((profile) => profile.id === agent.id)?.model ?? null,
          })),
        },
      },
    };
  }

  private emitSnapshotEvents(snapshot: HermesSnapshot, previousSnapshot: HermesSnapshot | null): void {
    const frame = this.createEventFrame("hermes.snapshot.refreshed", snapshot);
    this.eventHandlers.forEach((handler) => handler(frame));
    this.runtimeEventHandlers.forEach((handler) =>
      handler({ type: "summary-refresh", at: snapshot.at, frame, snapshot }),
    );

    const previousSessions = snapshotSessionMap(previousSnapshot);
    const nextSessions = snapshotSessionMap(snapshot);

    for (const session of nextSessions.values()) {
      const previous = previousSessions.get(session.id);
      if (!previous) {
        this.emitSessionEvent("session.started", snapshot, session);
        continue;
      }
      if (sessionsDiffer(previous, session)) {
        this.emitSessionEvent("session.updated", snapshot, session, previous);
      }
    }

    for (const previous of previousSessions.values()) {
      if (!nextSessions.has(previous.id)) {
        this.emitSessionEvent("session.ended", snapshot, previous);
      }
    }
  }

  private emitSessionEvent(
    type: "session.started" | "session.updated" | "session.ended",
    snapshot: HermesSnapshot,
    session: HermesSessionNode,
    previousSession?: HermesSessionNode,
  ): void {
    const frame = this.createEventFrame(type, { session, previousSession, snapshotAt: snapshot.at });
    this.eventHandlers.forEach((handler) => handler(frame));
    this.runtimeEventHandlers.forEach((handler) =>
      handler({ type, at: snapshot.at, frame, session, previousSession }),
    );
  }

  private createEventFrame(event: string, payload: unknown): EventFrame {
    this.sequence += 1;
    return {
      type: "event",
      event,
      payload,
      seq: this.sequence,
      stateVersion: { presence: this.sequence, health: this.sequence },
    };
  }
}
