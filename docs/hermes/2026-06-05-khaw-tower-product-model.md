# Khaw Tower Product Model

Date: 2026-06-05

## Canon

The project name is **Khaw Tower**.

A **Khaw Tower** is one local spatial/business-tower instance plugged into one local Hermes server through the native protocol. Hermes remains the runtime substrate and source of operational truth; Khaw Tower is the product surface and world model.

```text
one Khaw Tower instance -> one local Hermes server -> one native read-only protocol source
```

## Executive metaphor

The default local profile/persona is the **Tower President**.

In local development this role is currently embodied by Drogo, but the durable product metaphor is business-tower executive/operator, not server-god.

The Tower President is:

- the executive building intelligence;
- the lobby/elevator/chrome presence;
- the inspector and summarizer of tower truth;
- the operator that can manifest when needed;
- not a normal worker duplicated across rooms.

## Spatial ontology

```text
Khaw Tower
  Lobby
    Reception / status wall
    Elevator banks / lane selector
  Lane / Elevator Bank
    Office
    Labs / University
    Future federated lanes and squads
  Wish Floor
    Department / role lane
      Room / session thread
        Persona / stable identity
        Worker / executing body
          Desk / live work surface
          Artifact board / proofs, claims, evidence
```

## Initial lanes

### Office

Business/product/customer/operator work.

Examples:

- KHAL Office
- Eugenia
- Gupshup journeys
- deploy/release operations
- live customer/operator operations

### Labs / University

Research, training, and prototype work.

Examples:

- Khaw Tower / Claw3D R&D
- learning society
- faculty role files
- curriculum
- experiments
- prototype surfaces

## Future federation

Khaw Tower must not bake the first two lanes as the final universe. The model should support more durable lanes and squad stacks, including:

- Platform
- Desktop
- FDE Operations
- product/customer squads
- other long-lived business units

The hierarchy must support both:

```text
Lane -> Wish floors
Lane -> Squad -> Wish floors
```

## Wish placement rules

Every Wish floor should have placement provenance.

Classification order:

1. Explicit Wish frontmatter: `lane`, `squad`, `product`, `wish_id`, `wish_slug`.
2. Durable path rules, for example University brain/wish paths map to `labs-university`.
3. Explicit repo/product rules, for example Khaw Tower/Claw3D maps to `labs-university`; Eugenia/Gupshup/release work maps to `office` unless metadata says otherwise.
4. Session inference from title, cwd/workdir, handoff state, source, board/task references, or model config.
5. Unknown/Ground placement.

Truth rules:

- `VERIFIED` only when the Wish or runtime exposes explicit metadata.
- `OBSERVED` for durable path/repo rules.
- `GAP` for inference or unknown placement.
- `SIMULATED` only for local/demo fixtures.

## Persona vs worker

Do not overload `agent`.

```text
Persona = stable identity, role, character, authority
Worker = actual executing body/process/model/session
```

Examples:

```text
Persona: Engineer
Worker: Codex coding-agent session
Desk: editing provider code and running tests
```

```text
Persona: Tower President
Worker: current default-profile Hermes session only when actively executing
Tower role: executive building presence across lobby/elevator/chrome
```

## Desk

A desk is the live work surface for a worker. It should show:

- current task;
- current tool/command/browser;
- active files or routes;
- test/proof status;
- evidence artifacts;
- blocker/gap state.

A desk is not the source of truth; it is a visual projection over runtime/session/tool evidence.

## Lobby and elevator experience

The Lobby should feel like entering a business tower, not opening an admin dashboard.

The Lobby shows:

- Khaw Tower identity;
- Hermes server source and health;
- gateway/platform/outside-wire status;
- Tower President presence;
- elevator banks for Office, Labs / University, and future lanes;
- floor directory with Wish floors grouped under lanes.

Proof target for the next visual slice:

```text
Khaw Tower — OBSERVED
source: local Hermes server at http://localhost:9119
President: Tower President / default profile
Elevator banks: Office, Labs / University
Floor: <Wish/workstream> grouped under the correct lane
Room: <session/thread>
Persona: <stable role/profile where known>
Worker: <actual executing session/model/process>
truth: OBSERVED for session; GAP if lane/Wish association is inferred
```
