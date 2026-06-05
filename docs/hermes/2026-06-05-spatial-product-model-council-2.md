# Council Seat 2: Spatial Product Model — Wish Floors Design

Date: 2026-06-05
Council seat: 2 (spatial product model)
Deliverable: Decisive design recommendations

## 1. Protocol Shape: Claw3D ↔ Hermes 9119

**Decision: Direct HTTP REST poll, not WebSocket.**

The current adapter path (`server/hermes-gateway-adapter.js` → `ws://localhost:18789`) is a transitional shim. The `RuntimeProvider` abstraction already supports the right seam — but the Hermes provider still speaks Gateway WebSocket protocol to the adapter, not Hermes's real state.

Replace the adapter path with a new `HermesStateProvider` that polls Hermes's REST API at `http://localhost:9119`:

```
HermesStateProvider (new, implements RuntimeProvider)
  │
  ├─ on connect: fetch snapshot from /api/status + /api/sessions + /api/profiles
  ├─ on poll loop (every 2s): re-fetch snapshot, diff against last known
  └─ emit RuntimeEvent stream from diffs
```

**Why REST poll, not WebSocket:**
- Hermes 9119 has no event stream today — it's request/response.
- Adding a poll loop inside the provider is practical (2s cadence, ~50 API calls/min, negligible load).
- The `RuntimeProvider` contract already supports this pattern — `onEvent` / `onRuntimeEvent` handlers get called when state changes.
- WebSocket bidirectional event feed can be added to Hermes later; the provider interface won't change.

**Auth gateway:**
Most Hermes API endpoints return 401 (`/api/profiles`, `/api/sessions`, `/api/system/stats`). The `/api/status` endpoint works without auth but only returns aggregate info, not agent/session detail. Claw3D needs a session-authenticated channel.

Two options (pick one before MVP work starts):
- **A (quickest):** Add a `?auth=claw3d-readonly` query param + a Claw3D-local API key to Hermes's auth middleware so Claw3D's localhost origin is trusted.
- **B (correct):** Implement Hermes session auth in Claw3D — store a Hermes session token, attach as `Authorization: Bearer <token>` header on all REST calls.

Recommend A for MVP, B for production.

## 2. Snapshot + Event Stream Model

**Shape:**

```typescript
type WishSnapshot = {
  wishId: string;
  wishTitle: string;
  system: {
    activeSessions: number;
    gatewayState: "running" | "stopped";
    profiles: ProfileSnapshot[];
  };
  sessions: SessionSnapshot[];
  runs: RunSnapshot[];
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
};

type ProfileSnapshot = {
  name: string;
  active: boolean;
  sessionCount: number;
};

type SessionSnapshot = {
  key: string;
  agentId: string;
  profileName?: string;
  model: string | null;
  thinkingLevel: string | null;
  status: "idle" | "running" | "error";
  activityAt: number | null;
};

type RunSnapshot = {
  id: string;
  sessionKey: string;
  phase: "start" | "end" | "error" | "running";
  startedAt: number;
  durationMs: number | null;
};

type AgentSnapshot = {
  id: string;
  name: string;
  role: string | null;
  profileName: string;
  status: "idle" | "working" | "error";
  sessionKey: string;
};

type TaskSnapshot = {
  id: string;
  agentId: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
};
```

**Event diff model:**
On each poll, compare new snapshot against previous. Emit:
- `wish.updated` — new wish data (new wish ID = new floor)
- `agent.spawned` / `agent.dismissed` / `agent.status_changed`
- `session.created` / `session.updated` / `session.closed`
- `run.started` / `run.ended` / `run.errored`
- `task.assigned` / `task.progressed` / `task.completed`

The `HermesStateProvider` normalizes these into `EventFrame` objects that flow through the existing `normalizeGatewayEvent` pipeline, so the UI (AgentStore, runtimeProjection) doesn't change.

## 3. Wish → Floor Model

**Decision: one Wish = one animated floor.**

Extend the existing `FloorDefinition` model:

```typescript
type WishFloorDefinition = FloorDefinition & {
  kind: "wish";
  wishId: string;
  wishTitle: string;
  wishCreatedAt: number;
  wishStatus: "active" | "completed" | "archived";
};
```

**How floors are discovered:**
The `HermesStateProvider` on connect calls Hermes's (future) `/api/wishes` endpoint that lists active wish IDs + titles. Each wish becomes a floor in the building directory.

**Floor layout — spatial zones per floor:**

Each Wish Floor is a rectangular 3D room divided into zones:

| Zone | What lives there | Visual |
|------|-----------------|--------|
| **Agent pods** (left/middle) | Agent avatars at desks. Each desk shows agent name, role, status. Agent walks when active, sits when idle. | Same as current OfficeAgent with projection metadata |
| **Session wall** (back wall) | Vertical columns — each column is one session. Height = activity. Color = status (green=active, amber=idle, red=error). Text label = session key summary. | 3D bar chart as readable wall |
| **Run conveyor** (center floor) | Horizontal conveyor belt. Each run = a labeled box moving left→right. Boxes start at spawn and progress to completion. Color = phase. | Animated conveyor with labeled boxes |
| **Task board** (right wall) | 3D kanban board. Columns: Pending, In Progress, Completed. Tasks are floating cards. Cards animate between columns. | 3D kanban with card movement |
| **Profile indicator** (ceiling) | Overhead marquee showing active profile name + model + session count | Small text panel |

**Floor switching:**
Building Directory already exists (`OfficeFloorNav`). Clicking a Wish floor name switches the 3D camera into that floor's room. The `FloorRoster` cache populates with agents from that wish's snapshot.

## 4. Readable 3D Object Hierarchy

Each object type gets a clear visual grammar:

### Agent (person-shaped)
```
┌──────────────────────┐
│  🧑 Agent name       │  ← Billboard label (always faces camera)
│  📋 Role             │
│  🔵 Status: working  │  ← Color dot
│  📊 Session: main    │
└──────────────────────┘
     \│/
      │   ← Avatar with projection halo
     /│\
```

**States:**
- **idle**: standing at desk, slight bob animation
- **working**: walking path around floor, typing animation
- **error**: red pulse, standing still

### Session (wall column)
```
     ┌──────────┐
     │ Session  │
     │ agent:h..│  ← Truncated key
     │ model    │
     │ 🟢       │  ← Status fill color
     │ ──────── │  ← Activity bar (height = last activity age)
     └──────────┘
```

### Run (conveyor box)
```
  ┌──────────────┐
  │ Run #abc123  │
  │ phase: start │
  │ 3s ago       │
  │ 🟡 running   │
  └──────────────┘
```

### Task (kanban card)
```
  ┌──────────────┐
  │ 📝 Task desc │
  │ Agent: name  │
  │ Status: ▶️    │
  └──────────────┘
```

## 5. Data Needed Immediately vs Later

**Immediately (MVP):**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/status` | Gateway health, active session count, platforms status (already works) |
| `GET /api/profiles` | List profiles with active flag & session counts |
| `GET /api/sessions` | Session keys, agent IDs, models, status, activity timestamps |
| `GET /api/sessions/stats` | Per-session activity metrics |

**Later (post-MVP):**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/wishes` | List active Wish IDs (source of floor definitions) |
| `GET /api/wishes/:id` | Per-wish snapshot with sessions/agents/tasks |
| `GET /api/events/stream` | SSE event stream for live updates (replace poll) |
| `GET /api/agents/:id/runs` | Run history per agent |
| `GET /api/agents/:id/tasks` | Task list per agent |

**Critical gap for MVP:** Hermes 9119 doesn't expose a `wishes` concept today. The Wish → floor mapping needs a Hermes-side data source. Until that endpoint exists, Claw3D can:
- **Phase 0 (now):** Read wish IDs from the file system (`/home/genie/.hermes/wishes/` or the brain wishes folder). This gives real wish IDs immediately without waiting for API changes.
- **Phase 1 (later):** Switch to API endpoint when Hermes exposes it.

## 6. Migration Plan to Strip OpenClaw Converter

**Phase 1 — Add, don't remove (MVP):**
1. Create `src/lib/runtime/hermes-state/provider.ts` — new `HermesStateProvider` class implementing `RuntimeProvider`
2. It polls Hermes :9119 REST API for snapshot data
3. It emits normalized `EventFrame` objects through existing pipeline
4. Add `"hermes-state"` to the providerId union and `createRuntimeProvider`
5. Register it in `createRuntimeProvider` switch case
6. Keep existing `hermes` provider (adapter-based) as fallback during transition

**Phase 2 — Wire the Wish floor model:**
1. Read wish IDs from filesystem as initial floor list
2. Populate each wish floor with agents/sessions from Hermes snapshot
3. Add the 3D object types (session wall, run conveyor, task board) to `RetroOffice3D`

**Phase 3 — Prove it works end-to-end:**
1. Browser proof: Claw3D shows a real running session as a 3D agent
2. Browser proof: switching between wish floors shows different agent rosters
3. Console proof: no red errors from the new provider path

**Phase 4 — Deprecate the adapter path:**
1. Remove `hermes` provider from `createRuntimeProvider` (or redirect to `hermes-state`)
2. Remove `server/hermes-gateway-adapter.js`
3. Remove `npm run hermes-adapter` script

**Phase 5 — Delete OpenClaw converter:**
1. Remove `normalizeGatewayEvent` from Hermes path
2. Remove OpenClaw-specific EventFrame normalization for Hermes events
3. Delete `src/lib/runtime/openclaw/` when no OpenClaw floor remains active

## 7. Red Flags / Pitfalls / Proof Gates

### Red Flags
1. **Auth wall on 9119**: `/api/profiles`, `/api/sessions`, `/api/system/stats` all return 401. MVP blocked until auth is solved. Priority #1.
2. **No wishes API on Hermes**: The Wish → floor concept has no Hermes-side data source. Filesystem read is a workaround, not permanent.
3. **Session auth complexity**: Hermes session auth uses token-based authentication. Claw3D currently doesn't store Hermes session tokens — it would need to implement the login flow.
4. **Poll latency**: 2-second poll means up to 2-second delay between real state change and visual update. Acceptable for view-only MVP but notable.

### Pitfalls
1. **Don't reuse the adapter's agent registry**: The adapter maintains its own `agentRegistry` Map — the new provider must read Hermes's real agent list, not the adapter's local copy.
2. **Don't break the existing lobby/demo floors**: The lobby and demo floors must keep working while Hermes-state is added in parallel.
3. **3D object count**: A busy Hermes instance could have 20+ sessions, each with runs — the conveyor and task board must handle this without jank. Cap visible objects per floor at 50 total.
4. **Floor definition explosion**: If wishes are auto-discovered, the floor list could grow unboundedly. Show only active/recent wishes (last 7 days) by default.

### Proof Gates (what MVP must prove)
1. **Real data gate**: Claw3D renders at least one agent sourced from a real Hermes session (not the adapter's local registry). The agent's name, role, and status match what Hermes reports at :9119.
2. **Multi-agent gate**: Two agents from different profiles/sessions appear in the same floor simultaneously, each with correct identity.
3. **Status liveness gate**: An agent's 3D avatar transitions from idle → working → idle within 5 seconds of the real Hermes session state changing.
4. **Floor switching gate**: Clicking between two different floor entries changes the visible agent roster without page reload or WS reconnect.
5. **No adapter dependency gate**: The proof must work with `npm run hermes-adapter` NOT running — only Hermes dashboard :9119 must be live.
6. **Console cleanliness gate**: Zero new console errors from the `HermesStateProvider` path. Pre-existing Three.js/WebGL noise is pre-waived but must not worsen.

## 8. Decisive Architecture Diagram

```
                    ┌─────────────────────────┐
                    │  Hermes Dashboard :9119  │
                    │  /api/status             │
                    │  /api/profiles (auth)    │
                    │  /api/sessions (auth)    │
                    │  /api/sessions/stats     │
                    │  /api/wishes (future)    │
                    └──────────┬──────────────┘
                               │ HTTP REST (poll every 2s)
                               ▼
┌──────────────────────────────────────────────────────────┐
│  HermesStateProvider (new)                               │
│  implements RuntimeProvider                              │
│                                                          │
│  connect() → fetch snapshot, start poll loop            │
│  disconnect() → stop poll loop                          │
│  call(method) → proxy to Hermes REST                    │
│  onEvent() → diff snapshot → emit EventFrames           │
└──────────────────────┬───────────────────────────────────┘
                       │ EventFrame stream (existing contract)
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Existing pipeline (unchanged)                           │
│                                                          │
│  normalizeGatewayEvent()                                 │
│    → RuntimeEvent                                       │
│    → AgentStore reducer                                  │
│    → runtimeProjection.ts                                │
│    → OfficeAgent projection                             │
│    → FloorRoster entries                                │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Spatial Product Model (new 3D objects)                  │
│                                                          │
│  Wish Floor canvas                                      │
│  ├─ Agent pods (left)     ← existing agent avatars      │
│  ├─ Session wall (back)   ← NEW: 3D bar chart           │
│  ├─ Run conveyor (center) ← NEW: animated boxes         │
│  ├─ Task board (right)    ← NEW: 3D kanban              │
│  └─ Profile marquee (top) ← NEW: overhead text          │
│                                                          │
│  Building Directory (existing, extended)                 │
│  ├─ Wish Floor 1 (active)                               │
│  ├─ Wish Floor 2 (active)                               │
│  ├─ Lobby (demo)                                        │
│  └─ ...                                                 │
└──────────────────────────────────────────────────────────┘
```

## 9. First Action — What to Build Now

**Single concrete next action:** Create `src/lib/runtime/hermes-state/provider.ts` that:
1. Implements `RuntimeProvider`
2. On `connect()`, polls `http://localhost:9119/api/status` every 2 seconds
3. Parses the response (already works without auth) and emits a single `summary-refresh` RuntimeEvent
4. Register as `"hermes-state"` provider in `createRuntimeProvider`
5. Prove it with a simple log: `[hermes-state] gateway state: running, active sessions: 2`

This proves the connectivity path works before any spatial model work begins.

## Summary

| Decision | Choice |
|----------|--------|
| Protocol | HTTP REST poll (2s), not WebSocket adapter |
| Auth for MVP | Query param API key on Hermes side (fastest) |
| Floor model | One wish = one floor, discovered from filesystem initially, API later |
| 3D objects on floor | Agent pods (existing), Session wall (bar chart), Run conveyor (boxes), Task board (kanban) |
| MVP must prove | Real Hermes data → 3D agent rendering, multi-agent floor, status liveness, no adapter dependency, clean console |
| Migration | Add HermesStateProvider in parallel, deprecate adapter after proof, then delete OpenClaw converter |
| First action | Create `HermesStateProvider` that polls :9119 and emits events — prove connection before spatial work |
