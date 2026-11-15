# ACE Seed 01: IM Messenger for Bot, Automation & Owner Approval

**Status:** OWNER-PROPOSED SEED · PENDING OWNER REVIEW · NOT APPROVED FOR IMPLEMENTATION  
**Type:** Product Capability / Workflow Integration  
**Scope:** Concept for future consideration only. Not an approved requirement for development.

## 1. Concept and goals

Add IM Messenger as a communication and control channel for Affiliate Content Engine (ACE) so the Owner can receive notifications, review work, make decisions, and approve projects through Messenger without needing to keep the Dashboard open at all times.

IM Messenger must work with the existing ACE Workflow and must not create a separate workflow or separate source of truth for work status.

## 2. Expected capabilities

- **Notification:** Notify of work status, important events, and new opportunities that should be considered
- **Bot Command:** Accept commands to view work status, start processes that are authorized, or request Research to investigate further
- **Project Approval:** Send project drafts to the Owner for review and decision via IM
- **Decision Feedback:** Support approval, rejection, request for more information, or hold
- **Automation Integration:** Send bot/automation results back to the Owner with links to the originating work
- **Auditability:** Record decisions, approver, time, draft version, and results of related commands

## 3. Design principles

1. ACE is the source of truth for work status and approval results; IM is a communication and command channel.
2. Every command must pass permission and work-status checks before execution.
3. Bot notifications do not constitute approval.
4. Approvals must be tied to a specific project and version of the draft. If material changes occur after approval, assess whether re-approval is required.
5. Actions with external effects (e.g., publishing content or spending money) must follow permissions and scope granted by approval.
6. Design for replaceability/addition of IM providers without changing core ACE business logic.

## 4. Relationship to workflow

`Research → Opportunity Evaluation → Project Draft → IM Approval → Approved Execution → Result Tracking`

This is a conceptual path, not a change to an already-approved workflow. All steps must remain consistent with ACE's actual states and rules.

## 5. Unresolved decisions

- IM provider(s) to support (e.g., LINE, Telegram, Discord)
- Authentication/authorization model for command senders
- Message structure and approval button formats
- Mechanisms to prevent duplicate commands/duplicate approvals
- Notification policy (urgency, repetition)
- Integration approach with Bot, Automation, and ACE data stores

## 6. Future evaluation criteria

When moving to design/development, define how to prove IM can display status consistent with ACE, accept decisions securely, and record results for audit without treating UI rendering/message delivery alone as proof the workflow is correct.

## 7. Approval and implementation status

- Storing this seed does not approve system changes.
- Does not change acceptance criteria or imply Mission 1 Definition of Done is met.
- Status: `SEED` — concept for future consideration only.
