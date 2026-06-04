# Drogo Skyview Control Plane Preflight

Date: 2026-06-04T17:25:46+00:00
Repo: `/home/genie/workspace/agents/university/experiments/Claw3D`
Branch: `main`
Wish: `/home/genie/workspace/agents/university/brain/wishes/2026/06/04/drogo-skyview-control-plane/WISH.md`
Hermes board: `drogo-skyview-control-plane`

## Live Repo State

`git status --short` before this implementation slice showed existing dirty files from the crashed/previous agent context:

```text
 M server/studio-settings.js
 M src/features/agents/state/runtimeChatEventWorkflow.ts
 M src/features/office/screens/OfficeScreen.tsx
 M src/features/retro-office/RetroOffice3D.tsx
 M src/lib/gateway/GatewayClient.ts
 M src/lib/gateway/proxy-url.ts
 M src/lib/office/eventTriggers.ts
?? tests/unit/proxyUrl.test.ts
```

`git diff --stat` before this slice:

```text
 server/studio-settings.js                          |  29 ++++-
 .../agents/state/runtimeChatEventWorkflow.ts       |   4 +-
 src/features/office/screens/OfficeScreen.tsx       |  68 +++++++++---
 src/features/retro-office/RetroOffice3D.tsx        | 120 ++++++++++++++++-----
 src/lib/gateway/GatewayClient.ts                   |   2 +-
 src/lib/gateway/proxy-url.ts                       |  14 ++-
 src/lib/office/eventTriggers.ts                    |  22 +++-
 7 files changed, 211 insertions(+), 48 deletions(-)
```

## Dirty Diff Summary

Inspected the dirty diff before new code mutation. The current dirty tree appears to be runtime/proxy/office reliability work, not the new Drogo skyview feature:

- `server/studio-settings.js`: protects the Studio upstream loader from using a self-published/public gateway URL as its own upstream, falling back to default local gateway.
- `src/lib/gateway/proxy-url.ts` and `tests/unit/proxyUrl.test.ts`: proxy URL normalization/self-proxy protection work.
- `src/features/agents/state/runtimeChatEventWorkflow.ts`: converts missing-thinking-trace warning into metric logging.
- `src/features/office/screens/OfficeScreen.tsx`: floor roster cache equality and pending runtime switch de-looping.
- `src/features/retro-office/RetroOffice3D.tsx`: render-agent snapshot equality/ref de-looping and command-arrived refs.
- `src/lib/office/eventTriggers.ts`: likely related office event-trigger stability; to avoid conflict, this slice will only touch it if necessary.

## Architecture Constraints Confirmed

From `ARCHITECTURE.md`:

- Claw3D is gateway-first: UI/proxy/presentation, not the runtime.
- OpenClaw/Hermes owns agent records, sessions, approvals, runtime streams, and agent files.
- Claw3D local state is limited to settings, focused agent/UI preferences, and layout/presentation state.
- The office should derive animation and room activity from runtime signals.

This wish therefore implements a projection/control surface, not a duplicate agent model.

## Existing Seams Confirmed

- `OfficeScreen.tsx` maps `AgentState` into `OfficeAgent` via `mapAgentToOffice()`.
- `RetroOffice3D.tsx` renders `OfficeAgent[]`, has click handlers for agents, camera presets, top roster, and context menus.
- `src/lib/runtime/hermes/provider.ts` already wraps the generic `RuntimeProvider` contract and delegates `agents.message` / `agents.handoff` via runtime methods.
- `src/lib/avatars/profile.ts` and `profilePortrait.ts` provide existing avatar profile/portrait contracts.

## Safe Implementation Plan From Preflight

1. Add new projection/preset files rather than rewriting existing runtime providers.
2. Patch `OfficeScreen.tsx` at the `mapAgentToOffice()` boundary to project Drogo metadata from existing runtime agent state.
3. Patch `RetroOffice3D.tsx` only at read-first presentation seams: click default, roster labels, and inspector overlay.
4. Avoid `server/*`, proxy URL, and event trigger dirty files unless a compile error forces a local fix.

## Verification Commands Planned

```bash
npm test -- tests/unit/runtimeProjection.test.ts --run
npm run typecheck
npm run build
```

Browser dogfood target: `/office` shows `Skyview`, `Drogo`, `Server God / Orchestrator`, `source: Hermes runtime`, `truth: OBSERVED`, and clean console.
