# ACE-MAI-S1 — Phase A Preparation Plan — Stop Conditions

**Associated documents:**  
- `tmp/ACE-MAI-S1-v0.2-SEPARATE-DELIVERABLES.md`  
- `tmp/ACE-MAI-S1-v0.2-ACCEPTANCE-CRITERIA-MATRIX.md`

**Working baseline:** v0.1 (Draft)  
**Target revision:** v0.2 (Draft)  
**Status:** Proposed — Pending Owner Review

---

## 1. General rule

If any activity may breach an authorization boundary, stop the affected activity, preserve relevant evidence, notify the Owner, and do not resume until new explicit Owner authorization is received.

No AI agent, reviewer, or team member may independently authorize resumption.

---

## 2. Two stop-condition families

### 2.1 Evidence Quality / Data Quality Stop

This applies when:

- required evidence is unavailable,
- evidence is ambiguous or internally inconsistent,
- a claim relies on an artifact that has not been supplied,
- a mock/fixture artifact is at risk of being treated as real,
- a provisional mapping is at risk of being treated as verified,
- a conclusion is at risk of being upgraded beyond the supporting evidence.

An Evidence/Data Quality Stop is not, by itself, an authorization breach.

### 2.2 Authorization Boundary Breach

This applies when:

- an activity approaches creating products, content, tracking links, or orders on Shopee,
- an activity approaches contacting Shopee or using Shopee APIs,
- an activity approaches generating actual revenue or transaction data,
- an activity approaches incurring costs,
- an activity approaches modifying repositories, application code, or governance ledgers,
- an activity approaches implementation, deployment, or live testing beyond documentation and readiness,
- an activity approaches a conclusion that cannot be supported by the evidence.

A potential authorization-boundary breach must follow the mandatory sequence:

**STOP → PRESERVE EVIDENCE → NOTIFY OWNER → WAIT FOR EXPLICIT OWNER AUTHORIZATION.**

No AI or team member may independently authorize resumption after an Authorization Boundary breach.

If classification is uncertain, stop the affected activity and escalate to Owner.

---

## 3. Plan Preparation stop conditions

Plan Preparation stops or defers if any of the following occurs:

1. A provisional finding is at risk of being silently upgraded to a verified fact.
2. A mock or fixture artifact begins to be treated as real evidence.
3. Any activity approaches creating products, content, tracking links, or orders on Shopee.
4. Any activity approaches contacting Shopee or using Shopee APIs.
5. Any activity approaches generating actual revenue or transaction data.
6. Any activity approaches incurring costs.
7. Any activity approaches modifying repositories, application code, or governance ledgers.
8. Any activity approaches implementation, deployment, or live testing beyond documentation and readiness.
9. A conclusion is requested that cannot be supported by the evidence.

If any Plan Preparation stop condition is met:

- **Classification:** Evidence/Data Quality Stop for items 1, 2, and 9; Authorization Boundary Breach for items 3 through 8.
- **Trigger:** the listed condition appears or is credibly imminent.
- **Immediate response:** stop the affected drafting or analysis activity.
- **Activity to stop:** the specific preparation work approaching the boundary.
- **Person or role responsible for recording the Stop Event:** the person or role performing the affected preparation work, recording the stop in the work area used for the package.
- **Minimum evidence to preserve:** current draft text, notes, classification decisions, the affected artifact or claim context, and the point at which the boundary was approached.
- **Owner notification responsibility and timing:** notify the Owner as soon as practicable after the Stop Event is recorded; the notification should state the stop condition, the activity affected, and whether the stop is an Evidence/Data Quality Stop or an Authorization Boundary Breach.
- **Required review responsibility:** review whether the draft should be tightened, scoped down, or held.
- **Exact authority required to resume:** new explicit Owner authorization.

---

## 4. Phase A Preparation Activities stop conditions

If Phase A Preparation Activities are later authorized, the same nine conditions apply, with the same operational response pattern and the same two families. In addition:

- Any Phase A activity that would begin to blur the line between preparation and execution must stop.
- Any Phase A activity that would treat provisional mapping as verified must stop.
- Any Phase A activity that would rely on evidence that is not yet available must stop or defer.

If any Phase A stop condition is met:

- **Classification:** Evidence/Data Quality Stop for evidence-availability, mock/real, and provisional-mapping issues; Authorization Boundary Breach for activities approaching real data creation, external contact, API use, spend, repository/code/governance modification, or live testing beyond readiness.
- **Trigger:** the listed condition appears or is credibly imminent during a Phase A activity.
- **Immediate response:** stop the specific Phase A activity.
- **Activity to stop:** the Phase A workstream task approaching the boundary.
- **Person or role responsible for recording the Stop Event:** the person or role performing the affected Phase A workstream task.
- **Minimum evidence to preserve:** workstream notes, intermediate outputs, classification decisions, the affected artifact or claim context, and the boundary trigger.
- **Owner notification responsibility and timing:** notify the Owner as soon as practicable after the Stop Event is recorded; the notification should state the stop condition, the Phase A activity affected, and whether the stop is an Evidence/Data Quality Stop or an Authorization Boundary Breach.
- **Required review responsibility:** review of whether the activity should continue in a narrower form or be deferred.
- **Exact authority required to resume:** new explicit Owner authorization.

---

## 5. Classification reminder

An Evidence/Data Quality Stop must not automatically be described as an authorization-boundary breach unless the facts support that classification.

Conversely, any activity approaching a boundary in items 3 through 8 must be treated as a potential Authorization Boundary Breach and must follow the mandatory sequence in Section 2.2.

---

## 6. Stop-event record requirements

Each Stop Event should be recorded with, at minimum:

- date/time recorded,
- workstream or preparation activity affected,
- stop condition invoked,
- classification: Evidence/Data Quality Stop or Authorization Boundary Breach,
- trigger description,
- immediate response taken,
- evidence preserved,
- owner notification sent and when,
- required review action,
- authority required to resume,
- whether resumption was authorized, and if so, by whom and under what authority.

---

## 7. Where this is operationalized

- WS-05 acceptance criteria require stop conditions to define trigger, immediate response, affected activity, role responsible for recording the Stop Event, minimum evidence to preserve, owner notification responsibility and timing, required review responsibility, and exact authority required to resume.
- WS-07 acceptance criteria require that the readiness assessment record this stop model rather than leaving it as aspirational wording.
- Section 8 of the main v0.2 document summarizes the same model for easier reading.
