# Claw3D Council: Protocol-Runtime Design Specification
**Date:** 2026-06-05  
**Wish:** `drogo-skyview-control-plane`  
**Council Seat:** protocol-runtime (Drogo PM Core)  
**Status:** DECISIVE RECOMMENDATION FOR NATIVE REPLACEMENT  

Felipe's mandate is clear: Claw3D must move past transitional OpenClaw converters and establish a native, stateful, view-only connection directly to Hermes `:9119`. We must visualize active Wishes as distinct spatial building floors, populating them with real-time agent/session/task activity, while stripping the old adapter boundaries.

---

## 1. Network Protocol Shape (Claw3D Server ↔ Hermes 9119)

We recommend a **Dual-Tier State Multiplexer** architecture. Direct browser connections to Hermes :9119 risk CORS issues, token management complexity, and connection storms. 

```text
+-----------------------+              +-----------------------+              +-----------------------+
|  Claw3D Web Client    |  WebSocket   |  Claw3D Node Server   |  WS / HTTP   |  Hermes Core Engine   |
|  (React/Three.js)     |<------------>|  (server/index.js)    |<------------>|  (http://localhost:9119)
+-----------------------+              +-----------------------+              +-----------------------+
```

### Protocol Specifications:
1. **Connection Tier 1 (Claw3D Server ↔ Hermes 9119):**
   - The Claw3D Node backend (`server/index.js`) maintains a long-lived, stateful client connection to Hermes via a persistent WebSocket connection: `ws://localhost:9119/api/v1/ws`.
   - Reconnections are managed on the server-side with an exponential backoff + jitter strategy (initial 1s, max 16s, random drift ±250ms).
   - Authoritative REST calls (e.g. `GET /api/v1/status`) are made via standard server-to-server fetch requests.
2. **Connection Tier 2 (Client Browser ↔ Claw3D Server):**
   - The browser connects to `ws://localhost:3055/ws/hermes`.
   - The Claw3D server acts as a **Multiplexer**, distributing filtered Hermes state and real-time event frames to all active workspace viewers.

### Message Framing:
Frames utilize standard JSON-RPC 2.0 formatting for predictable schemas:
* **Request (Client Subscription):**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "subscription/subscribe",
    "params": { "topics": ["wishes", "sessions", "kanban", "events"] },
    "id": "sub_1"
  }
  ```
* **Notification (Event Broadcast):**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "subscription/publish",
    "params": {
      "topic": "events",
      "seq": 10243,
      "event": "session.step.thought",
      "payload": {
        "sessionKey": "agent:drogo:main",
        "thought": "Analyzing server performance traces...",
        "timestamp": 1780680346000
      }
    }
  }
  ```

---

## 2. Snapshot + Event Stream Model (SHR Pattern)

To avoid heavy synchronization logic or missing critical events, we enforce the **State-Hydration-and-Reconciliation (SHR)** pattern.

### Step 1: Initial Hydration (Snapshot)
Upon client connection, a bulk payload is fetched via HTTP:
* `GET /api/v1/snapshot` (combining active wishes, sessions, profiles, and Kanban cards).
* This replaces current fragmented loading and sets the initial 3D floor map.

### Step 2: Stateful Delta Streaming (Events)
The state is kept alive via real-time delta events over the WS connection:
* `wish.created` / `wish.completed` (spawns/prunes floor blocks).
* `session.spawn` / `session.teardown` (spawns/removes operator consoles on floors).
* `agent.run.state` (triggers visual statuses: idle, thinking, calling-tool, blocked).
* `agent.run.thought` (feeds real-time string tokens into the floating thought bubble).

### Step 3: Out-of-Order Safety (Reconciliation Heartbeat)
* Every frame contains a global `seq` (sequence number) from Hermes.
* Every 30 seconds, a lightweight hash checksum is requested via `GET /api/v1/checksum`. If the client checksum diverges from the core state hash, the client background-refetches the snapshot to resolve drift without disrupting the active camera or UI controls.

---

## 3. Wish-to-Floor Modeling (The Dynamic Skyscraper)

We move away from static floor definitions in `floors.ts`. Claw3D becomes a dynamic tower representing active epics/Wishes.

```typescript
// Proposed dynamic definition mapped from Wish state
export interface DynamicFloorDefinition {
  id: string;              // "wish-<wish-slug>"
  label: string;           // e.g. "Drogo Skyview Control Plane"
  shortLabel: string;      // e.g. "Skyview"
  provider: "hermes";
  kind: "runtime";
  status: "pending" | "in_progress" | "completed";
  stats: {
    activeSessions: number;
    completedTasks: number;
    totalTasks: number;
  };
}
```

### Spatial Mapping Rules:
* **The Lobby:** Stays as Floor 0. Handles core system status, configuration settings, and server logs.
* **The Wish Floors:** Spawns dynamically stacked above the Lobby.
  - Active Wishes (e.g. `drogo-skyview-control-plane`) are sorted by creation date or priority and assigned Floor IDs `wish-1`, `wish-2`, etc.
  - When a Wish is marked completed, its physical floor in the 3D stack shifts to an "archived/glass" visual style—showing the historical work in a frozen, clean state.

---

## 4. Mapping Entities into Readable Spatial Objects

A raw dashboard is illegible for human managers. We translate raw data fields into spatial, emotional visual cues.

| Hermes Entity | Spatial Object in Claw3D | Visual Cues & Emotional Feedback |
|---|---|---|
| **Wish / Goal** | **Building Floor (Room)** | Floor size and styling matches the scope (e.g., devops style, writing studio style). |
| **Agent / Profile** | **3D Avatar (Resident)** | Avatar skin, clothing, and colors derived from `avatarProfile` preset. Clones of the same profile representing concurrent sessions are labeled with small translucent subscripts (`Drogo_01`, `Drogo_02`). |
| **Session / Run** | **Workstation Console** | A physical desk with a retro-futuristic terminal. The screen displays real-time execution outputs. |
| **Active Thinking** | **Desk Aura / Thought Bubble** | A pulsing blue ring flows around the desk. A translucent physical floating bubble floats above the avatar’s head, typing out live `thought` strings. |
| **Tool Calling** | **Energy Lines & Console Matrix** | Scrolling matrices on the desk screen. Streams of yellow sparks connect the console to the floor's Central Processor unit. |
| **Errors / Blockers** | **System Red Warning** | The workstation console locks down under a dark red warning light. The avatar exhibits a "frustrated" posture (hand on head, pacing) to signal immediate human review is required. |
| **Kanban Task** | **Physical Post-it Notes** | A whiteboard on the floor wall displaying real tasks. Cards visually travel from left to right as `task.status` updates. |

---

## 5. Protocol Payload Checklist (Immediate vs Later)

### Phase 1: View-Only MVP (Immediate Need)
```json
// Snapshot schema example
{
  "status": "online",
  "wishes": [
    { "slug": "skyview-mvp", "title": "Drogo Skyview MVP", "status": "in_progress" }
  ],
  "sessions": [
    {
      "id": "sess_8832",
      "wish": "skyview-mvp",
      "agentId": "drogo",
      "status": "thinking",
      "latestThought": "Optimizing three.js rendering engine..."
    }
  ]
}
```

### Phase 2: Interactive Capabilities (Later Scope)
* `/api/v1/sessions/:id/cancel` — Emergency halt.
* `/api/v1/sessions/:id/chat` — Send immediate text prompt direction.
* `/api/v1/kanban/move` — Drag-and-drop tasks physically to modify the backend state.

---

## 6. Migration Plan (Stripping OpenClaw safely)

We will proceed in three clean phases to ensure zero regression:

1. **Phase A: Parallel Coexistence (The Safety Flag)**
   - Introduce a feature toggle: `NEXT_PUBLIC_HERMES_NATIVE=true`.
   - Create `src/lib/runtime/hermes/providerNative.ts` alongside the existing transitional file.
   - If the flag is false, fall back to the old OpenClaw converter paths. This allows live debugging without breaking main.
2. **Phase B: Rerouting Presentation Hooks**
   - Refactor `runtimeProjection.ts` and `floorRoster.ts` to derive floors dynamically from the new `snapshot` payload rather than reading static, hardcoded configs.
   - Run typechecks and E2E smoke tests.
3. **Phase C: Hard Pruning**
   - Remove `src/lib/runtime/openclaw/` and the converter translation maps.
   - Clean up `.env.example` to remove legacy OpenClaw keys, leaving only the direct `HERMES_URL=http://localhost:9119` target.

---

## 7. Red Flags & Pitfall Preventive Gates

1. **Red Flag: WebSocket Token Spam (UI Freezes)**
   - *The Danger:* A fast agent printing raw outputs can spam thousands of tokens/sec, causing main-thread React/Three.js lag.
   - *Gate:* Establish an **Event Buffer Queue**. Store incoming thought tokens in a server/client buffer, flushing and updating the UI text ref at a throttled rate of 10Hz (10 updates per second maximum), bypassing React re-renders using direct Three.js text-node mapping.
2. **Red Flag: Disconnection Reconnect Storms**
   - *The Danger:* If the Hermes daemon restarts, multiple open tabs will hammer port `:9119` at once, causing server overload.
   - *Gate:* Enforce strict client-side exponential backoff with randomized jitter on connection resets.
3. **Red Flag: Missing "Brain" DB Crash (Real Khortex blocks)**
   - *The Danger:* Real API paths might throw uncaught errors on missing dependencies (e.g. `database "brain" does not exist`).
   - *Gate:* The protocol-runtime layer must treat database or dependency failures gracefully: return standard error frames `{ ok: false, error: { code: "DB_DOWN", message: "Database brain unavailable" } }` rather than letting the Node process crash. Maintain local mock fallback modes internally.

---

### Decisive Council Recommendation:
**Proceed to Phase A immediately on the active branch `feat/drogo-skyview-split-20260604`.** This approach ensures strict isolation of the new native WebSocket protocol, guarantees clean visual QA gates, and empowers Felipe to oversee an intelligent, physical projection of his active wishes.
