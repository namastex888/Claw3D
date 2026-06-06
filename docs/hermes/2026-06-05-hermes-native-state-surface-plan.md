# Khaw Tower — Hermes-native Protocol + Implementation Plan

Date: 2026-06-05
Repo: `/home/genie/workspace/agents/university/experiments/Claw3D`
Branch: `feat/drogo-skyview-split-20260604`

## Product naming update

The product name is **Khaw Tower**.

- A **Khaw Tower** is one spatial/business-tower instance plugged into one local Hermes server through the native read-only protocol.
- **Hermes** remains the runtime/server substrate and protocol source, not the product name shown to the user.
- The default local profile/persona is the **Tower President**: the executive building intelligence for this Khaw Tower instance. In local development this role is currently embodied by Drogo, but the product metaphor is business-tower president/operator rather than server-god.
- The Tower President is not a normal worker duplicated across floors. The President appears through lobby/elevator/chrome, executive notices, inspections, and explicit manifestations.
- The first two top-level lanes/elevator banks are **Office** and **Labs / University**. Later, Khaw Tower should federate more lanes and squads such as Platform, Desktop, FDE Operations, product squads, and customer/field operations.

Canonical product-model addendum: `docs/hermes/2026-06-05-khaw-tower-product-model.md`.

## User mandate

Replace the current OpenClaw converter spine with a native, stateful Hermes connection via `http://localhost:9119`, projected as Khaw Tower.

First mode is view-only:

- show what is actually happening on the server;
- every Wish becomes one floor within a top-level lane/elevator bank such as Office or Labs / University;
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

export type KhawTowerLaneId = "office" | "labs-university" | "ops" | "platform" | "desktop" | "fde-operations" | "unknown";

export type WishPlacement = {
  laneId: KhawTowerLaneId;
  laneLabel: string;
  squadId?: string;
  squadLabel?: string;
  floorCode?: string;
  source: "wish-frontmatter" | "path-rule" | "repo-rule" | "session-inference" | "manual-override" | "unknown";
  truth: TruthLabel;
};

export type KhawTowerProjection = {
  lanes: LaneNode[];
  floors: WishFloorNode[];
  rooms: RoomNode[];
  personas: PersonaNode[];
  workers: WorkerNode[];
  desks: DeskNode[];
  artifacts: ArtifactNode[];
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
  khawTower: KhawTowerProjection;
  sources: HermesSourceProbe[];
};
```

Important: Phase 1 may not have first-class `wishes`, `runs`, or `tasks` from 9119. Those must be explicit in the schema anyway, with the truth label showing whether they are observed directly, inferred, or unavailable.

## Khaw Tower containment model

Containment hierarchy:

```text
Khaw Tower        = one local spatial instance bound to one Hermes server at :9119
  Tower President = default profile/persona; executive building intelligence/operator
  Lobby           = entrance, reception/status wall, elevator bank, server/wire health
    Elevator Bank = top-level lane/category selector
      Office      = business/product/customer/operator work lane
      Labs        = University/research/training/prototype lane
      Future      = federated lanes/squads: Platform, Desktop, FDE Ops, product squads, etc.
  Floor           = one Wish / Goal / active workstream inside a lane
    Department    = role lane inside a Wish: Orchestration, Engineering, Dogfood, Review, Release
      Room        = session/thread/work context
        Persona   = stable identity/role/character assigned to work
        Worker    = actual execution body: model process, coding agent, cron, browser run
          Desk    = current/latest task, tool, file, proof, activity surface
          Board   = tasks/claims/evidence/artifacts when available
```

The Tower President replaces the earlier `server-god` language. It is the same operational idea—one executive presence for one Hermes-backed tower—but business-tower native: president, operator, concierge, PA system, inspector, and executive control surface.

### Lane / elevator-bank model

Lanes are durable categories above individual Wish floors. They should be visible in the Lobby as elevator banks, not flattened into the same list as transient Wish floors.

Initial lanes:

- `office` — KHAL Office work: products, customer/operator flows, Eugenia, Gupshup, deploy/release, live business operations.
- `labs-university` — Labs / University work: Claw3D/Khaw Tower R&D, learning society, faculty roles, curriculum, experiments, prototypes.

Future federated lanes/squads:

- `platform` — platform/runtime/source-access/app-registry work.
- `desktop` — desktop/native client surfaces.
- `fde-operations` — field/customer deployment and operations.
- product/customer squads — one lane or squad group per durable business/product domain.

The abstraction should support both:

```text
Lane -> Wish floors
Lane -> Squad -> Wish floors
```

without requiring the UI to rename every Wish or hard-code every future squad.

### Wish placement order

1. Use explicit Wish frontmatter/metadata if present: `lane`, `squad`, `product`, `wish_id`, `wish_slug`.
2. Else use durable path rules, for example University brain/wish paths map to `labs-university`.
3. Else use explicit repo/product rules, for example Claw3D/Khaw Tower maps to `labs-university`; Eugenia/Gupshup/release operations map to `office` unless superseded by metadata.
4. Else infer from session metadata: title, cwd/workdir, handoff state, source, board/task references, model_config cwd.
5. Else put the session in `unknown` / `Ground Floor` with `truth: OBSERVED` for the session and `placement.truth: GAP` for the lane/Wish association.

Never label inferred lane, squad, or Wish grouping as `VERIFIED`.

### Floor keying order

1. Use explicit `wish_id` / `wish_slug` if Hermes exposes it.
2. Else infer from session metadata: title, cwd/workdir, handoff state, source, board/task references, model_config cwd.
3. Else put the session in `unassigned` / `Ground Floor` with `truth: OBSERVED` for the session and `floorTruth: GAP` for the Wish association.

Never label inferred Wish grouping as `VERIFIED`.

### Visual rules

- Product title: `Khaw Tower`, not `Hermes Tower`.
- Lobby: Lumon/business-tower entrance, reception/status wall, and elevator banks for lanes.
- Elevator bank signs: `Office`, `Labs / University`, and later federated squads/lanes.
- Floor sign: human Wish/workstream title, not UUID.
- Lit windows: active/running sessions.
- Dim windows: idle sessions.
- Warning desk lamp: error/failure/GAP.
- Persona/worker split: persona is the stable role/identity; worker is the actual executing process/model/session.
- Tower President: executive chrome/presence for the whole Khaw Tower; do not duplicate into every room as a normal worker.
- Room labels: session title/short id + source (telegram/cli/acp/cron/openui/etc.).
- Desks: current/latest tool/model/work activity, not raw JSON.
- Inspector click: provenance, endpoint status, timestamps, session IDs, costs/tokens if available.

Five-second legibility gate: looking at one floor, Felipe must answer: “who is working here, on what, and is it healthy?” without opening JSON.

## Immediate data needs from 9119

Buildable now:

- Server/lobby: `/api/status`, `/api/system/stats`.
- Lanes/personas/profiles: `/api/profiles` plus placement rules/frontmatter/overrides.
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
  - maps `HermesSnapshot -> KhawTowerProjection`;
  - groups Wish floors under lane/elevator-bank placement (`office`, `labs-university`, later federated lanes/squads);
  - separates persona projections from worker/execution projections;
  - truth labels on every object;
  - Tower President policy: one executive building presence, not duplicated as a normal worker.

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
4. Render a minimal `Khaw Tower` state in existing Claw3D surface:
   - Lobby = business-tower entrance plus server/wire status.
   - Elevator banks = `Office` and `Labs / University`.
   - One floor per derived Wish group inside a lane.
   - One room per session.
   - Persona + worker split visible where data allows.
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
- Duplicating the Tower President into every floor; the President is tower-level executive chrome/presence.
- Blocking Claw3D on Khortex; Khortex is currently unhealthy.
- Deleting OpenClaw before Hermes-native proof.
- Raw JSON as the product surface.

## Proof target for first slice

Local runtime at `/office` visibly shows:

```text
Khaw Tower — OBSERVED
source: http://localhost:9119
Lobby: Hermes 0.15.1, gateway running, connected platforms
Elevator bank: Office / Labs-University / Unknown
Floor: <derived Wish / Unassigned> inside its lane
Room: <real session title/source/model>
Persona: <stable role/profile where known>
Worker: <actual session/model/process where known>
truth: OBSERVED for session, GAP if lane/Wish association inferred/unavailable
```

The proof is not complete until browser console is clean and the API/source counts match the rendered tower.
