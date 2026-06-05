I have everything I need. The 9119 API is pure HTTP/REST, session-auth gated (no `www-authenticate`, no SSE stream that I could probe unauthenticated), with no public WebSocket. The codebase already has the exact substrate (`/api/runtime/custom` HTTP proxy) plus a clean `RuntimeProvider` contract. The boundary doc explicitly authorizes a *new* provider rather than extending the OpenClaw converter. Here is my council seat verdict.

---

# COUNCIL SEAT: SPATIAL-PRODUCT — Claw3D Hermes-Native State Surface

## Verdict in one line
9119 is an HTTP REST dashboard with session auth and **no public websocket**. Do **not** force it through the gateway/`EventFrame` path. Build a **new `src/lib/runtime/hermes-native/provider.ts`** that uses the existing `/api/runtime/custom` HTTP-proxy substrate, snapshots over REST, and synthesizes the event stream by diffing. The OpenClaw converter becomes a deletable plugin, not the product spine. The spatial model is **Wish→Floor, Profile→Wing, Session→Room, Run→Desk-activity, Agent→Worker, Task→Work-item-on-desk**.

---

## 1. Protocol shape between Claw3D server and Hermes 9119

**Decision: Server-side HTTP polling proxy + client-side synthetic event bus. No websocket to 9119.**

Evidence forcing this: every deep endpoint returned `401` raw; `/api/status` is the only unauthenticated body; there is no `www-authenticate` or SSE handshake exposed. 9119 is a session-cookie REST surface. The gateway `RuntimeProvider` contract (`onEvent(EventFrame)`, `GatewayClient.connect`) is websocket-shaped and openclaw-normalized — wrong impedance.

Protocol stack:
```
Claw3D browser
  → same-origin GET /api/hermes/snapshot   (Next route, server-side)
  → same-origin GET /api/hermes/stream      (SSE the SERVER emits, optional phase 2)
Claw3D Next server (server/index.js + route handler)
  → holds the 9119 session credential server-side ONLY
  → fan-out fetch: /api/status, /api/sessions, /api/sessions/stats,
                   /api/profiles, /api/analytics/*
  → composes ONE normalized HermesSnapshot
  → never exposes the raw cookie to the browser
```

Reuse `requestCustomRuntime` semantics (`/api/runtime/custom` already proxies arbitrary `{runtimeUrl, pathname, method, body}` server-side and strips the auth boundary). Clone it to a dedicated `/api/hermes/*` route so the Hermes credential and the 9119 base URL live server-side, host-aware (matches your existing host-aware gateway-defaults slice).

**Auth rule (proof gate):** the browser must never hold the 9119 session cookie. Credential injection happens in the Next server route. This is non-negotiable for a tool that "shows everyone working" — it's an observability god-view.

---

## 2. Snapshot + event stream model

**Decision: Snapshot is canonical truth. Events are DERIVED by server-side diff, not consumed from 9119.**

Because 9119 gives no event stream, Claw3D **owns** the temporal layer:

```ts
type HermesSnapshot = {
  at: number;                 // server fetch timestamp
  truth: "OBSERVED" | "GAP";  // GAP if any sub-fetch 401/timeouts
  wishes: WishNode[];         // floors
  profiles: ProfileNode[];    // wings
  sessions: SessionNode[];    // rooms
  runs: RunNode[];            // desk activity
  agents: AgentNode[];        // workers
  tasks: TaskNode[];          // work-items
  source: { endpoint: string; status: number }[]; // provenance per fetch
};
```

Event synthesis loop (server-side, ~2–3s poll):
1. Fetch snapshot N.
2. Diff against snapshot N-1 keyed by stable IDs.
3. Emit synthetic `RuntimeEvent`s mapped onto your **existing** union: `run.lifecycle` (start/end/error), `summary-refresh`, plus two new spatial events `floor.populated` / `worker.moved`.
4. Push to browser via SSE (`/api/hermes/stream`) or, phase-1, just let the client poll the snapshot and diff client-side.

**Truth labeling is mandatory** (your projection layer already has `OBSERVED | SIMULATED | VERIFIED | GAP`). Any floor built from a 401'd sub-fetch is rendered `GAP`, greyed, labeled "data unavailable" — never silently empty. This is the Felipe "fixed needs runtime proof; contradictions=admit incomplete" law applied to spatial rendering.

**Phase-1 cadence:** 2500ms snapshot poll, client-side diff. Phase-2: server SSE. Do not build websocket-to-9119 — it doesn't exist and inventing one is the OpenClaw mistake repeated.

---

## 3. How to model Wish ⇒ Floor

**Decision: Floor = Wish. The Wish is the organizing spatial primitive; everything else is furniture inside it.**

Hard problem: 9119 may not yet expose `/api/wishes` as a first-class object (it 401'd, unconfirmed it even exists). So:

- **Immediate (data we have):** Derive the floor key from session/run metadata. Sessions and runs in Hermes carry a wish/board/workdir association. Group by that key. If absent, bucket into a single **"Ground Floor / Unassigned"** so the building is never empty.
- **Floor identity:** `floorId = wishSlug` (stable, human-readable). Floor **sign** shows the wish title, not a UUID — "a human can understand what is going on."
- **Floor must be legible, not a dashboard:** one floor = one glass-walled level in the tower. Occupancy at a glance: lit windows = active runs, dark = idle, red = errored. Felipe should read the *building silhouette* and know the server's state before reading a single label. That's the AoE-resource-bar instinct applied to architecture: real labels, per-state color, compact chrome, detail on hover/click.
- **Vertical order:** most-active wish on a readable mid-floor; pin Drogo's server-god projection as the **rooftop/omnipresent** layer (your existing `omnipresent: true, controlSurface: "skyview"` already encodes this — do not duplicate Drogo into a floor; he watches over all of them).

**Do not** let Drogo omnipresence mutate the per-floor agent list (boundary doc rule #4). Drogo is chrome over the tower, not a worker in a room.

---

## 4. Mapping agents/sessions/tasks/runs/events to readable spatial objects

**Decision: a strict containment hierarchy, each level a real spatial container.**

```
Tower            = the Hermes server (one 9119)
 └ Floor         = Wish              (sign = wish title; lit/dark/red windows)
    └ Wing       = Profile           (color-coded zone; e.g. default vs university)
       └ Room    = Session           (door label = session title/short id)
          └ Worker = Agent/run owner (avatar = role; Drogo excluded, he's rooftop)
             └ Desk-item = Task      (item on the desk; ✓ done, ◷ pending, ✗ error)
          └ Desk-activity = Run      (typing animation = chat.delta; idle = no active run)
```

Concrete mapping rules (bind to your `runtimeProjection.ts`):
- **Agent → Worker:** reuse `resolveRuntimeProjection`. Orchestrator/Hermes → Drogo server-god (rooftop). Everything else → `runtime-agent` in a room. Avatar from role.
- **Session → Room:** a room exists iff a session exists. Empty session = furnished but unoccupied room (do not delete; absence is information).
- **Run → animated desk activity:** map your existing `RuntimeChatEvent` — `chat.delta` = worker typing, `chat.final` = leans back, `chat.error` = red desk lamp, `run.lifecycle:start` = worker sits down, `:end` = stands up.
- **Task → desk work-item:** discrete object with status glyph + truth color. Tasks are the most legible "what's actually happening" signal — make them the readable foreground.
- **Event → motion, never new UI panels:** events drive *animation deltas only*. No event spawns a chart popup. Detail-on-demand (hover/click a room) opens a real inspector with provenance (which 9119 endpoint, fetch status, timestamp) — never raw JSON dumped on the floor. (Felipe: hover/click detail = real charts/provenance dashboard, not raw JSON.)

**Legibility test (proof gate):** a human looking at one floor for 5 seconds must be able to answer "is anyone working here, who, and on what?" without clicking. If they can't, the spatial model failed.

---

## 5. What Claw3D needs from Hermes — now vs later

**IMMEDIATE (build floors today — all already exist, just 401-gated):**
| Need | Endpoint | Maps to |
|---|---|---|
| Server liveness/header chrome | `/api/status` (public) | Tower exists |
| Rooms + occupants | `/api/sessions` | Session→Room, Agent→Worker |
| Occupancy stats / lit-window logic | `/api/sessions/stats` | Floor silhouette |
| Wings | `/api/profiles` | Profile→Wing |
| Floor activity intensity | `/api/analytics/*` | per-floor heat |

**REQUIRED-BUT-MISSING (request from Hermes core — file as the gating ask):**
- A **`/api/wishes`** (or wish association on sessions) — without an explicit wish key, floors are heuristically derived and fragile. **This is the #1 data dependency.** If Hermes can stamp each session/run with `wish_id`, the floor model becomes truth instead of inference.
- A **read token / scoped observability key** for 9119 so Claw3D's server can auth headlessly (today it rides a browser session cookie — unacceptable for an always-on projector).

**LATER (phase 2+):**
- `/api/runs` and `/api/tasks` as first-class (confirm they exist; they 401'd, existence unverified) for precise desk-items vs. inferring from session state.
- Server-pushed SSE `/api/events` from Hermes itself — would let Claw3D drop the diff-poller. Nice-to-have, not blocking.
- Cron/skills/approvals surfaces — explicitly out of scope (view-only first).

---

## 6. Migration plan — strip OpenClaw converter safely

**Decision: additive new provider first, prove parity, then quarantine, then delete. Never big-bang.**

```
Phase A — Add (no deletion):
  + src/lib/runtime/hermes-native/provider.ts   (RuntimeProvider, HTTP-snapshot based)
  + src/app/api/hermes/snapshot/route.ts         (server-side proxy, holds cred)
  + src/lib/world/hermesSnapshotProjection.ts    (snapshot → floors/rooms/workers)
  Register in createRuntimeProvider.ts behind a flag: RUNTIME=hermes-native
  Keep openclaw + old hermes provider untouched.

Phase B — Prove parity:
  - Boot Claw3D with hermes-native against live 9119.
  - Gate: tower renders ≥1 floor with real session data, truth=OBSERVED,
    console clean, no 401 leaked to browser, typecheck + tests green.
  - Visual QA with native vision + DOM/console/network (Felipe UI-GO law).

Phase C — Flip default:
  - Default RUNTIME=hermes-native.
  - Mark openclaw provider @deprecated. Move normalizeGatewayEvent + the
    websocket GatewayClient coupling behind the openclaw provider only.

Phase D — Quarantine:
  - Delete src/lib/runtime/openclaw/* and the old hermes/provider.ts
    (the websocket wrapper) ONLY after Phase C runs clean for the agreed window.
  - Update AGENTS.md: repo is no longer "a frontend for OpenClaw."
    Product boundary statement changes here — this is the real strip.
  - Remove the optional `openclaw` npm resolution + build warning.
```

**Safety rails:**
- The `RuntimeProvider` interface is the seam — both old and new satisfy it, so the renderer never changes during migration. This is exactly what the boundary doc demanded ("enter as a RuntimeProvider, not renderer hacks").
- One caveat: the current interface **mandates `readonly client: GatewayClient`**. The HTTP-native provider has no gateway client. **Relax the contract** to `client: GatewayClient | null` (or a `transport: "ws" | "http"` discriminant) in Phase A — small, typed, reversible. Do not hack around it by faking a GatewayClient.
- Each phase is a separate reviewable PR. No phase deletes and adds in the same PR.

---

## 7. Red flags / pitfalls / proof gates

**RED FLAGS:**
1. **Forcing 9119 through the websocket gateway path.** It has no public WS. Wrapping it in `GatewayClient`/`EventFrame` recreates the OpenClaw converter you're trying to kill. Hard no.
2. **Leaking the 9119 session cookie to the browser.** A god-view that exposes its own admin credential is a security incident. Credential stays server-side, always.
3. **Empty floors rendered as "nothing happening."** Absence of data (401/timeout) ≠ absence of work. Must render `GAP`, greyed + labeled, never silently empty. (Felipe contradiction law.)
4. **Inferring wishes and calling it truth.** Until Hermes stamps `wish_id`, floor grouping is OBSERVED-derived, not VERIFIED. Label it honestly. Don't ship a confident-looking tower built on a guess.
5. **Drogo as a worker in a room.** He's omnipresent rooftop chrome. Duplicating him per floor mutates the agent list (boundary rule #4 violation).
6. **Raw JSON / dashboard panels on the floor.** The product goal is *legibility*, not a denser dashboard. Detail-on-demand only, provenance-backed, real charts. (Felipe design law.)
7. **Khortex dependency creep.** `/api/khortex/ask` real route is down (`database "brain" does not exist`). Do not couple the floor model to Khortex. If you want narration later, gate it behind capability detection and fall back silent — never block the tower on a broken brain DB.

**PROOF GATES (no GO without all):**
- [ ] Live 9119: tower renders ≥1 floor from real `/api/sessions`, `truth=OBSERVED`, screenshot evidence.
- [ ] Browser network tab shows **only** same-origin `/api/hermes/*` calls — zero direct 9119 calls, zero cookie exposure.
- [ ] A 401'd sub-fetch renders a visible `GAP` floor, not a blank one — tested by killing one endpoint.
- [ ] 5-second legibility test passes on one populated floor (who/what visible without clicking).
- [ ] `npm run typecheck` + `npm run test -- --run` green; no *new* lint errors.
- [ ] Migration PR-A is purely additive; old providers still boot under their flag.
- [ ] Felipe visual QA with native vision + DOM/console/network, against the live runtime URL — not test-pass alone.

---

## The one decision that matters most
**Pick the HTTP-snapshot-diff substrate over the websocket gateway.** Everything else (floors, rooms, migration) flows cleanly from that. Choose wrong here and you rebuild OpenClaw with a Hermes label. The codebase already gave you the right tool (`/api/runtime/custom` proxy) — extend that, not `GatewayClient`.

**Single hard ask of Hermes core to unblock the real (not inferred) product:** stamp sessions/runs with `wish_id` and issue a scoped read token for 9119. Without those two, floors are honest guesses; with them, floors are truth.
