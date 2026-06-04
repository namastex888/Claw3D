# Drogo Skyview Desktop WebSocket Boundary

Date: 2026-06-04
Wish: `drogo-skyview-control-plane`

## Decision

The Drogo Skyview MVP must stay on Claw3D's runtime provider abstraction. The current Hermes/OpenClaw converter path is transitional; the richer future integration should be implemented as a Desktop WebSocket runtime provider, not as ad hoc OfficeScreen/RetroOffice hacks.

## Current Provider Boundary

Existing Claw3D runtime shape:

```text
RuntimeProvider
  connect(options)
  disconnect()
  call(method, params)
  onStatus(handler)
  onGap(handler)
  onEvent(handler)
  onRuntimeEvent(handler)
  capabilities
```

`src/lib/runtime/hermes/provider.ts` already demonstrates this pattern and supports:

```text
agents
sessions
chat
agent-messages
agent-handoffs
streaming
approvals
config
models
skills
cron
files
agent-roles
```

## Future Desktop WebSocket Provider

The Desktop WebSocket integration should enter as:

```text
src/lib/runtime/desktop/provider.ts
```

It should implement `RuntimeProvider` and expose richer events/methods while preserving the same Office projection contract:

```text
Desktop websocket runtime truth
  -> RuntimeProvider events/calls
  -> AgentState/runtime event store
  -> runtimeProjection.ts
  -> OfficeAgent/RetroOffice3D projection
  -> Skyview inspector/control surface
```

## What Not To Do

- Do not make Claw3D create a separate canonical agent database.
- Do not teach RetroOffice3D adapter-specific websocket semantics.
- Do not keep extending the Hermes/OpenClaw converter as the long-term product boundary.
- Do not make Drogo omnipresence mutate the runtime agent list.

## Immediate MVP Boundary

This wish only adds:

- Drogo projection metadata over the existing runtime agent.
- Stable server-god avatar preset.
- Read-first Skyview/agent inspector.

Desktop websocket replacement remains a later implementation gate once the MVP proves the operator control surface is useful.
