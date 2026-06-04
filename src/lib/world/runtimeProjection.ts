import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import {
  DROGO_SERVER_GOD_AGENT_ID,
  DROGO_SERVER_GOD_AVATAR_PROFILE,
} from "@/lib/avatars/presets";

export type RuntimeProjectionTruth = "OBSERVED" | "SIMULATED" | "VERIFIED" | "GAP";

export type RuntimeProjectionKind = "server-god" | "runtime-agent";

export type RuntimeProjectionMetadata = {
  kind: RuntimeProjectionKind;
  runtimeAgentId: string;
  runtimeName: string;
  displayName: string;
  roleLabel: string | null;
  sourceLabel: string;
  truth: RuntimeProjectionTruth;
  omnipresent: boolean;
  controlSurface: "skyview" | "room";
  safeActions: Array<"inspect" | "chat" | "monitor" | "copy-id">;
};

export type RuntimeProjectionAgentInput = {
  agentId: string;
  name?: string | null;
  runtimeName?: string | null;
  role?: string | null;
  avatarProfile?: AgentAvatarProfile | null;
};

export type RuntimeProjectionOptions = {
  activeAdapterType?: string | null;
};

export type RuntimeProjectionResult = {
  id: string;
  name: string;
  subtitle: string | null;
  color: string | null;
  item: string | null;
  avatarProfile: AgentAvatarProfile | null;
  projection: RuntimeProjectionMetadata;
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

export const isHermesOrchestratorAgent = (
  agent: RuntimeProjectionAgentInput,
  options: RuntimeProjectionOptions = {},
): boolean => {
  const adapter = normalize(options.activeAdapterType);
  const agentId = normalize(agent.agentId);
  const name = normalize(agent.name);
  const runtimeName = normalize(agent.runtimeName);
  const role = normalize(agent.role);

  if (agentId === "hermes") return true;
  if (adapter === "hermes" && role === "orchestrator") return true;
  if (adapter === "hermes" && name === "hermes") return true;
  if (runtimeName === "hermes" && role === "orchestrator") return true;
  return false;
};

export const resolveRuntimeProjection = (
  agent: RuntimeProjectionAgentInput,
  options: RuntimeProjectionOptions = {},
): RuntimeProjectionResult => {
  if (isHermesOrchestratorAgent(agent, options)) {
    const runtimeName = agent.name?.trim() || agent.runtimeName?.trim() || "Hermes";
    return {
      id: agent.agentId,
      name: "Drogo",
      subtitle: "Server God / Orchestrator",
      color: "#111827",
      item: "server-god",
      avatarProfile: DROGO_SERVER_GOD_AVATAR_PROFILE,
      projection: {
        kind: "server-god",
        runtimeAgentId: agent.agentId,
        runtimeName,
        displayName: "Drogo",
        roleLabel: "Server God / Orchestrator",
        sourceLabel: "Hermes runtime",
        truth: "OBSERVED",
        omnipresent: true,
        controlSurface: "skyview",
        safeActions: ["inspect", "chat", "monitor", "copy-id"],
      },
    };
  }

  const displayName = agent.name?.trim() || agent.agentId || "Unknown";
  const runtimeName = agent.runtimeName?.trim() || displayName;
  return {
    id: agent.agentId,
    name: displayName,
    subtitle: agent.role?.trim() || null,
    color: null,
    item: null,
    avatarProfile: agent.avatarProfile ?? null,
    projection: {
      kind: "runtime-agent",
      runtimeAgentId: agent.agentId,
      runtimeName,
      displayName,
      roleLabel: agent.role?.trim() || null,
      sourceLabel: "runtime",
      truth: "OBSERVED",
      omnipresent: false,
      controlSurface: "room",
      safeActions: ["inspect", "chat", "monitor", "copy-id"],
    },
  };
};

export const isDrogoServerGodProjection = (projection: RuntimeProjectionMetadata | null | undefined) =>
  projection?.kind === "server-god" || projection?.displayName === "Drogo";

export { DROGO_SERVER_GOD_AGENT_ID };
