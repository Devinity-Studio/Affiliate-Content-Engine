# Actor Studio — Digital Talent Lifecycle Seed

**Status:** OWNER-PROPOSED SEED · PENDING OWNER REVIEW · NOT APPROVED FOR IMPLEMENTATION  
**Purpose:** Preserve the proposed Actor Studio (ACS) vision, its original evidence, and unresolved decisions in one reusable location. This document is a seed for later reconciliation, not an architecture, specification, or implementation authorization.

## 1. Provenance and evidence boundaries

This seed keeps observed source content separate from owner-proposed concepts and approval status.

### 1.1 Original evidence observed in the repository

The following source files were inspected directly when this seed was prepared:

| Source | Observed content | Evidence boundary |
|---|---|---|
| [`../../reference/AI Brand Models_ Custom Faces, Voices, and Content.png`](../../reference/AI%20Brand%20Models_%20Custom%20Faces,%20Voices,%20and%20Content.png) | AI Brand Model concept describing an original AI-created model, appearance, personality, voice, presentation style, and continued use in content. | Concept image only. Its statements about ownership or commercial rights are not verified legal evidence. |
| [`../../reference/UX_UI Concept.png`](../../reference/UX_UI%20Concept.png) | UI concept showing a character, storyboard, dialogue, and an example persona with descriptive attributes. | Mockup, not an approved character-record specification. |
| [`../../reference/AI Storyboard Dashboard in Dark Mode.png`](../../reference/AI%20Storyboard%20Dashboard%20in%20Dark%20Mode.png) | Storyboard scene cards with an apparently recurring presenter across scenes. | UI reference; does not establish identity persistence across projects. |
| [`../../reference/Affiliate Content Engine UX_UI new workflow.html`](../../reference/Affiliate%20Content%20Engine%20UX_UI%20new%20workflow.html), Step 8, Option C, “Save to Asset Library” | Mockup proposes saving image and voiceover components to a shared library for reuse in later projects. | Proposal/mockup. The sample interaction does not establish a working library or actor linkage. |
| [`../../reference/Note.txt`](../../reference/Note.txt), “สมัครไว้ก่อน” and tool sequence | Tool note discussing Thai text-to-speech experiments and a Voice Agent, including Google/Azure TTS and local Remotion rendering. | Tool exploration note; does not define a persistent voice identity, permissions, or ACS integration. |

These are **original source references**, not proof that ACS was approved or implemented.

### 1.2 Related ACE specifications and implementation context

| Source | What it establishes | What it does not establish |
|---|---|---|
| [`../mission1/D-data-model.md`](../mission1/D-data-model.md), §§3.3–3.5 | ACE specifications for content blueprint, Script/storyboard, Script version linkage, and Content Asset metadata. | No ACS actor entity, Master Identity, Character Bible, actor rights record, role history, or actor-specific usage history. |
| [`../mission1/C-system-architecture.md`](../mission1/C-system-architecture.md), §§2–3 | Mission 1 ACE file-based/manual workflow context and a general Git version-history approach. | No ACS system boundary or ACS–ACE integration contract. |
| [`../mission1/F-implementation-roadmap.md`](../mission1/F-implementation-roadmap.md), §7 | ACE future-considerations registry explicitly marked “Not Approved for Implementation.” | No ACS Seed pointer was present in the inspected section. |
| [`../mission1/J-ten-step-workflow-specification.md`](../mission1/J-ten-step-workflow-specification.md), §§4–6 and §10 | ACE content-production workflow and a next-cycle seed form for carrying learnings forward. | The workflow’s “seed” means ACE learnings; it is not an ACS digital-talent seed. |
| [`../../app/mvp/service.js`](../../app/mvp/service.js) | The inspected MVP module documents an affiliate research/content workflow and its own fixture-state boundaries. | No actor lifecycle implementation was observed in the inspected source. |

Mission 1 documents remain governed by their own recorded status and approvals. This seed does not amend or reinterpret them.

## 2. Owner-confirmed conceptual intent

The following is captured from the owner's proposal for this seed. It is not asserted as repository evidence or approved implementation.

### 2.1 Actor Studio and Actor Library

**Actor Studio** is proposed as a dedicated capability for creating, customizing, and managing reusable digital actors—not merely a one-time image generator.

**Actor Library** is proposed as a catalog from which ACE, ICE, and future production workflows may select actors.

Potential actor types include:

- Virtual humans and digital presenters
- Cartoon or animated characters
- Mascots
- Animals and other character types

An actor may have a distinctive identity, personality, visual appearance, voice, lifestyle, and performance style.

### 2.2 Actor lifecycle concepts proposed for preservation

1. **Master Identity / Character Bible:** the defining identity and characteristics of an actor.
2. **Reference Assets:** reference images, voice references, and other relevant assets.
3. **Roles and Assignments:** work an actor may perform, such as host, presenter, model, or fictional character.
4. **Version History:** preserve earlier identity and asset versions; changes must not silently alter existing work.
5. **Usage and Career History:** record assignments and relationships to projects and produced works.
6. **Rights and Permissions:** record applicable ownership, licenses, consent, usage scope, and restrictions where relevant.
7. **Content Relationships:** relate the actor identity and specific actor version used to scripts, storyboards, production assets, and content records.
8. **Cross-Format Reuse:** potential use in YouTube series, movies, podcasts, advertisements, and other formats.
9. **Value Development:** recognition and commercial opportunities may develop over time, but audience value and commercial success must be demonstrated by evidence rather than assumed.

These concepts are owner-proposed content for future reconciliation; listing them here does not make them approved requirements.

## 3. Proposed relationship to ACE and ICE

The owner proposes that Actor Studio own the actor lifecycle and actor-specific records, while ACE and ICE share a content-production workflow and may select actors from the Actor Library.

```text
Actor Studio (proposed actor lifecycle)
    └── Actor Library (proposed reusable actor catalog)
          ├── may be selected by ACE
          ├── may be selected by ICE
          └── may be selected by future production workflows

ACE / ICE shared content workflow (proposed relationship)
    Plan → Storyboard → Production → Finalize → Publish → Monitor → Report
                                      │
                                      └── content record retains its own work/version history

Actor identity/version history and content/work history remain distinct,
with relationships between them to be decided later.
```

The examples of YouTube/Series, Movies, Podcast, and Ads are proposed content formats, not a confirmed or exhaustive format list.

**ICE Evolution Seed cross-reference:** No identifiable ICE Evolution Seed file or location was found in the repository locations inspected for this seed. The intended relationship is recorded conceptually above, but a direct document link cannot be supplied until the owner or a later inspection identifies the canonical ICE Seed location. Do not treat this note as evidence that an ICE Seed is persisted.

## 4. Proposed concepts versus source support

| Concept | Original-source support | Owner-proposed extension or boundary |
|---|---|---|
| Reusable digital actor with appearance, personality, voice, and style | Partially supported by the AI Brand Model image. | A dedicated Actor Studio and managed lifecycle are proposed. |
| Master Identity / Character Bible | Character attributes appear in concept imagery. | A canonical identity record and Character Bible are owner-proposed; no existing data specification was found. |
| Reference images, voice, and other assets | Images and voice are present in concept/mockup sources; a reusable asset library appears in a workflow mockup. | Actor-specific asset provenance, version binding, and permissions are proposed and unresolved. |
| Roles, assignments, projects, and career history | Persona and storyboard roles appear in mockups. | Structured role/assignment/career records are owner-proposed; no existing specification was found. |
| Version history and preserving prior work | ACE specifies Script version linkage and general Git history. | Actor identity/asset version history and protection of existing content from silent changes are owner-proposed extensions. |
| Usage history and rights/permissions | A source image asserts rights; this is not independently verified evidence. | Auditable actor usage, consent, licenses, restrictions, and scope are owner-proposed; legal and operational meaning remains open. |
| Cross-format reuse and value development | Existing concepts imply ongoing content use. | Cross-Format Actor Expansion and evidence-based development of audience/commercial value are owner-proposed. |
| ACE/ICE shared workflow and actor selection | ACE workflow exists in Mission 1 documentation. | ACS as a separate capability connected conceptually to ACE/ICE is owner-proposed; technical integration is undecided. |

## 5. Approval and implementation status

- Original reference images and notes are evidence of concepts, not approvals.
- ACE specifications describe ACE scope and must not be treated as ACS approval.
- No ACS-specific approval or implementation evidence is recorded by this seed.
- Storage of this proposed seed does not authorize implementation, integration, repository restructuring, or changes to ACE Mission 1 or Z1.

**Status:** `ACS Seed Consolidation = PENDING OWNER REVIEW`  
**Status:** `ACS Implementation = NOT APPROVED`  
**Status:** `ACE Mission 1 / Z1 = UNCHANGED`

## 6. Open reconciliation questions

These are unresolved topics, not decisions:

1. Is ACS a separate initiative with its own lifecycle, or a separately bounded capability in a wider product family?
2. What actor types and identity attributes are in scope, and how should a persistent identity be distinguished from a particular version?
3. What constitutes a Character Bible, and which details are defining versus changeable?
4. How should reference assets be sourced, attributed, versioned, and linked to an actor?
5. What evidence is needed for ownership, licenses, consent, permitted use, restrictions, and revocation?
6. How should roles, assignments, projects, and career/usage records relate to actor versions and produced works?
7. How will content records preserve the exact actor and asset versions used without merging actor history with content history?
8. Which formats are intended for the initial conceptual scope, beyond the examples listed here?
9. What evidence would support claims about audience recognition, accumulated value, or commercial opportunities?
10. Where is the canonical ICE Evolution Seed, and what exact relationship should be recorded between it, ACS, and the ACE/ICE shared workflow?
11. How should persistent visual, voice, and identity consistency across different tools be tested? It is not guaranteed by this seed.
12. What approval record, if any, would be required before this proposal becomes an approved specification or implementation scope?

## 7. Change discipline for later reconciliation

Keep original sources intact and cite them as evidence. When this seed is reviewed later, label any additions as owner proposals, source observations, specification decisions, or implementation evidence; record approval separately. Do not silently rewrite Mission 1 documents or treat this seed as authorization to build ACS.
