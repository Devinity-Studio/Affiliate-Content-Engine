# ACE R1 — A2 Decision Amendment Proposal
**Status:** Draft for Owner Review — Not Ratified

## A. Purpose

Translate the Owner's stated direction into a reviewable A2 proposal while preserving the existing ratified Content Artifact v1 contract and keeping implementation unauthorized.

## B. Owner Direction Already Stated

1. When a newly requested artifact is identical in every relevant respect to an existing artifact and is verified as interchangeable for the intended use, the system should not create a duplicate file. It should inform the user that the existing file can be reused.
2. Shared Lineage A should track common history up to the Edit branch point.
3. At the branch point, the workflow separates into Branch A1 and Branch A2.
4. Each branch must retain a verifiable reference to the shared origin and its own subsequent history.
5. Editing one branch must not silently mutate the other branch.
6. These directions are clarifications for review; they do not ratify A2, B3, A3, or any implementation.

## C. Proposed A2 Policy Boundary

A2 concerns Content Library entry behavior and its relationship to artifact reuse and lineage.

The following are separate questions and must not be conflated:

- Whether a new file needs to be generated.
- Whether an existing artifact is verified as reusable.
- Whether a Content Library entry is added, retained, or replaced.
- Whether artifact lineage and history are preserved.
- Whether physical file bytes may be removed.

A2 must not silently authorize deletion of artifact records, lineage, or history.

## D. Identical Artifact Reuse

**Proposed requirement:**

When a repeat request can be proven to produce an artifact identical to an existing, valid artifact for the intended use, the system should reuse the existing artifact and inform the user rather than create a duplicate file.

Before implementation, the Owner must clarify or approve the following:

1. **Comparison target:** script bytes, rendered file bytes, or another explicitly defined artifact representation.
2. **Verification timing:** whether sufficient evidence is available before generation, after script generation, or only after rendering.
3. **Reuse eligibility:** whether identity must include content identity, version, relevant assets, output format, and intended channel or use.
4. **User-requested regeneration:** whether an explicit request to regenerate overrides reuse.
5. **Library behavior:** how reuse is represented without falsely implying that a new file or new export was created.
6. **Evidence:** what record proves which existing artifact was reused and why.

A matching SHA-256 digest can support byte-identity verification for the exact bytes hashed. It does not independently establish semantic suitability across different versions, formats, channels, or intended uses.

Artifact identifiers use a probabilistic scheme (e.g., `ART-${Date.now()}-${random}`) that reduces collision risk but does not mathematically guarantee uniqueness. This is a practical limitation, not a strict guarantee. It does not determine reuse eligibility, which must be evaluated using the applicable rendered-content equivalence, suitability, and verified-integrity criteria.

B3 remains a separate decision and is not ratified by this proposal.

## E. Shared Lineage and Branching

**Proposed conceptual model:**

- Lineage A records the shared origin and history before the Edit branch point.
- The Edit decision establishes the branch point.
- Branch A1 and Branch A2 inherit references to the shared lineage.
- Each branch records its own subsequent edits and artifact versions.
- Changes within one branch must not automatically alter the other branch.
- The branch point, parent artifact, and resulting artifacts must be traceable backward.

The exact data model, identifiers, persistence mechanism, and event structure remain deferred implementation questions.

## F. Relationship to A3 and B3

- A2 governs Content Library behavior.
- A3 governs the selected artifact or Export Event history policy.
- B3 governs verified SHA-256-based physical-file reuse.
- These decisions interact but must remain separately ratifiable.

The A2 proposal may record dependencies and evidence requirements without selecting an A3 or B3 option.

## G. Safety and Lifecycle Constraints

1. Artifact records and lineage must remain distinct from physical file bytes.
2. A physical file may only be considered for cleanup after replacement suitability and retention requirements are established.
3. Published or otherwise used artifacts require separate impact and retention consideration.
4. A damaged or missing artifact must not be assumed safely reproducible without sufficient source and validation evidence.
5. No destructive cleanup may proceed on the basis of a reuse claim alone.
6. Existing ratified contract requirements must not be silently amended by this proposal.

## H. Evidence and Validation Limits

The current analysis is based on reported read-only source inspection. It does not establish runtime behavior.

No tests, HTTP requests, rendering, or runtime validation are claimed by this proposal. Any future implementation must be validated against an explicitly approved contract and test plan.

## I. Decisions Still Required

Before A2 ratification, the Owner must resolve:

1. The exact definition of identical and reusable.
2. The comparison target and available verification timing.
3. The representation of reuse in the Content Library.
4. The behavior when a user explicitly requests regeneration.
5. The minimum lineage and branch-point evidence required by A2.
6. The relationship between A2 and the separately pending A3/B3 decisions.

The local Video Renderer (`app/remotion/render.js`) uses `ffmpeg -y`, which can overwrite an existing file when the same `outFile` path is used. This rendering-path behavior is separate from A2 Library reuse and must be evaluated under the separately pending B2 decision. A2 concerns Content Library entry behavior and reuse recommendations; renderer physical-file overwrite behavior is not ratified by this A2 proposal.

No option is selected or ratified in this draft.

## J. Approval Boundary and Mandatory ACE Status

This document is a proposal only. It does not authorize Decision Record changes, contract amendments, source changes, schema changes, migrations, tests, cleanup, rendering, deployment, baseline acceptance, Vertical Slice execution, or implementation.

Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
contractResolutionStatus = UNRESOLVED
Row 18 / Row 3c = PENDING RECONCILIATION
Canonical precedence = PENDING CONFIRMATION
Baseline captured and accepted = NO
ACS Seed Consolidation = PENDING OWNER REVIEW
ACS Implementation = NOT APPROVED
Scenario E = OWNER DECISION REQUIRED