import { NextResponse } from "next/server";
import { buildHermesSnapshot, type HermesFetchResult } from "@/lib/runtime/hermes-native/snapshot";
import type { HermesSnapshot } from "@/lib/runtime/hermes-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HERMES_URL = "http://127.0.0.1:9119";
const TOKEN_RE = /__HERMES_SESSION_TOKEN__\s*=\s*['\"]([^'\"]+)['\"]/;
const HERMES_FETCH_TIMEOUT_MS = Number(process.env.HERMES_NATIVE_FETCH_TIMEOUT_MS || 15_000);
const SNAPSHOT_CACHE_TTL_MS = Number(process.env.HERMES_NATIVE_SNAPSHOT_CACHE_TTL_MS || 2_500);

let cachedToken: { value: string; expiresAt: number } | null = null;
let cachedSnapshot: { value: HermesSnapshot; expiresAt: number } | null = null;
let inFlightSnapshot: Promise<HermesSnapshot> | null = null;

const normalizeBaseUrl = (value: string): string => {
  const parsed = new URL(value.trim() || DEFAULT_HERMES_URL);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Hermes dashboard URL must use http or https.");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    const allowRemote = /^(1|true|yes|on)$/i.test(process.env.HERMES_NATIVE_ALLOW_REMOTE ?? "");
    if (!allowRemote) {
      throw new Error("Hermes dashboard URL must be loopback unless HERMES_NATIVE_ALLOW_REMOTE=1.");
    }
  }
  parsed.username = "";
  parsed.password = "";
  return parsed.toString().replace(/\/$/, "");
};

const getConfiguredToken = (): string | null =>
  (process.env.HERMES_DASHBOARD_TOKEN || process.env.HERMES_9119_TOKEN || "").trim() || null;

const fetchDashboardToken = async (baseUrl: string): Promise<string | null> => {
  const configured = getConfiguredToken();
  if (configured) return configured;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const response = await fetch(baseUrl, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const html = await response.text();
  const token = TOKEN_RE.exec(html)?.[1]?.trim() || null;
  if (token) {
    cachedToken = { value: token, expiresAt: now + 60_000 };
  }
  return token;
};

const makeHermesFetcher = (baseUrl: string, token: string | null) => async (
  pathname: string,
): Promise<HermesFetchResult> => {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
              "X-Hermes-Session-Token": token,
            }
          : null),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(HERMES_FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    let data: unknown = text;
    if (contentType.includes("application/json") && text.trim()) {
      data = JSON.parse(text) as unknown;
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
      ...(response.ok ? null : { error: typeof data === "string" ? data : JSON.stringify(data) }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hermes dashboard fetch failed.";
    return {
      ok: false,
      status: message.includes("aborted") || message.includes("timeout") ? "timeout" : "error",
      error: message,
    };
  }
};

export async function GET() {
  try {
    const now = Date.now();
    if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
      return NextResponse.json(cachedSnapshot.value, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Hermes-Snapshot-Cache": "hit",
        },
      });
    }

    const wasCoalesced = Boolean(inFlightSnapshot);
    const snapshotPromise = inFlightSnapshot ?? (async () => {
      const baseUrl = normalizeBaseUrl(process.env.HERMES_DASHBOARD_URL || DEFAULT_HERMES_URL);
      const token = await fetchDashboardToken(baseUrl);
      const snapshot = await buildHermesSnapshot({
        baseUrl,
        fetchJson: makeHermesFetcher(baseUrl, token),
      });
      cachedSnapshot = { value: snapshot, expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS };
      return snapshot;
    })();

    inFlightSnapshot = snapshotPromise;
    const snapshot = await snapshotPromise;
    if (inFlightSnapshot === snapshotPromise) inFlightSnapshot = null;
    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Hermes-Snapshot-Cache": wasCoalesced ? "coalesced" : "miss",
      },
    });
  } catch (error) {
    inFlightSnapshot = null;
    const message = error instanceof Error ? error.message : "Hermes snapshot failed.";
    return NextResponse.json(
      {
        error: "Hermes snapshot failed.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
