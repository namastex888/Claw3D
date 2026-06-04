import { describe, expect, it } from "vitest";

import { resolveStudioProxyGatewayUrl } from "@/lib/gateway/proxy-url";

describe("resolveStudioProxyGatewayUrl", () => {
  it("preserves explicit direct Hermes gateway URLs on the tailnet adapter port", () => {
    expect(
      resolveStudioProxyGatewayUrl("wss://khal-1.nebulosa-cirius.ts.net:18789")
    ).toBe("wss://khal-1.nebulosa-cirius.ts.net:18789");
  });

  it("preserves explicit local gateway URLs", () => {
    expect(resolveStudioProxyGatewayUrl("ws://127.0.0.1:18789")).toBe(
      "ws://127.0.0.1:18789"
    );
  });

  it("rewrites non-direct upstream URLs to the same-origin Studio proxy", () => {
    const resolved = resolveStudioProxyGatewayUrl("wss://example.com:9999");

    expect(resolved).toContain("/api/gateway/ws");
    expect(resolved).not.toBe("wss://example.com:9999");
  });
});
