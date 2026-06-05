# Hermes-native Claw3D State Surface — Protocol + Implementation Plan

Date: 2026-06-05
Repo: `/home/genie/workspace/agents/university/experiments/Claw3D`
Branch: `feat/drogo-skyview-split-20260604`

## User mandate

Replace the current OpenClaw converter spine with a native, stateful Hermes connection via `http://localhost:9119`.

First mode is view-only:

- show what is actually happening on the server;
- every Wish becomes one floor;
- inside each floor, show all agents/profiles/sessions/runs/tasks working in that Wish;
- make the floor legible to a human, not a raw dashboard;
- no interaction/mutation yet.

## Evidence gathered

### 9119 Hermes surface

`http://127.0.0.1:9119` is the Hermes Agent Dashboard process.

Observed endpoints from live dashboard bundle and API probes:

- `/api/status` — Hermes version, gateway status, connected platforms, active session count.
- `/api/system/stats` — host/system stats.
- `/api/sessions?limit=&offset=` — session list with source/model/cost/token/message/tool metadata.
- `/api/sessions/stats` — total sessions/messages and counts by source.
- `/api/profiles` — Hermes profiles, model/provider, gateway state, skill counts.
- `/api/config` — model/fallback/toolsets/config shape.
- `/api/analytics/usage?days=N` and `/api/analytics/models?days=N` exist in dashboard bundle.
- `/api/auth/ws-ticket`, `/api/ws`, `/api/pty` exist in bundle but are dashboard/admin-specific; no confirmed public runtime event stream for Claw3D.

### Khortex/council reality

Attempted real Khortex Ask through `http://127.0.0.1:4179/api/khortex/ask` with `maxBrains:3`.

Result:

```text
data: {"type":"khortex_error","phase":"pipeline","message":"database \"brain\" does not exist"}
```

So real Khortex council is currently blocked by Brain DB availability. The mock SSE contract works, but it is not useful for product decisions.

Fallback council used:

- Gemini seat: protocol/runtime design → `docs/hermes/2026-06-05-hermes-native-council/protocol-runtime.md`.
- Claude/Anthropic seat: spatial/product design → `docs/hermes/2026-06-05-hermes-native-council/spatial-product.md`.
- DeepSeek delegate seats: protocol, spatial product, migration engineering summaries; migration plan saved at `docs/hermes/2026-06-05-hermes-native-council/migration-engineering.md`.

## Core decision

Build a new **Hermes-native state surface** around a server-side snapshot adapter, not another OpenClaw/Gateway converter.

Do **not** force 9119 into the existing OpenClaw websocket `EventFrame` path. That path is the abstraction Felipe wants removed.

## Protocol decision

### Phase 1: HTTP snapshot polling, view-only

```text
Claw3D browser
  -> same-origin GET /api/hermes/snapshot
  -> same-origin poll every ~2.5s

Claw3D Next/Node server
  -> holds Hermes auth/read credential server-side
  -> fetches http://127.0.0.1:9119/api/status
  -> fetches http://127.0.0.1:9119/api/sessions
  -> fetches http://127.0.0.1:9119/api/sessions/stats
  -> fetches http://127.0.0.1:9119/api/profiles
  -> fetches analytics/config/status as needed
  -> composes one normalized HermesSnapshot
```

Rationale:

- The browser must never receive the 9119 session token/cookie.
- Same-origin `/api/hermes/*` makes browser CORS/auth simple and auditable.
- Snapshot first is enough for the first product proof: SEE EVERYONE WORKING.
- Synthetic events can be derived by diffing snapshots.

### Phase 2: Claw3D-owned SSE stream

Add:

```text
GET /api/hermes/stream
```

The Claw3D server polls 9119, diffs snapshots, and emits events:

- `snapshot.refreshed`
- `floor.created`
- `floor.changed`
- `session.started`
- `session.updated`
- `session.ended`
- `worker.entered`
- `worker.moved`
- `run.lifecycle`
- `source.gap`

This is not a Hermes mutation path. It is a projection stream owned by Claw3D.

### Later: native Hermes event source

If Hermes core later exposes scoped read-only `/api/events` or `/api/ws`, Claw3D can swap the source behind the same provider boundary. Do not block this slice on that.

## Snapshot schema

```ts
export type TruthLabel = "OBSERVED" | "VERIFIED" | "GAP" | "SIMULATED";

export type HermesSourceProbe = {
  endpoint: string;
  status: number | "timeout" | "error";
  ok: boolean;
  at: number;
  error?: string;
};

export type HermesSnapshot = {
  at: number;
  truth: TruthLabel;
  server: {
    url: string;
    version: string | null;
    gatewayRunning: boolean | null;
    activeSessions: number | null;
    platforms: Record<string, { state: string; updatedAt?: string | null }>;
  };
  wishes: WishNode[];
  profiles: ProfileNode[];
  sessions: SessionNode[];
  agents: AgentNode[];
  runs: RunNode[];
  tasks: TaskNode[];
  sources: HermesSourceProbe[];
};
```

Important: Phase 1 may not have first-class `wishes`, `runs`, or `tasks` from 9119. Those must be explicit in the schema anyway, with the truth label showing whether they are observed directly, inferred, or unavailable.

## Wish => floor model

Containment hierarchy:

```text
Tower            = one Hermes server at :9119
  Lobby          = server/gateway/platform/profile status
  Floor          = Wish / Goal / active work stream
    Wing         = profile or lane
      Room       = session/thread
        Worker   = profile/agent/run owner avatar
          Desk   = active run/current task/activity
          Board  = tasks/claims/evidence when available
Rooftop/sky      = Drogo server-god projection, omnipresent chrome
```

### Floor keying order

1. Use explicit `wish_id` / `wish_slug` if Hermes exposes it.
2. Else infer from session metadata: title, cwd/workdir, handoff state, source, board/task references, model_config cwd.
3. Else put the session in `unassigned` / `Ground Floor` with `truth: OBSERVED` for the session and `floorTruth: GAP` for the Wish association.

Never label inferred Wish grouping as `VERIFIED`.

### Visual rules

- Floor sign: human title, not UUID.
- Lit windows: active/running sessions.
- Dim windows: idle sessions.
- Warning desk lamp: error/failure/GAP.
- Agent pods/avatars: existing avatar projection; Drogo remains rooftop/server-god, not duplicated into every room.
- Room labels: session title/short id + source (telegram/cli/acp/cron/openui/etc.).
- Desks: current/latest tool/model/work activity, not raw JSON.
- Inspector click: provenance, endpoint status, timestamps, session IDs, costs/tokens if available.

Five-second legibility gate: looking at one floor, Felipe must answer: “who is working here, on what, and is it healthy?” without opening JSON.

## Immediate data needs from 9119

Buildable now:

- Server/lobby: `/api/status`, `/api/system/stats`.
- Wings/profiles: `/api/profiles`.
- Rooms/sessions: `/api/sessions?limit=...`.
- Occupancy metrics: `/api/sessions/stats`.
- Cost/model heat: `/api/analytics/usage?days=1`, `/api/analytics/models?days=1` if endpoint responds cleanly.

Missing/desired from Hermes core:

- read-only scoped observability key/session for headless Claw3D server;
- first-class `/api/wishes` or `wish_id` association on sessions/runs;
- first-class `/api/runs` and `/api/tasks` or joinable run/task fields;
- read-only event stream `/api/events` once available.

## Code migration plan

### Phase A — Add, no deletion

Add new native path in parallel:

- `src/app/api/hermes/snapshot/route.ts`
  - server-side 9119 fetcher;
  - endpoint allowlist;
  - server-only auth/token handling;
  - per-source status/provenance;
  - no POST/mutation.

- `src/lib/runtime/hermes-native/provider.ts`
  - `RuntimeProvider` implementation backed by HTTP snapshots;
  - `connect()` starts polling;
  - `disconnect()` stops polling;
  - `call("hermes.snapshot")` returns current snapshot;
  - `onRuntimeEvent()` emits `summary-refresh` and synthetic lifecycle events from snapshot diffs.

- `src/lib/world/hermesSnapshotProjection.ts`
  - maps `HermesSnapshot -> floors/rooms/workers/desks`;
  - truth labels on every object;
  - Drogo rooftop/omnipresent policy.

- Register provider in `createRuntimeProvider.ts` under `hermes-native` or current `hermes` with feature flag.

Potential type seam:

- Current `RuntimeProvider` requires `readonly client: GatewayClient`.
- HTTP-native provider should not need a GatewayClient.
- Options:
  1. relax to `readonly client?: GatewayClient | null`; or
  2. supply a tiny no-op adapter that satisfies the field while Phase A proves.
- Prefer relaxing the interface if tests show downstream callers tolerate it.

### Phase B — Prove

- Local snapshot endpoint returns at least server/profile/session data from real 9119.
- Browser page renders at least one real observed floor/room from sessions.
- No direct browser calls to `localhost:9119`.
- No 9119 token/cookie in browser network payloads.
- Console/API clean.
- Typecheck/build/tests pass.

### Phase C — Flip default

- Make `hermes-native` the default runtime path for Claw3D.
- Keep OpenClaw path behind explicit `LEGACY_RUNTIME=1`.
- Stop running `hermes-gateway-adapter.js` for the normal Hermes view-only mode.

### Phase D — Quarantine/delete

Only after a clean proving window:

- delete or quarantine `src/lib/runtime/openclaw/*`;
- delete old `src/lib/runtime/hermes/provider.ts` if it only wraps OpenClaw `EventFrame`;
- remove OpenClaw-specific docs/config/build warning expectations;
- update `AGENTS.md` product boundary from “frontend for OpenClaw” to “Hermes-native spatial runtime projection” only when that is true.

## First implementation slice

Build only the protocol and projection spine:

1. Add read-only `/api/hermes/snapshot`.
2. Add `HermesSnapshot` types and projection mapper.
3. Add provider skeleton or direct hook consuming snapshot.
4. Render a minimal `Hermes Tower` state in existing Claw3D surface:
   - Lobby = server status.
   - One floor per derived Wish group.
   - One room per session.
   - One worker per profile/session owner.
   - Truth labels visible: `OBSERVED` / `GAP`.
5. Verify with local browser:
   - network only same-origin `/api/hermes/snapshot`;
   - console clean;
   - floor count and session count match `/api/sessions` payload;
   - screenshot/vision proof.

Do not add interactions yet.

## Red flags

- Forcing 9119 through OpenClaw websocket/EventFrame normalization.
- Leaking Hermes dashboard session token/cookie into the browser.
- Rendering empty floors when an endpoint 401s/timeouts; should be `GAP`, not “nobody working”.
- Calling inferred Wish grouping verified.
- Duplicating Drogo into every floor; Drogo is rooftop/skyview chrome.
- Blocking Claw3D on Khortex; Khortex is currently unhealthy.
- Deleting OpenClaw before Hermes-native proof.
- Raw JSON as the product surface.

## Proof target for first slice

Local runtime at `/office` visibly shows:

```text
Hermes Tower — OBSERVED
source: http://localhost:9119
Lobby: Hermes 0.15.1, gateway running, connected platforms
Floor: <derived Wish / Unassigned>
Room: <real session title/source/model>
Worker: <profile/agent/session owner>
truth: OBSERVED for session, GAP if Wish association inferred/unavailable
```

The proof is not complete until browser console is clean and the API/source counts match the rendered tower.
