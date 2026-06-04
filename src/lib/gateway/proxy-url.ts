const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DIRECT_GATEWAY_PORTS = new Set(["18789"]);

const isExplicitDirectGatewayUrl = (parsed: URL): boolean => {
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return false;
  if (LOOPBACK_HOSTS.has(parsed.hostname)) return true;

  // Claw3D's Hermes adapter is now exposed directly on the tailnet. Do not
  // rewrite this explicit runtime URL back to the same-origin Studio proxy
  // (`/api/gateway/ws`), otherwise the browser connects to :3040 while the
  // operator intentionally selected :18789.
  return DIRECT_GATEWAY_PORTS.has(parsed.port);
};

export const resolveStudioProxyGatewayUrl = (upstreamGatewayUrl?: string): string => {
  const raw = typeof upstreamGatewayUrl === "string" ? upstreamGatewayUrl.trim() : "";
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (isExplicitDirectGatewayUrl(parsed)) {
        return raw;
      }
    } catch {
      // Fall through to the Studio proxy for malformed or non-URL values.
    }
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${protocol}://${host}/api/gateway/ws`;
};

