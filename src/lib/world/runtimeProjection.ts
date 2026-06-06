import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import {
  TOWER_PRESIDENT_AGENT_ID,
  TOWER_PRESIDENT_AVATAR_PROFILE,
} from "@/lib/avatars/presets";

export type RuntimeProjectionTruth = "OBSERVED" | "SIMULATED" | "VERIFIED" | "GAP";

export type RuntimeProjectionKind = "tower-president" | "runtime-agent";

export type RuntimeProjectionMetadata = {
  kind: RuntimeProjectionKind;
  runtimeAgentId: string;
  runtimeName: string;
  displayName: string;
  roleLabel: string | null;
  sourceLabel: string;
  truth: RuntimeProjectionTruth;
  omnipresent: boolean;
  controlSurface: "executive" | "room";
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
      name: "Tower President",
      subtitle: "Tower President / Executive Operator",
      color: "#111827",
      item: "tower-president",
      avatarProfile: TOWER_PRESIDENT_AVATAR_PROFILE,
      projection: {
        kind: "tower-president",
        runtimeAgentId: agent.agentId,
        runtimeName,
        displayName: "Tower President",
        roleLabel: "Tower President / Executive Operator",
        sourceLabel: "Hermes runtime",
        truth: "OBSERVED",
        omnipresent: true,
        controlSurface: "executive",
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

export const isTowerPresidentProjection = (projection: RuntimeProjectionMetadata | null | undefined) =>
  projection?.kind === "tower-president" || projection?.displayName === "Tower President";

export { TOWER_PRESIDENT_AGENT_ID };
