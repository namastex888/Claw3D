export type HermesTruthLabel = "OBSERVED" | "VERIFIED" | "GAP" | "SIMULATED";

export type HermesSourceProbe = {
  endpoint: string;
  status: number | "timeout" | "error";
  ok: boolean;
  at: number;
  error?: string;
};

export type HermesServerPlatform = {
  state: string;
  updatedAt?: string | null;
};

export type HermesServerNode = {
  url: string;
  version: string | null;
  gatewayRunning: boolean | null;
  activeSessions: number | null;
  platforms: Record<string, HermesServerPlatform>;
};

export type HermesProfileNode = {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
  gatewayRunning?: boolean | null;
  skillCount?: number | null;
  truth: HermesTruthLabel;
};

export type HermesSessionNode = {
  id: string;
  source: string | null;
  title: string;
  model: string | null;
  profileName: string | null;
  messageCount: number | null;
  toolCallCount: number | null;
  cwd: string | null;
  startedAt: number | null;
  lastActiveAt: number | null;
  truth: HermesTruthLabel;
};

export type HermesWishNode = {
  id: string;
  slug: string;
  title: string;
  truth: HermesTruthLabel;
};

export type HermesAgentNode = {
  id: string;
  name: string;
  role: string | null;
  profileName: string | null;
  truth: HermesTruthLabel;
};

export type HermesRunNode = {
  id: string;
  sessionId: string | null;
  status: string | null;
  truth: HermesTruthLabel;
};

export type HermesTaskNode = {
  id: string;
  title: string;
  status: string | null;
  truth: HermesTruthLabel;
};

export type HermesSnapshot = {
  at: number;
  truth: HermesTruthLabel;
  server: HermesServerNode;
  wishes: HermesWishNode[];
  profiles: HermesProfileNode[];
  sessions: HermesSessionNode[];
  agents: HermesAgentNode[];
  runs: HermesRunNode[];
  tasks: HermesTaskNode[];
  sources: HermesSourceProbe[];
};
