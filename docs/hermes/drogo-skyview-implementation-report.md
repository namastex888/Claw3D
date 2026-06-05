# Drogo Skyview Control Plane Implementation Report

Date: 2026-06-04
Wish: `/home/genie/workspace/agents/university/brain/wishes/2026/06/04/drogo-skyview-control-plane/WISH.md`
Board: `drogo-skyview-control-plane`
Repo: `/home/genie/workspace/agents/university/experiments/Claw3D`
Local proof server: `http://127.0.0.1:3055/office` (`PORT=3055 npm run start`, process `proc_a38a8d2ff2a8`)

## What shipped in this slice

### Group 1 — Runtime projection contract

Added `src/lib/world/runtimeProjection.ts` plus `tests/unit/runtimeProjection.test.ts`.

The projection maps the existing runtime `hermes`/Hermes orchestrator agent into a Drogo visual projection without changing the runtime id or creating a new gateway agent:

- display name: `Drogo`
- role: `Server God / Orchestrator`
- source: `Hermes runtime`
- truth: `OBSERVED`
- runtime id: `hermes`
- presence: `omnipresent`
- control surface: `skyview`

Normal runtime agents remain `runtime-agent` / room-scoped projections.

### Group 2 — Drogo server-god avatar preset

Added `src/lib/avatars/presets.ts` with `DROGO_SERVER_GOD_AVATAR_PROFILE`:

- stable seed: `drogo-server-god`
- dark operator/server palette
- glasses + headset enabled
- jacket/pants silhouette

Patched `src/features/retro-office/objects/agents.tsx` so this seed renders a special violet/cyan server-god halo and glyph above the avatar.

### Group 3 — Omnipresent Drogo projection policy

Patched `src/features/office/screens/OfficeScreen.tsx` at the `mapAgentToOffice()` boundary:

- runtime agent stays `id=hermes`
- `OfficeAgent.name` becomes `Drogo`
- projection metadata is attached to `OfficeAgent.projection`
- cache invalidates when `activeAdapterType` changes, so switching into Hermes correctly re-projects Drogo

Patched `src/features/retro-office/core/types.ts` to carry optional projection metadata on `OfficeAgent`.

### Group 4 — Skyview inspector MVP

Patched `src/features/retro-office/RetroOffice3D.tsx`:

- Adds a top-left `Skyview Control` surface labeled `Drogo server-god projection`.
- Changes agent/roster click behavior to open a read-first inspector instead of immediately editing the agent.
- Inspector shows source/truth/runtime id/presence/status.
- Inspector offers safe follow-up actions: `Open chat`, `Monitor`, and `Edit` only for non-server-god local agents.

### Group 5 — Desktop websocket provider boundary

Added `docs/hermes/drogo-skyview-desktop-websocket-boundary.md`.

The boundary keeps Desktop WebSocket as a future `RuntimeProvider` implementation and explicitly avoids adapter-specific hacks in `RetroOffice3D`.

## Verification evidence

### Focused unit test

Command:

```bash
npm test -- tests/unit/runtimeProjection.test.ts --run
```

Result:

```text
✓ tests/unit/runtimeProjection.test.ts (3 tests) 6ms
Test Files  1 passed (1)
Tests       3 passed (3)
```

### Typecheck

Command:

```bash
npm run typecheck
```

Result:

```text
> claw3d@0.1.4 typecheck
> tsc --noEmit
```

Exit code: 0.

### Production build

Command:

```bash
npm run build
```

Result:

```text
✓ Compiled successfully in 10.9s
✓ Generating static pages using 47 workers (32/32) in 887.5ms
```

Exit code: 0.

### Local server health

Command:

```bash
curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3055/office
```

Result:

```text
200
```

### Browser dogfood proof

Browser path: `http://127.0.0.1:3055/office`

Actions:

1. Opened `/office`.
2. Selected `Hermes backend`.
3. Connected to `ws://localhost:18789`.
4. Clicked the `D` Drogo roster chip.

Observed via browser snapshot + vision:

- `Runtime: hermes (connected)`
- top-left `SKYVIEW CONTROL`
- `Drogo server-god projection`
- `1 AGENTS`
- roster chip: `D`
- inspector: `AGENT INSPECTOR`
- name: `Drogo`
- role: `Server God / Orchestrator`
- source: `Hermes runtime`
- truth: `Observed` / DOM contains `OBSERVED`
- runtime id: `hermes`
- presence: `omnipresent`
- status: `idle`

Screenshot proof:

`/home/genie/.hermes/cache/screenshots/browser_screenshot_d33ac339506e475f815538f212c52bab.png`

DOM proof expression:

```js
document.body.innerText.includes('Drogo') &&
document.body.innerText.includes('Hermes runtime') &&
document.body.innerText.includes('OBSERVED')
```

Result: `true`.

## Console caveat

The UI did not show visible red error overlays. Browser console capture did show existing Three.js/WebGL noise:

- `THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
- `THREE.WebGLRenderer: Context Lost.`
- an empty `pageerror` entry from the browser tool buffer

These were not introduced by the Drogo projection code path as far as this slice proves, but the console is not perfectly clean. If Felipe wants the stricter “zero warnings/errors” gate before moving on, the next micro-slice should isolate the pre-existing Three.js/browser-context warning separately.

## Git state note

This implementation happened on top of an already-dirty Claw3D tree. Pre-existing dirty files were recorded in `docs/hermes/drogo-skyview-preflight.md` before mutation. New/changed files from this slice include:

- `docs/hermes/drogo-skyview-preflight.md`
- `docs/hermes/drogo-skyview-desktop-websocket-boundary.md`
- `docs/hermes/drogo-skyview-implementation-report.md`
- `src/lib/avatars/presets.ts`
- `src/lib/world/runtimeProjection.ts`
- `tests/unit/runtimeProjection.test.ts`
- patches in `OfficeScreen.tsx`, `RetroOffice3D.tsx`, `core/types.ts`, and `objects/agents.tsx`

## Verdict

MVP slice is working and verified:

- Code contract passes focused tests.
- Typecheck passes.
- Production build passes.
- Local `/office` serves HTTP 200.
- Browser proof shows Drogo as Hermes-backed server-god projection with the requested inspector truth fields.

Remaining caveat: console has pre-existing Three.js/WebGL warnings/noise, so the strict clean-console bar is not fully satisfied yet.

## Recommended next step

Do a narrow cleanup/review gate before the next Claw3D control-surface slice:

1. Keep the committed Claw3D branch as the active product context.
2. Optionally fix or explicitly waive the Three.js/WebGL console noise.
3. Continue from Drogo/Skyview: improve operator control, room switching, agent inspector fidelity, and the future Desktop WebSocket provider boundary.
