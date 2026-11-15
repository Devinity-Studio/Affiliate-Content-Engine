Revised Finding Assessment — F-01 and Identifier Mapping

Mode: document-only analysis · Repository access: none · ODR modified: no · v1.2 produced: no

F-01 — Revised disposition

WITHDRAWN — PREMISE INCORRECT

Original premise (F-01): “the Owner’s record uses D-1 = Review Acceptance; the plan uses D-1 = Capture Plan Approval.”

Why it is wrong. The ODR text supplied from the Owner-confirmed record (§4) defines:

D-1 — Capture Plan Approval
D-2 — Baseline Capture Authorization
D-3 — Baseline Acceptance

and RA-1 does not appear in the record at all.

The “D-1 = Review Acceptance” usage originates after the record, in status summaries — including the Owner’s own status table — not in the record itself. F-01 treated a post-record alias as the authoritative mapping.

Consequence: the original recommendation (“align RA-1 → D-1”) must not be applied. Doing so would make the plan contradict the record the Owner actually confirmed.

Is §10 of Capture Plan v1.1 consistent with ODR §4?

Yes, for D-1/D-2/D-3.

Identifier	ODR §4	v1.1 §10	Consistent?
D-1	Capture Plan Approval	Capture Plan Approval — PENDING	Yes
D-2	Baseline Capture Authorization	Baseline Capture Authorization — NOT AUTHORIZED	Yes
D-3	Baseline Acceptance	Baseline Acceptance — NOT GRANTED	Yes
RA-1	not present	Review Acceptance — CLOSED	Addition, not a conflict

Caveat: RA-1 is a plan-level label, not an ODR identifier. §10 should say so explicitly, otherwise a reader may attribute RA-1 to the record.

Separation of Review Acceptance and Capture Plan Approval

Concept	Identifier	Meaning	Authority effect
Review Acceptance	RA-1 (plan-level label; not in ODR)	Closes the document-review stage	No plan approval; no capture authority
Capture Plan Approval	D-1 (ODR §4)	Owner accepts the plan	Does not authorize capture (see D-2)
Baseline Capture Authorization	D-2 (ODR §4)	Authorizes the capture scope/method	Does not accept the baseline
Baseline Acceptance	D-3 (ODR §4)	Owner accepts the evidence	Does not authorize implementation

These four must never be used interchangeably. The record’s D-1/D-2/D-3 are authoritative; RA-1 exists only to name the review stage without consuming an ODR number.

D-2 collision with the Option B path-boundary decision

The additional issue F-01 did not flag:

ODR D-2 = Baseline Capture Authorization.
v1.0 §10 used D-2 | APPROVED for the Option B path-boundary decision (Super Brain ratification: “D-2 APPROVED, path CLOSED”).
v1.1 §10 replaced that row with path boundary | CLOSED and added a clause that earlier D-2 uses must not override the current mapping — a partial mitigation, but the label itself is not renamed, so the collision persists in the historical record and in any cross-reference.

Risk: a reader who encounters “D-2 APPROVED” in the Option B materials could conclude that Baseline Capture Authorization exists — the opposite of the current status (NOT AUTHORIZED). This is a governance-level ambiguity, not a formatting issue.

Proposed non-colliding name:

PB-1 — Option B Path Boundary Decision (status: CLOSED)
Note: previously labelled “D-2” in v1.0; that label is retired and must not be read as ODR D-2.

Alternative acceptable names: OBB-1, PB-DEC-1. PB-1 is short, unique, and does not collide with RA-1 or D-1…D-3.

Required rows/notes in v1.2 (when ordered):

§10: PB-1 (formerly “D-2” in v1.0) — CLOSED
§10 clause: “Any earlier use of D-2 for the Option B path-boundary decision is renamed PB-1 and must not be confused with ODR D-2 Baseline Capture Authorization.”
Any Option B cross-reference that used D-2 for the boundary decision should carry the alias note until retired.

Revised findings register (delta only)

ID	Status	Severity	Subject
F-01	WITHDRAWN — PREMISE INCORRECT	—	Original D-1 collision claim
F-01R	OPEN (new)	MINOR	Post-record alias “D-1 = Review Acceptance” remains in status summaries; §10 should record that the ODR mapping is authoritative and RA-1 is a plan-level label
F-11	OPEN (new)	MAJOR	ODR D-2 collides with the Option B path-boundary decision; rename to PB-1 and add the alias note
F-02, F-03	OPEN	MAJOR	Unchanged (Git recovery ambiguity; missing explicit recovery statement)
F-04–F-07, F-10	OPEN	MINOR	Unchanged
F-08, F-09	OPEN	OBSERVATION	Unchanged

Effect on the v1.2 correction plan

Remove: the F-01 edit entirely.
Add: F-01R (alias/RA-1 provenance note) and F-11 (PB-1 rename + clause).
All other prepared edits (F-02, F-03, F-04–F-07, F-10) stand as previously drafted.

Evidence limitations

The ODR text is taken from the supplied extraction (record ACE-ODR-TR11-001, §4); it was not independently fetched or hash-verified by this review. The reported SHA-256 is of the extracted byte stream, not a value inside the record.
The post-record alias evidence (nodes/times) is as reported in the supplied finding, not independently verified.
No repository access, no capture, no hash computation, and no comparison against Capture Plan v1.0 was performed.
RA-1’s absence from the ODR is accepted as reported; if the record contains RA-1 elsewhere, F-01R should be re-checked.

Confirmation

The ODR text was not modified. No v1.2 was produced. No repository was accessed or modified, no baseline was captured, no hash was calculated, and no Gate or authorization status was changed.