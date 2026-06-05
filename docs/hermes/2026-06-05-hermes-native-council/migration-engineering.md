# COUNCIL SEAT 3: MIGRATION ENGINEERING — Strip OpenClaw, Add Hermes-Native

**Date:** 2026-06-05
**Status:** DECISIVE RECOMMENDATION
**Gating facts:** 9119 has NO public WebSocket. `/api/status` is unauthenticated; all other endpoints 401-gate behind session cookie. Khortex real API is down (`database "brain" does not exist`). Mock works.

---

## VERDICT IN ONE LINE

**HTTP-snapshot-diff substrate over the existing `/api/runtime/custom` proxy pattern. New `HermesNativeProvider` satisfies `RuntimeProvider` contract. OpenClaw converter quarantined then deleted. The `RuntimeProvider` interface must relax `readonly client: GatewayClient` → `client: GatewayClient | null` to allow HTTP-native providers. Zero WebSocket to 9119. Zero cookie exposure to browser.**

---

## 1. FILE INVENTORY — WHAT EXISTS

```
src/lib/runtime/
├── types.ts                          # RuntimeProvider interface (must relax)
├── createRuntimeProvider.ts          # Factory switch (must extend)
├── openclaw/
│   ├── provider.ts                   # OpenClawRuntimeProvider (DELETE)
│   └── normalizeGatewayEvent.ts     # EventFrame→RuntimeEvent (QUARANTINE)
├── hermes/
│   └── provider.ts                  # HermesRuntimeProvider wrappers WS (DELETE)
├── custom/
│   ├── provider.ts                  # CustomRuntimeProvider (KEEP)
│   └── http.ts                      # requestCustomRuntime proxy (EXTEND/reuse)
├── demo/provider.ts                 # DemoRuntimeProvider (KEEP)
├── useRuntimeConnection.ts          # React hook (no change needed)
└── agentMessaging.ts                # Agent messaging ops (KEEP)

src/lib/world/
└── runtimeProjection.ts             # Drogo server-god + agent projection (EXTEND)

src/app/api/runtime/custom/
└── route.ts                         # Server-side HTTP proxy (reuse pattern)

tests/unit/
├── runtimeProjection.test.ts        # 3 tests, all pass (EXTEND)
├── useRuntimeConnection.test.ts     # 4 tests, all pass (EXTEND)
└── [173 total test files, 7 pre-existing failures unrelated]
```

## 2. CRITICAL DEPENDENCY MAP — What imports what

```
createRuntimeProvider.ts
  imports: OpenClawRuntimeProvider     ← DELETE import
  imports: HermesRuntimeProvider       ← DELETE import, REPLACE with HermesNative
  imports: CustomRuntimeProvider       ← KEEP
  imports: DemoRuntimeProvider         ← KEEP

hermes/provider.ts
  imports: normalizeGatewayEvent       ← from openclaw/ (SHARED DEPENDENCY)
  imports: GatewayClient               ← WS dependency (STRIP)

openclaw/provider.ts
  imports: normalizeGatewayEvent       ← MOVED to shared/hermes-native location

GatewayClient.ts
  imports: GatewayBrowserClient        ← from openclaw/ (KEEP — it's the WS client)
```

**Key insight:** `normalizeGatewayEvent` is the only shared dependency between the old Hermes provider and the OpenClaw provider. Both old providers both use it to convert raw `EventFrame` → typed `RuntimeEvent`. The new native provider does NOT need it (it synthesizes events from snapshot diffs instead). But the existing event workflows (`runtimeEventBridge`, `runtimeChatEventWorkflow`, etc.) consume `RuntimeEvent` types — those types must stay stable.

## 3. DELETION ORDER (4 phases, each a separate PR)

### PHASE A — ADD (no deletion)

```
+ src/lib/runtime/hermes-native/
  ├── provider.ts                    HermesNativeProvider implements RuntimeProvider
  ├── snapshot.ts                    HermesSnapshot types + fetcher
  ├── projection.ts                  snapshot → floors/rooms/workers/desks
  └── eventSynthesis.ts              diff snapshots → RuntimeEvent[]

+ src/app/api/hermes/
  └── snapshot/route.ts              Server-side proxy: GET /api/hermes/snapshot
                                     holds 9119 cred server-side, fans out to:
                                     /api/status, /api/sessions, /api/profiles,
                                     /api/sessions/stats, /api/analytics/*

+ src/lib/world/hermesSnapshotProjection.ts   snapshot → spatial model

Δ src/lib/runtime/types.ts           Relax RuntimeProvider:
                                     client: GatewayClient | null
                                     + transport: "ws" | "http"

Δ src/lib/runtime/createRuntimeProvider.ts    Add case "hermes-native":
                                     return new HermesNativeProvider(...)
                                     behind env: RUNTIME=hermes-native

Δ src/lib/studio/settings.ts         Add "hermes-native" to adapter type union

+ tests/unit/hermesNativeProvider.test.ts         10 tests minimum
+ tests/unit/hermesSnapshotProjection.test.ts     8 tests minimum
+ tests/unit/hermesSnapshotRoute.test.ts          5 tests minimum
```

**Phase A exit gate:** `npm run typecheck` + `npm run test -- --run` green. Old providers still boot.

### PHASE B — PROVE PARITY (flip default, observe)

```
Δ src/lib/runtime/createRuntimeProvider.ts   Default → "hermes-native" when
                                             9119 reachable, else fallback to
                                             "openclaw" (graceful degradation).
Δ .env.example                                Add HERMES_9119_URL, deprecate old keys
Δ AGENTS.md                                   Note: repo is transitioning away from
                                              "frontend for OpenClaw"
```

**Phase B exit gate:** Live 9119 → tower renders ≥1 floor from real `/api/sessions`, `truth=OBSERVED`. Browser network tab shows ONLY `/api/hermes/*` calls. Zero 401 to browser. Felipe visual QA with native vision + DOM/console/network.

### PHASE C — QUARANTINE (mark deprecated, keep for rollback)

```
Δ src/lib/runtime/openclaw/provider.ts   Add @deprecated JSDoc, add console.warn
Δ src/lib/runtime/hermes/provider.ts      Add @deprecated JSDoc, add console.warn
Δ createRuntimeProvider.ts                Comment "openclaw" and "hermes" cases
                                          behind LEGACY_RUNTIME=1 env flag
```

**Phase C exit gate:** `npm run build` still succeeds. Old providers loadable via `LEGACY_RUNTIME=1` for emergency rollback. At least 1 production day of hermes-native running clean.

### PHASE D — DELETE (hard prune)

```
- src/lib/runtime/openclaw/               DELETE entire directory
  ├── provider.ts
  └── normalizeGatewayEvent.ts

- src/lib/runtime/hermes/provider.ts       DELETE (old WS wrapper)

Δ src/lib/runtime/types.ts                Remove "openclaw" from RuntimeProviderId union
                                          → only "hermes-native", "hermes", "demo",
                                            "local", "claw3d", "custom"

Δ src/lib/studio/settings.ts              Remove "openclaw" from
                                          StudioGatewayAdapterType union

Δ src/lib/runtime/createRuntimeProvider.ts Remove OpenClawRuntimeProvider import
                                           Remove old HermesRuntimeProvider import
                                           Remove switch cases

Δ GatewayClient.ts                        Clean openclaw-specific client name logic:
                                          resolveGatewayClientName (line 132)
                                          isAutoManagedAdapter (line 127)

Δ server/gateway-proxy.js                 Default upstreamAdapterType → "hermes-native"
                                          Remove openclaw fallback (line 192)

Δ server/studio-settings.js               Remove OPENCLAW_CONFIG_FILENAME,
                                          NEW_STATE_DIRNAME, openclaw default paths

Δ scripts/claw3doctor.mjs                 Remove openclaw-native checks
Δ scripts/lib/claw3doctor-core.mjs        Remove openclaw adapter default
Δ scripts/studio-setup.js                 Remove openclaw CLI detection
Δ CONTRIBUTING.md                         Remove ~/.openclaw references
Δ AGENTS.md                               Final: "Repo is a frontend for Hermes."
                                          Remove "frontend for OpenClaw" language

- tests referencing openclaw source       6 test files need openclaw refs stripped:
  (see §5 Test Slices for detail)
```

**Phase D exit gate:** `npm run typecheck` + `npm run test -- --run` green. `npm run build` green with no `Can't resolve 'openclaw'` warning. `grep -ri openclaw src/` returns zero hits (except in migration docs).

---

## 4. THE HermesNativeProvider — Detailed Spec

### 4.1 Interface Relaxation

```typescript
// src/lib/runtime/types.ts — ADD
export type RuntimeTransportMode = "ws" | "http";

// src/lib/runtime/types.ts — CHANGE
export interface RuntimeProvider {
  readonly id: RuntimeProviderId;
  readonly label: string;
  readonly metadata: RuntimeProviderMetadata;
  readonly capabilities: ReadonlySet<RuntimeCapability>;
  readonly client: GatewayClient | null;        // WAS: GatewayClient
  readonly transport: RuntimeTransportMode;      // NEW
  connect(options: GatewayConnectOptions): Promise<void>;
  disconnect(): void;
  call<T = unknown>(method: string, params: unknown): Promise<T>;
  onStatus(handler: (status: RuntimeStatus) => void): () => void;
  onGap(handler: (info: GatewayGapInfo) => void): () => void;
  onEvent(handler: (event: EventFrame) => void): () => void;
  onRuntimeEvent(handler: (event: RuntimeEvent) => void): () => void;
}
```

### 4.2 HermesNativeProvider Shape

```typescript
// src/lib/runtime/hermes-native/provider.ts
export class HermesNativeProvider implements RuntimeProvider {
  readonly id = "hermes-native" as const;
  readonly label = "Hermes (native)";
  readonly metadata = { id: this.id, label: this.label, runtimeName: "Hermes" };
  readonly capabilities = HERMES_NATIVE_CAPABILITIES; // agents, sessions, chat, etc.
  readonly client: GatewayClient | null = null;  // NO gateway client
  readonly transport: RuntimeTransportMode = "http";

  private snapshotUrl: string;     // e.g. http://localhost:9119
  private pollIntervalMs = 2500;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSnapshot: HermesSnapshot | null = null;
  private eventHandlers = new Set<(e: RuntimeEvent) => void>();
  private statusHandlers = new Set<(s: RuntimeStatus) => void>();
  private status: RuntimeStatus = "disconnected";

  constructor(snapshotUrl: string) { this.snapshotUrl = snapshotUrl; }

  async connect(): Promise<void> {
    this.status = "connecting"; this.notifyStatus();
    // 1. Fetch initial snapshot via /api/hermes/snapshot (server-side proxy)
    this.lastSnapshot = await fetchHermesSnapshot(this.snapshotUrl);
    this.status = "connected"; this.notifyStatus();
    // 2. Synthesize "connected" events from initial snapshot
    this.emitSyntheticConnect(this.lastSnapshot);
    // 3. Start diff poller
    this.pollTimer = setInterval(() => this.pollDiff(), this.pollIntervalMs);
  }

  disconnect(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.status = "disconnected"; this.notifyStatus();
  }

  onRuntimeEvent(handler: (e: RuntimeEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: (s: RuntimeStatus) => void): () => void { /* ... */ }
  onGap(handler): () => void { /* GAP events on 401/timeout sub-fetches */ }
  onEvent(handler): () => void { /* raw EventFrame — NOOP for http transport */ }
  async call<T>(...): Promise<T> { /* forward to REST if needed, else noop */ }

  private async pollDiff(): Promise<void> {
    const next = await fetchHermesSnapshot(this.snapshotUrl);
    const events = diffHermesSnapshots(this.lastSnapshot, next);
    for (const event of events) this.eventHandlers.forEach(h => h(event));
    this.lastSnapshot = next;
  }
}
```

### 4.3 Snapshot Fetcher (server-side proxy)

```typescript
// src/lib/runtime/hermes-native/snapshot.ts
export type HermesSnapshot = {
  at: number;
  truth: "OBSERVED" | "GAP";
  status: { version: string; gateway_state: string; active_sessions: number };
  sessions: SessionNode[];      // from /api/sessions
  profiles: ProfileNode[];      // from /api/profiles
  sessionsStats: SessionsStats; // from /api/sessions/stats
  analytics: unknown;           // from /api/analytics/*
  source: { endpoint: string; status: number; error?: string }[];
};

// Client calls this — it goes through the Next.js route which injects 9119 creds
export async function fetchHermesSnapshot(hermesUrl: string): Promise<HermesSnapshot> {
  const response = await fetch("/api/hermes/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hermesUrl }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Snapshot fetch failed: ${response.status}`);
  return response.json();
}
```

### 4.4 API Route (server-side, holds credential)

```typescript
// src/app/api/hermes/snapshot/route.ts
// Pattern: clone /api/runtime/custom/route.ts
// KEY DIFFERENCE: injects Hermes session cookie server-side
// Browser NEVER sees the cookie.

export async function POST(request: Request) {
  const { hermesUrl } = await request.json();
  const hermesCookie = process.env.HERMES_9119_SESSION_COOKIE || "";
  const baseHeaders = hermesCookie
    ? { Cookie: hermesCookie, Accept: "application/json" }
    : { Accept: "application/json" };

  const results: { endpoint: string; status: number; data?: unknown; error?: string }[] = [];

  // Fan-out fetches (parallel):
  const endpoints = [
    "/api/status",
    "/api/sessions",
    "/api/profiles",
    "/api/sessions/stats",
    "/api/analytics/sessions",
  ];

  const fetches = endpoints.map(async (path) => {
    try {
      const res = await fetch(`${hermesUrl}${path}`, { headers: baseHeaders, cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      results.push({ endpoint: path, status: res.status, data, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (err) {
      results.push({ endpoint: path, status: 0, error: String(err) });
    }
  });
  await Promise.all(fetches);

  // Compose HermesSnapshot
  const statusResult = results.find(r => r.endpoint === "/api/status");
  const snapshot: HermesSnapshot = {
    at: Date.now(),
    truth: results.some(r => r.status >= 400 || r.status === 0) ? "GAP" : "OBSERVED",
    status: statusResult?.data || {},
    sessions: results.find(r => r.endpoint === "/api/sessions")?.data || [],
    profiles: results.find(r => r.endpoint === "/api/profiles")?.data || [],
    sessionsStats: results.find(r => r.endpoint === "/api/sessions/stats")?.data || {},
    analytics: results.find(r => r.endpoint === "/api/analytics/sessions")?.data || null,
    source: results.map(r => ({ endpoint: r.endpoint, status: r.status, error: r.error })),
  };

  return NextResponse.json(snapshot);
}
```

**Auth rule (non-negotiable):** The 9119 session cookie lives in `HERMES_9119_SESSION_COOKIE` env var on the Next server ONLY. The browser calls `/api/hermes/snapshot` (same-origin). The route injects the cookie server-side. Zero cookie exposure to client.

### 4.5 Event Synthesis (diff engine)

```typescript
// src/lib/runtime/hermes-native/eventSynthesis.ts
export function diffHermesSnapshots(
  prev: HermesSnapshot | null,
  next: HermesSnapshot,
): RuntimeEvent[] {
  if (!prev) {
    // Initial connect: emit summary-refresh + floor.populated for each session
    const events: RuntimeEvent[] = [];
    for (const session of next.sessions) {
      events.push({
        type: "run.lifecycle",
        at: next.at,
        // ... mapped from session state
      });
    }
    return events;
  }

  // Diff by stable session ID
  const prevIds = new Set(prev.sessions.map(s => s.id));
  const nextIds = new Set(next.sessions.map(s => s.id));

  const events: RuntimeEvent[] = [];

  // New sessions → run.lifecycle:start
  for (const session of next.sessions) {
    if (!prevIds.has(session.id)) {
      events.push({ type: "run.lifecycle", at: next.at, phase: "start", /* ... */ });
    }
  }

  // Removed sessions → run.lifecycle:end
  for (const session of prev.sessions) {
    if (!nextIds.has(session.id)) {
      events.push({ type: "run.lifecycle", at: next.at, phase: "end", /* ... */ });
    }
  }

  // Changed sessions → summary-refresh with delta
  events.push({ type: "summary-refresh", at: next.at, /* ... */ });

  return events;
}
```

### 4.6 Snapshot → Spatial Projection

```typescript
// src/lib/world/hermesSnapshotProjection.ts
// Translates HermesSnapshot → DynamicFloorDefinition[]
// Reuses resolveRuntimeProjection for agent→worker mapping
// Floor = derived wish grouping (by session metadata, fallback "Ground Floor")
// Never render empty: GAP = greyed floor with "data unavailable" label

export function projectFloorsFromSnapshot(
  snapshot: HermesSnapshot,
  options: RuntimeProjectionOptions,
): DynamicFloorDefinition[] {
  // Group sessions by wish association (heuristic: session.wish_id || "ground")
  // Map each group → floor with rooms, workers, desk items
  // Drogo → rooftop omnipresent, never in a floor
  // GAP sub-fetches → floor rendered with truth=GAP, greyed, labeled
}
```

---

## 5. TEST SLICES

### 5.1 Tests to ADD (Phase A)

| Test file | Count | What it covers |
|---|---|---|
| `tests/unit/hermesNativeProvider.test.ts` | 10+ | `connect()` fetches snapshot, `disconnect()` stops poll, `onRuntimeEvent` receives synthetic events, diff engine emits correct lifecycle events, 401 sub-fetch → GAP status, snapshot URL validation, poll interval honored, `client` is null, `transport` is `"http"`, capabilities match |
| `tests/unit/hermesSnapshotProjection.test.ts` | 8+ | GAP snapshot → greyed floor with label, OBSERVED snapshot → lit floor, empty sessions → empty but present floor, sessions without wish_id → "Ground Floor", sessions with wish_id → named floor, Drogo orchestator excluded from worker list, profiles → wing grouping, truth labeling on every spatial node |
| `tests/unit/hermesSnapshotRoute.test.ts` | 5+ | 200 from all endpoints → OBSERVED truth, 401 from sessions → GAP truth + partial data, missing cookie → graceful fallback, parallel fetches compose correctly, malformed JSON → 400 |
| `tests/unit/useRuntimeConnection.test.ts` | +1 | Add test: hermes-native adapter → HermesNativeProvider |

### 5.2 Tests to UPDATE (Phase C/D)

| Test file | Change | When |
|---|---|---|
| `tests/unit/runtimeProjection.test.ts` | Add test: snapshot-derived projection yields correct floor/room/worker layout. Verify Drogo stays rooftop. | Phase B |
| `tests/unit/useRuntimeConnection.test.ts` | Keep existing 4 tests. `hermes` adapter test continues to pass (old provider still exists until Phase D). | Through Phase C |
| `tests/unit/gatewayBrowserClient.test.ts` | No change (GatewayBrowserClient is WS client, kept for demo/custom providers). | Never delete |
| `tests/unit/gatewayClient.gap.test.ts` | No change (GatewayClient class stays). | Never delete |

### 5.3 Tests to STRIP (Phase D only)

| Test file | OpenClaw references | Action |
|---|---|---|
| `tests/unit/agentSettingsPanel.test.ts` | `adapterType: "openclaw"` on lines 1113, 1160; `source: "openclaw-workspace"` on lines 64, 81, 622 | Replace adapterType with `"hermes-native"`; `source` values are skill catalog keys — keep as-is (they describe skill origin, not adapter) |
| `tests/unit/skillsRemoveLocal.test.ts` | `source: "openclaw-workspace"` on lines 31, 40, 53, 70, 87 | Keep as-is (skill catalog keys, not adapter references) |
| `tests/unit/gatewayReloadMode.test.ts` | None | No change |
| `tests/unit/cronGatewayClient.test.ts` | None | No change |
| Existing runtime workflow tests | Import `EventFrame` / `RuntimeEvent` types | No change — types stay stable |

**Total test delta: ~24 new tests, ~2 test file updates, 0 deletions.**

---

## 6. DELETION CHECKLIST — What gets deleted, in order

### Batch 1: Source files (Phase D)
```
- src/lib/runtime/openclaw/provider.ts
- src/lib/runtime/openclaw/normalizeGatewayEvent.ts
- src/lib/runtime/hermes/provider.ts
```

### Batch 2: Type union entries (Phase D)
```
src/lib/runtime/types.ts:       remove "openclaw" from RuntimeProviderId
src/lib/studio/settings.ts:     remove "openclaw" from StudioGatewayAdapterType
                                  remove "openclaw" from STUDIO_GATEWAY_ADAPTER_TYPES
```

### Batch 3: Factory switch (Phase D)
```
src/lib/runtime/createRuntimeProvider.ts:  remove OpenClawRuntimeProvider import
                                           remove old HermesRuntimeProvider import
                                           remove both switch cases
                                           default: → HermesNativeProvider
```

### Batch 4: Gateway client openclaw-specific logic (Phase D)
```
src/lib/gateway/GatewayClient.ts:
  - resolveGatewayClientName() — remove openclaw-specific branch (line 132-140)
  - isAutoManagedAdapter() — remove "openclaw" from check (line 128)
  - Default adapter normalization — remove OPENCLAW_CONTROL_UI_CLIENT_ID
    and OPENCLAW_WEBCHAT_UI_CLIENT_ID constants (lines 124-125)
```

### Batch 5: Server config paths (Phase D)
```
server/studio-settings.js:
  - Remove NEW_STATE_DIRNAME = ".openclaw" (line 6)
  - Remove OPENCLAW_CONFIG_FILENAME = "openclaw.json" (line 60)
  - Remove openclaw fallback default (line 105, 121-122)

server/gateway-proxy.js:
  - Remove let upstreamAdapterType = "openclaw" (line 192)
  - Default → "hermes-native"
```

### Batch 6: Scripts (Phase D)
```
scripts/claw3doctor.mjs:        remove openclaw CLI checks (lines 176-184,
                                343, 400-407, 477-492)
scripts/lib/claw3doctor-core.mjs: remove adapter defaults (line 54),
                                  remove openclaw adapter from list (line 78),
                                  remove openclaw URL default (line 18)
scripts/studio-setup.js:        remove openclaw CLI detection (lines 18, 59, 65)
```

### Batch 7: Documentation (Phase D)
```
AGENTS.md:             "frontend for OpenClaw" → "frontend for Hermes"
CONTRIBUTING.md:        remove ~/.openclaw reference
CODE_DOCUMENTATION.md:  update sync-openclaw-gateway-client reference
skills-overview.md:     keep skill catalog metadata names (they're catalog keys,
                        not adapter references) — no change needed
.env.example:           CLAW3D_GATEWAY_ADAPTER_TYPE → hermes-native
                        add HERMES_9119_URL and HERMES_9119_SESSION_COOKIE
```

### Batch 8: NEVER DELETE
```
src/lib/gateway/openclaw/GatewayBrowserClient.ts   ← KEEP. It's the WS client
                                                      used by demo + custom
                                                      providers.
src/lib/gateway/GatewayClient.ts                    ← KEEP. Core class.
src/lib/gateway/nodeGatewayClient.ts                ← KEEP. Node-side WS client.
```

---

## 7. PITFALLS / RED FLAGS

1. **`normalizeGatewayEvent` is shared.** Currently imported by both `hermes/provider.ts` AND `openclaw/provider.ts`. During Phase C quarantine, move it to `src/lib/runtime/shared/` so it survives the openclaw deletion. The new native provider does NOT use it (it synthesizes events from snapshot diffs), but the old `hermes` provider needs it until Phase D.

2. **`GatewayClient.readonly client` contract.** Relaxing this to `client | null` is a breaking change to the interface but only in TypeScript — all existing providers (openclaw, hermes, custom, demo) already assign a real client. The custom provider's constructor already handles this. Test: `npm run typecheck` after change must pass.

3. **Session auth cookie for 9119.** Currently 9119 is session-auth gated. The server-side proxy route must receive `HERMES_9119_SESSION_COOKIE` env var. If unset, only `/api/status` will work (unauthenticated). The snapshot `truth` field must reflect this as `GAP` for all auth-gated sub-fetches. Never silently render empty — greyed + labeled.

4. **No wishes endpoint exists.** Hermes 9119 does not expose `/api/wishes`. Floors must be derived heuristically from session metadata (`wish_id` if available, else bucket into "Ground Floor"). Label this as `OBSERVED` (derived), not `VERIFIED`. File a Hermes core ask for stamping sessions with `wish_id`.

5. **Khortex is down.** `/api/khortex/ask` returns `database "brain" does not exist`. Do NOT couple the snapshot fetcher to Khortex. If the analytics endpoint fails, render analytics as `GAP` — never block the tower.

6. **Drogo omnipresence.** Existing `resolveRuntimeProjection` already maps Hermes orchestrator → Drogo server-god (rooftop, `controlSurface: "skyview"`). The snapshot projection must respect this: Drogo appears as rooftop chrome, NEVER as a worker in a floor room. Boundary rule #4.

7. **Browser cookie leak.** The `fetchHermesSnapshot` client function calls `/api/hermes/snapshot` (same-origin). The route handler injects `HERMES_9119_SESSION_COOKIE` server-side. Browser network tab must show ONLY same-origin calls. Zero direct 9119 calls. This is a security proof gate.

8. **WebSocket coupling.** Do NOT create a WS tunnel to 9119. It doesn't expose one. The council is unanimous: HTTP-snapshot-diff substrate, not websocket gateway. Building a fake WS layer over REST recreates the OpenClaw converter mistake.

---

## 8. PROOF GATES (no GO without ALL)

- [ ] Phase A: `npm run typecheck` + `npm run test -- --run` green (7 pre-existing failures acceptable, no NEW)
- [ ] Phase A: `npm run build` green
- [ ] Phase B: Live 9119 → tower renders ≥1 floor, `truth=OBSERVED`, real data from `/api/sessions`
- [ ] Phase B: Browser network tab = ONLY same-origin `/api/hermes/*` calls. Zero direct `localhost:9119` calls. Zero 401 exposed to browser console.
- [ ] Phase B: A 401'd sub-fetch renders a visible `GAP` floor, not blank — tested by killing one endpoint
- [ ] Phase B: 5-second legibility test passes on one floor (who/what visible without clicking)
- [ ] Phase B: Felipe visual QA with native vision + DOM/console/network
- [ ] Phase C: Old providers boot under `LEGACY_RUNTIME=1` for rollback
- [ ] Phase D: `grep -ri openclaw src/` returns zero hits (except docs/)
- [ ] Phase D: `npm run build` has NO `Can't resolve 'openclaw'` warning
- [ ] Phase D: 100% test pass rate (same as pre-migration baseline, 1086/1086 with 7 pre-existing)

---

## 9. SUMMARY

```
Phase A (1 PR):  ADD hermes-native provider, snapshot route, projection, ~24 tests.
                 Relax RuntimeProvider interface. Old code untouched.
Phase B (1 PR):  FLIP default to hermes-native. Provenance proof gates.
                 Felipe visual QA. Mark old providers @deprecated.
Phase C (1 PR):  QUARANTINE old providers behind LEGACY_RUNTIME=1 flag.
                 1 production day of hermes-native running clean.
Phase D (1 PR):  DELETE openclaw/provider.ts, openclaw/normalizeGatewayEvent.ts,
                 hermes/provider.ts. Clean types, server config, scripts, docs.
```

The `RuntimeProvider` interface is the seam — both old and new satisfy it. The renderer never changes during migration. The OpenClaw converter becomes a deletable plugin, not the product spine.
