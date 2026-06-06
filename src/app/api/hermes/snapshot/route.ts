import { spawn } from "node:child_process";
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

type RawHermesHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

const PYTHON_LOOPBACK_FETCH = String.raw`
import json
import sys
import urllib.error
import urllib.request

request = json.loads(sys.stdin.read())
url = request["url"]
headers = request.get("headers") or {}
timeout = max(0.1, float(request.get("timeoutMs") or 10000) / 1000.0)
req = urllib.request.Request(url, headers=headers, method="GET")
try:
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8", "replace")
        print(json.dumps({
            "status": response.status,
            "headers": dict(response.headers.items()),
            "body": body,
        }))
except urllib.error.HTTPError as error:
    body = error.read().decode("utf-8", "replace")
    print(json.dumps({
        "status": error.code,
        "headers": dict(error.headers.items()),
        "body": body,
    }))
`;

const readLoopbackHttp = (
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<RawHermesHttpResponse> => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const pathname = `${url.pathname}${url.search}` || "/";
  debugHermesNative("request:start", { path: pathname, host: url.hostname, timeoutMs });
  const child = spawn("python3", ["-c", PYTHON_LOOPBACK_FETCH], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill("SIGKILL");
    debugHermesNative("request:timeout", { path: pathname, elapsedMs: Date.now() - startedAt });
    reject(new Error("The operation was aborted due to timeout"));
  }, timeoutMs + 500);

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("error", (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    reject(error);
  });
  child.on("close", (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    debugHermesNative("request:end", { path: pathname, elapsedMs: Date.now() - startedAt, code });
    if (code !== 0) {
      reject(new Error(stderr.trim() || `Hermes loopback fetch exited with code ${code}.`));
      return;
    }
    try {
      const parsed = JSON.parse(stdout) as RawHermesHttpResponse;
      const normalizedHeaders = Object.fromEntries(
        Object.entries(parsed.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]),
      );
      resolve({
        status: parsed.status,
        headers: normalizedHeaders,
        body: parsed.body ?? "",
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Hermes loopback fetch returned invalid JSON."));
    }
  });
  child.stdin.end(JSON.stringify({
    url: url.toString(),
    headers: {
      Accept: "application/json",
      ...headers,
    },
    timeoutMs,
  }));
});

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
  (
    process.env.HERMES_DASHBOARD_TOKEN
    || process.env.HERMES_DASHBOARD_SESSION_TOKEN
    || process.env.HERMES_9119_TOKEN
    || ""
  ).trim() || null;

const debugHermesNative = (message: string, meta: Record<string, unknown> = {}) => {
  if (!/^(1|true|yes|on)$/i.test(process.env.HERMES_NATIVE_DEBUG ?? "")) return;
  console.info(`[hermes-native:snapshot] ${message}`, meta);
};

const fetchDashboardToken = async (baseUrl: string): Promise<string | null> => {
  const configured = getConfiguredToken();
  if (configured) return configured;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const response = await readLoopbackHttp(new URL(baseUrl), {}, 5_000);
  if (response.status < 200 || response.status >= 300) return null;
  const token = TOKEN_RE.exec(response.body)?.[1]?.trim() || null;
  if (token) {
    cachedToken = { value: token, expiresAt: now + 60_000 };
  }
  return token;
};

const makeHermesFetcher = (baseUrl: string, token: string | null) => async (
  pathname: string,
): Promise<HermesFetchResult> => {
  try {
    const response = await readLoopbackHttp(
      new URL(`${baseUrl}${pathname}`),
      token
        ? {
            Authorization: `Bearer ${token}`,
            "X-Hermes-Session-Token": token,
          }
        : {},
      HERMES_FETCH_TIMEOUT_MS,
    );
    const contentType = response.headers["content-type"] ?? "";
    const text = response.body;
    let data: unknown = text;
    if (contentType.includes("application/json") && text.trim()) {
      data = JSON.parse(text) as unknown;
    }
    const ok = response.status >= 200 && response.status < 300;
    return {
      ok,
      status: response.status,
      data,
      ...(ok ? null : { error: typeof data === "string" ? data : JSON.stringify(data) }),
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
