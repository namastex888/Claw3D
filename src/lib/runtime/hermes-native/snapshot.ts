import type {
  HermesProfileNode,
  HermesSessionNode,
  HermesSnapshot,
  HermesSourceProbe,
  HermesTruthLabel,
} from "@/lib/runtime/hermes-native/types";

export type HermesFetchResult = {
  ok: boolean;
  status: number | "timeout" | "error";
  data?: unknown;
  error?: string;
};

export type HermesSnapshotBuildOptions = {
  baseUrl: string;
  fetchJson: (pathname: string) => Promise<HermesFetchResult>;
  now?: () => number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/$/, "");

const parseModelConfigCwd = (value: unknown): string | null => {
  if (isRecord(value)) return asString(value.cwd);
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? asString(parsed.cwd) : null;
  } catch {
    return null;
  }
};

const sourceProbe = (
  endpoint: string,
  result: HermesFetchResult,
  at: number,
): HermesSourceProbe => ({
  endpoint,
  status: result.status,
  ok: result.ok,
  at,
  ...(result.error ? { error: result.error } : null),
});

const normalizePlatforms = (statusData: unknown) => {
  if (!isRecord(statusData) || !isRecord(statusData.gateway_platforms)) return {};
  const platforms: Record<string, { state: string; updatedAt?: string | null }> = {};
  for (const [name, value] of Object.entries(statusData.gateway_platforms)) {
    if (!isRecord(value)) continue;
    platforms[name] = {
      state: asString(value.state) ?? "unknown",
      updatedAt: asString(value.updated_at),
    };
  }
  return platforms;
};

const normalizeProfiles = (profilesData: unknown): HermesProfileNode[] => {
  if (!isRecord(profilesData) || !Array.isArray(profilesData.profiles)) return [];
  return profilesData.profiles
    .filter(isRecord)
    .map((profile, index): HermesProfileNode => {
      const name = asString(profile.name) ?? `profile-${index + 1}`;
      return {
        id: name,
        name,
        model: asString(profile.model),
        provider: asString(profile.provider),
        gatewayRunning: asBoolean(profile.gateway_running),
        skillCount: asNumber(profile.skill_count),
        truth: "OBSERVED",
      };
    });
};

const normalizeSessionTitle = (session: Record<string, unknown>): string => {
  const title = asString(session.title);
  if (title) return title;
  const preview = asString(session.preview);
  if (preview) return preview.slice(0, 96);
  const source = asString(session.source);
  const id = asString(session.id) ?? "unknown";
  return `${source ?? "session"} ${id.slice(0, 8)}`;
};

const normalizeSessions = (sessionsData: unknown): HermesSessionNode[] => {
  if (!isRecord(sessionsData) || !Array.isArray(sessionsData.sessions)) return [];
  return sessionsData.sessions
    .filter(isRecord)
    .map((session, index): HermesSessionNode => {
      const id = asString(session.id) ?? `session-${index + 1}`;
      return {
        id,
        source: asString(session.source),
        title: normalizeSessionTitle(session),
        model: asString(session.model),
        profileName: asString(session.profile) ?? asString(session.profile_name),
        messageCount: asNumber(session.message_count),
        toolCallCount: asNumber(session.tool_call_count),
        cwd: asString(session.cwd) ?? parseModelConfigCwd(session.model_config),
        startedAt: asNumber(session.started_at),
        lastActiveAt: asNumber(session.last_active) ?? asNumber(session.ended_at),
        truth: "OBSERVED",
      };
    });
};

export async function buildHermesSnapshot({
  baseUrl,
  fetchJson,
  now = () => Date.now(),
}: HermesSnapshotBuildOptions): Promise<HermesSnapshot> {
  const at = now();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoints = [
    "/api/status",
    "/api/profiles",
    "/api/sessions?limit=100&offset=0",
    "/api/sessions/stats",
  ] as const;

  const [statusResult, profilesResult, sessionsResult, sessionStatsResult] =
    await Promise.all(endpoints.map((endpoint) => fetchJson(endpoint)));

  const sources = [
    sourceProbe(endpoints[0], statusResult, at),
    sourceProbe(endpoints[1], profilesResult, at),
    sourceProbe(endpoints[2], sessionsResult, at),
    sourceProbe(endpoints[3], sessionStatsResult, at),
  ];
  const truth: HermesTruthLabel = sources.every((source) => source.ok) ? "OBSERVED" : "GAP";
  const statusData = statusResult.ok ? statusResult.data : null;

  return {
    at,
    truth,
    server: {
      url: normalizedBaseUrl,
      version: isRecord(statusData) ? asString(statusData.version) : null,
      gatewayRunning: isRecord(statusData) ? asBoolean(statusData.gateway_running) : null,
      activeSessions: isRecord(statusData) ? asNumber(statusData.active_sessions) : null,
      platforms: normalizePlatforms(statusData),
    },
    wishes: [],
    profiles: profilesResult.ok ? normalizeProfiles(profilesResult.data) : [],
    sessions: sessionsResult.ok ? normalizeSessions(sessionsResult.data) : [],
    agents: [],
    runs: [],
    tasks: [],
    sources,
  };
}
