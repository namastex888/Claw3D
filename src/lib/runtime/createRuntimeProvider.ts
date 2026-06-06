import { CustomRuntimeProvider } from "@/lib/runtime/custom/provider";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { DemoRuntimeProvider } from "@/lib/runtime/demo/provider";
import { HermesNativeProvider } from "@/lib/runtime/hermes-native/provider";
import { OpenClawRuntimeProvider } from "@/lib/runtime/openclaw/provider";
import type { RuntimeProvider } from "@/lib/runtime/types";
import type { StudioGatewayAdapterType } from "@/lib/studio/settings";

const requireGatewayClient = (client: GatewayClient | null, providerLabel: string): GatewayClient => {
  if (!client) throw new Error(`Gateway client is required for ${providerLabel} runtime provider.`);
  return client;
};

export const createRuntimeProvider = (
  providerId: RuntimeProvider["id"] | StudioGatewayAdapterType,
  client: GatewayClient | null,
  runtimeUrl: string,
): RuntimeProvider => {
  switch (providerId) {
    case "local":
      return new CustomRuntimeProvider(requireGatewayClient(client, "Local"), runtimeUrl, {
        id: "local",
        label: "Local Runtime",
        runtimeName: "Local Runtime",
        routeProfile: "local",
      });
    case "claw3d":
      return new CustomRuntimeProvider(requireGatewayClient(client, "Claw3D"), runtimeUrl, {
        id: "claw3d",
        label: "Claw3D Runtime",
        runtimeName: "Claw3D Runtime",
        routeProfile: "claw3d",
      });
    case "custom":
      return new CustomRuntimeProvider(requireGatewayClient(client, "Custom"), runtimeUrl, {
        id: "custom",
        label: "Custom Runtime",
        runtimeName: "Custom Runtime",
        routeProfile: "custom",
      });
    case "demo":
      return new DemoRuntimeProvider(requireGatewayClient(client, "Demo"));
    case "hermes":
    case "hermes-native":
      return new HermesNativeProvider({ snapshotUrl: "/api/hermes/snapshot" });
    case "openclaw":
    default:
      return new OpenClawRuntimeProvider(requireGatewayClient(client, "OpenClaw"));
  }
};
