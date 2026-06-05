# Claw3D Hermes-native State Surface Council Prompt

Felipe wants Claw3D to replace the current OpenClaw converter with a native stateful Hermes connection via `http://localhost:9119`.

Product goal:
- View-only first. No interaction/mutation yet.
- He wants to SEE EVERYONE WORKING on the server.
- Every Wish should become one floor.
- Inside each floor, show all agents/profiles/sessions/runs/tasks working in that Wish.
- The floor should be built so a human can understand what is going on, not a raw dashboard.
- Strip out OpenClaw converter as the product boundary; Claw3D becomes a rich Hermes-native projection.

Observed local facts:
- Claw3D repo: `/home/genie/workspace/agents/university/experiments/Claw3D`.
- Branch: `feat/drogo-skyview-split-20260604`.
- Existing verified slice: Drogo skyview server-god projection over runtime agent, host-aware gateway defaults, tests/typecheck passing.
- Current local Claw3D server: `http://127.0.0.1:3055/office`.
- Hermes Dashboard / state endpoint is live at `http://127.0.0.1:9119`; root is Hermes Agent Dashboard; `/api/status`, `/api/system/stats`, `/api/sessions`, `/api/sessions/stats`, `/api/profiles`, `/api/config`, `/api/analytics/*` exist behind session auth.
- Khortex real `/api/khortex/ask` at `:4179` is currently blocked by `database "brain" does not exist`; mock route works but real route is unavailable.

Existing Claw3D architecture facts:
- Runtime provider abstraction exists: connect/disconnect/call/onStatus/onGap/onEvent/onRuntimeEvent/capabilities.
- `src/lib/runtime/hermes/provider.ts` exists for Hermes/OpenClaw-ish runtime path.
- `src/lib/world/runtimeProjection.ts` maps runtime agents into OfficeAgent visual projections.
- `docs/hermes/drogo-skyview-desktop-websocket-boundary.md` says future integration should enter as a RuntimeProvider, not renderer hacks.

Ask:
Think as one expert council seat. Design the network protocol and architecture categories for a Hermes-native, stateful, view-only Claw3D runtime. Be concrete. Include:
1. Protocol shape between Claw3D server and Hermes 9119.
2. Snapshot + event stream model.
3. How to model Wish => floor.
4. How to map agents/sessions/tasks/runs/events into readable spatial objects.
5. What data Claw3D needs from Hermes immediately vs later.
6. Migration plan to strip OpenClaw converter safely.
7. Red flags / pitfalls / proof gates.

Return decisive recommendations, not a vague brainstorm.