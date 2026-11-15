# ACE → ICE Evolution Seed

**Status**: Proposed owner intent — registry only. No implementation, no code changes, no runtime validation.

**Objective**: Record the owner's proposed vision for evolving Affiliate Content Engine (ACE MVP) into Intelligence Content Engine (ICE), while preserving ACE's existing scope, evidence, and Mission 1 / Z1 status.

---

## 1. Owner-Confirmed Intent

These are the owner's confirmed directions, recorded as architectural proposals for future evaluation. They do not authorize any implementation.

1. **ACE MVP is the existing foundation.** The current Affiliate Content Engine MVP (import → research → candidates → plan → content → publish workflow) is the established baseline. ICE evolves from it.

2. **ICE is an intended future evolution of ACE, not a separate duplicate workflow.** ICE is not meant to replace or duplicate the ACE MVP. It is the same workflow advanced to include intelligence, creative orchestration, and broader content types beyond affiliate/shopee affiliate products.

3. **ACE and ICE are expected to share more than 80% of their workflow.** This is an architectural target, not a measured or verified result. The shared core includes: import → research → candidates → plan → content pipeline stages. The 20%+ difference primarily concerns content objectives, production requirements, and publishing destinations.

4. **Differences may primarily concern**:
   - Some preparation steps (Research may be optional per content type, not mandatory for every work).
   - Content objectives and production requirements (affiliate commission vs. general content intelligence).
   - Publishing destinations (affiliate links vs. broader creative publishing).
   - Output file formats, dimensions, aspect ratios, and media specifications (9:16 video for social vs. varied outputs for different content types).

5. **Workflow steps must be configurable by content type.** Research is not mandatory for every work. Different content categories (affiliate product, documentary, fictional story, educational material) may require different workflow configurations or omissions.

6. **Writer is the authoring stage.** It stores or creates the original narrative, literary work, book, story, or episode. The Writer stage is where source material originates before any analysis or adaptation.

7. **Plan summarizes and analyzes the selected source.** It identifies relevant characters, proposes suitable actors, and plans the adaptation from source to screen or page.

8. **Storyboard & Script transforms selected narrative material into scenes.** It includes character dialogue, actions, emotions, and performance instructions. This stage bridges the gap between plan and production.

9. **Production creates the selected output.** Using the applicable actors, scripts, assets, and output specifications. Production is the stage that generates the final deliverable.

10. **Users should be able to access or export different work representations independently.** Original Writer content, Script, Storyboard, and produced assets should be exportable separately. No stage should silently overwrite or subsume another's output.

11. **Preserve source relationships and version history.** Editing the original must not silently overwrite existing scripts or completed production outputs. Source provenance must be trackable across evolution from ACE to ICE to Actor Studio.

12. **Keep ACE-specific affiliate capabilities distinct from ICE's broader capabilities.** ACE's affiliate-API integrations (ACCESSTRADE/ClickBank), payout-lag automation, and commission-tracking remain ACE-specific. ICE inheriting ACE does not imply those capabilities extend broadly — they remain tagged and scoped.

---

## 2. Architectural Target — Shared Workflow Core

The following table illustrates the expected shared vs. differentiated portions between ACE and ICE:

| Workflow Stage | ACE MVP (shared core) | ICE Differentiation |
|----------------|----------------------|---------------------|
| **Import** | Shopee Affiliate export (synthetic fixture or pasted CSV) | Broad content import: manuscripts, research articles, user narratives, API data feeds |
| **Research** | mandatory for affiliate slice | configurable per content type; may be omitted for some work categories |
| **Candidates** | 5 ranked candidates with claim classes | adaptive candidate generation per content type; variable candidate count |
| **Plan** | MVP plan draft with 4 approaches + impact preview | plan with actor casting, scene mapping, adaptation strategy |
| **Content** | Script/draft markdown with claim_map | Writer content, Script, Storyboard as independently exportable representations |
| **Production** | local ffmpeg, 1080x1920 H.264 MP4 (9:16) with libass/ASS Thai track | variable output specs per content type: aspect ratio, codec, format, language, metadata |
| **Publish** | no publish (fixture state only) | publish destinations per content type: affiliate posting, LMS release, video platform, PDF export, etc. |

**Shared ≥ 80%**: import → research → candidates → plan → content pipeline architecture.

**Differentiated < 20%**: preparation steps configurability, content objectives, publishing destinations, output format specifications.

---

## 3. Relationship to Other Seeds

| Seed | Relationship | Status |
|------|--------------|--------|
| **ACE MVP** | Foundation; ICE evolves from ACE | Preserved; no changes to ACE code or Z1 status |
| **ICE Evolution Seed** | This document | Proposed; registry only |
| **Actor Studio Seed** (future) | ICE → Actor Studio continuation: actor continuity, performance tracking, audience intelligence | Not yet defined; will be separate seed after ICE evolution is validated |
| **Mission 1 / Z1** | ACE-specific constraints preserved | All six Z1 statuses unchanged (see Section 5) |

---

## 4. Preserved ACE Mission 1 / Z1 Statuses

All six Z1 statuses are preserved exactly as specified. No changes, resolutions, or implications are authorized.

| Status | Value | Preserved |
|--------|-------|-----------|
| `contractResolutionStatus` | `UNRESOLVED` | ✅ |
| Row 18 / Row 3c | `PENDING RECONCILIATION` | ✅ |
| Canonical precedence | `PENDING CONFIRMATION` | ✅ |
| Baseline captured and accepted | `NO` | ✅ |
| Implementation | `NOT APPROVED` | ✅ |
| Runtime validation | `NOT PERFORMED` | ✅ |

**No Z1 resolution, no implementation approval, no Mission 1 completion is claimed or implied.**

---

## 5. Unresolved Decisions and Open Questions

| Question | Current Status | Evidence Needed |
|----------|---------------|-----------------|
| **Shared-workflow target (≥80%)** | Architectural proposal, untested | Measurement after ICE prototype implementation |
| **Research optional per content type** | Owner intent; not yet configured in code | Content-type matrix defining which stages are mandatory/optional |
| **Writer/Plan/Storyboard/Script boundaries** | Owner-described; not implemented | Schema definitions for each representation; independent export formats |
| **Output format specifications** | Aspect ratios, codecs, dimensions under consideration | Prototype testing with 2-3 content types |
| **Publishing destinations** | Not defined for ICE | Owner to specify per content category |
| **ACE-specific affiliate capabilities scope** | Must remain distinct | Tagging/separation strategy in code (out of scope for this seed) |
| **Actor continuity from ICE to Actor Studio** | Not yet defined | Will be addressed in future Actor Studio Seed |
| **Version history preservation mechanism** | Conceptual only | Implementation reserved for later; editing original must not overwrite scripts/production outputs |

---

## 6. What This Seed Does NOT Authorize

- ❌ Integrating AI providers (Gemini, OpenAI, Claude, etc.) into ACE or ICE
- ❌ Modifying ACE application code, source files, or dependencies
- ❌ Running the application, tests, import previews, or persistence experiments
- ❌ Real Shopee API access or external affiliate account connections
- ❌ Changing Mission 1 Z1 statuses or declaring implementation approved
- ❌ Creating the full ICE implementation; this is a seed/record only
- ❌ Claiming the ≥80% shared-workflow target is verified or measured
- ❌ Adding Writer/Plan/Storyboard/Script code or schemas to the existing ACE codebase

---

## 7. Source/Provenance Notes

- **Owner-confirmed intent**: Directions 1–12 above are the owner's confirmed directions, received through prior communications and recorded for team awareness.
- **Architectural proposal**: The ≥80% shared-workflow target is an architectural goal, not a measured result. It requires prototype validation.
- **Unresolved questions**: Items in Section 4 are genuinely unresolved. No defaults are imposed; each requires owner decision when ICE evolution is pursued.
- **Implementation evidence**: Zero implementation evidence. This seed is purely documentary/registry.
- **Z1 preservation**: Confirmed by static inspection of `ACE-Mission1-Import-Workflow-Reconciliation.md` report and repository state audit (HEAD `795dc0a6ac66bef19725184107e6474b41aa1823`, branch `mission1-planning-docs`).

---

## 8. Next Steps (Owner-Decided, Not Authorized by This Seed)

When the owner is ready to pursue ICE evolution, the following decisions will be needed:

1. **Prototype validation**: Test the ≥80% shared-workflow target with a small ICE prototype.
2. **Content-type configuration**: Define which workflow stages are mandatory vs. optional per content type.
3. **Representation schemas**: Define independent export formats for Writer content, Script, Storyboard, and produced assets.
4. **Output spec matrix**: Define output formats, dimensions, aspect ratios, codecs per content type.
5. **Publish destination mapping**: Map content types to publishing destinations.
6. **Actor Studio integration points**: Define continuity boundaries from ICE to future Actor Studio.
7. **ACE/ICE boundary enforcement**: Strategy for keeping ACE-specific affiliate capabilities distinct.

**No steps from this list are authorized or required at this time.** This seed is a registry document only.

---

**ICE Evolution Seed = REPORTED**

**Implementation = NOT PERFORMED**

**Runtime validation = NOT PERFORMED**

**Z1 / Mission 1 Status = UNCHANGED** (all six values preserved exactly as specified in ACE Mission 1 requirements)

**ICE is a proposed future evolution; ACE remains the existing foundation with unchanged scope and status.**