# C. System Architecture — Affiliate Content Engine (Slice 1)

Status: DRAFT FOR OWNER APPROVAL · Version 1.0 · 2026-10-11

## 1. Design principle

The smallest architecture that can complete and evaluate the first vertical slice. Every component must earn its place by being needed for: one experiment, one asset, one publication, measured results, one report. Anything more is deferred to the Future Considerations registry (Doc F §7).

## 2. Minimum viable architecture

```
Operator (one computer)
  │
  ├─ AI assistant session (this agent, in a local Codebuff/CLI-style workspace)
  │     drafts: research, analysis, scripts, reports; edits files only
  │
  ├─ System of record: plain files in the repository (docs/, data/)
  │     - evidence log (markdown, one entry per source)
  │     - workflow state (yaml)
  │     - experiment record, decisions, publication records, result observations
  │     - version history (git, manual commits by owner/operator)
  │     - run history / error log (yaml)
  │
  ├─ External tools used directly by the operator (browser + phone)
  │     - affiliate program dashboards (Shopee/ACCESSTRADE/TikTok Shop/etc.)
  │     - publishing platform apps (TikTok / Facebook / YouTube)
  │     - free AI/production tools already on the computer
  │
  └─ Owner/operator — sole approver at gates G1–G5, G-pay
```

**No servers. No database. No dashboards. No CI/CD. No integrations beyond what each account's own dashboard provides.** All automation in Slice 1 is text/CI-free manual work guided by the workflow state files; the "engine" is the AI assistant plus these files, not a deployed system.

## 3. Components and responsibilities

| Component | Responsibility | Slice 1 implementation | Verified/proposal status |
|---|---|---|---|
| AI assistant session | Drafts, edits, audits, computes bookkeeping on supplied values; never fetches claims-as-facts | Already available to operator (this agent) | **Verified available** (operator uses it now) |
| System of record (files) | Single source of truth for state, evidence, decisions | `docs/mission1/*` + `data/mission1/*` | **Verified**: files exist once Deliverables accepted |
| Evidence log | Source, URL, retrieval date, finding, class tag | markdown file, one block per source | Proposal (file format), trivial to realize |
| Workflow state | Current stage, status, awaiting-gate | single yaml file | Proposal |
| Experiment record | Pre-registered hypothesis/offer/channel/criteria/budget | yaml + markdown narrative | Proposal |
| Decision log | G1–G5, G-pay approvals/rejections | markdown append-only | Proposal |
| Version history | Script/content/decision revisions | git commits in repo | **Verified available** (repo already exists) |
| Run history / error log | Actions, results, errors, resumable state | yaml append-only | Proposal |
| Publish kit generator | Assemble caption/hashtags/link/steps per channel | AI drafts markdown checklist per platform | Proposal |
| Observation capture sheets | Scheduled screenshot/export buckets | folder per cycle with date-stamped files | Proposal |

## 4. External dependencies & integration feasibility

**Program knowledge is account-specific.** The following reflects what operator research has so far established (source-logged in Doc H); acceptance of any program is an operator action, never the engine's.

| Program | Status for Slice 1 | Verified facts | Unknown (needs account access to confirm) |
|---|---|---|---|
| ACCESSTRADE TH | Preferred candidate for Lazada/Shopee campaigns | ฿500 min payout, monthly bank transfer on the 15th, publisher-facing reporting dashboard, publisher API documented | Actual commission rate for a specific campaign; account approval and API key issuance for this operator |
| TikTok Shop affiliate TH | Candidate if operator's TikTok ≥ 1,000 followers | Seller-set commission; commission released ~D+3/D+15 after delivery depending on seller settlement; in-app affiliate orders page; 7-day post-click add-to-cart attribution | Exact minimum follower rule for this operator as displayed in-app |
| Shopee TH direct | Candidate; terms unclear publicly | Thai portal exists; commissions described | Payout threshold/schedule/report fields/API — not verified |
| Amazon Associates | Deprioritized | Thai marketplace absent from Amazon's Associates locations; international-transfer country list excludes Thailand | Whether Amazon.com would accept Thai resident + payout route. Treat as low priority for Slice 1 |
| ClickBank | Deprioritized conditional | Doc'd Analytics API; threshold default $100 with CDR rule (5 sales/2 methods) | Thai-bank payout route/fees (wire/Payoneer) |
| YouTube Shopping affiliate | Not for Slice 1 | Requires YPP; for 2026, ≥ 500 subscribers; Thailand supported | Operator's channel eligibility today |
| Meta (Facebook/Instagram) affiliate | Not for Slice 1 | 2026 feature; Shopee listed as Thai launch partner; audience/Premium requirements not fully confirmed | Operator's account eligibility in-app |

**Publishing platform reality:** TikTok profile website link reportedly needs 1,000 followers (unverified in-app); YouTube Shorts description links not clickable; Meta native affiliate exists but eligibility per account unconfirmed. Conclusion: Slice-1 publications should assume **profile-bio link or native program tagging** and should avoid depending on any single platform's link affordance. This is why the workflow's Stage 3 requires the link form to be pinned before content is produced.

**AI tools:** AI assistant and free/existing production tools are assumed available at operator's workstation. Quota exhaustion triggers PAUSED_QUOTA, never a paid switch.

## 5. Security, privacy, access control, operational risks

- **No secrets in repo.** No passwords, no API keys, no account credentials, no payment info. Dashboard access stays with the operator, logged-into-browser directly.
- **Data minimization:** no personal data of third parties is stored; operator's own data stays in local files; PDPA relevance is minimal in Slice 1 (no personal data collected from anyone).
- **Access control:** the owner is the only approver; the AI session edits files but never approves gates. If more people join later, this must be revisited.
- **Operational risks:** single-machine loss (mitigate: git remote or periodic manual backup; operator's choice, no recurring cost required), platform policy change mid-experiment (mitigate: Stage 8 re-derive note; report flags Unknowns), affiliate program deactivation (mitigate: experiment record stores program terms snapshot screenshot).

## 6. Channel policy gold standard (publish checklist sources)

Platforms' current AI/commercial disclosure rules that Slice-1 content must satisfy, per channel; operator verifies in-app at publish time, since policies change:

- **TikTok:** commercial-content disclosure toggle required for brand/product promotion; AI-generated realistic media requires the AI-generated content label.
- **YouTube:** disclosure for meaningful realistic AI alteration (not for routine AI-assisted scripting); Shorts description links not clickable; YPP/monetization rules only affect ad revenue, not affiliate links.
- **Meta (FB/IG):** Paid Partnership label for branded/affiliate content; "AI Info" labels applied to AI-labeled media; profile bio links available; native affiliate feature availability varies.
- **Thai legal baseline:** Consumer Protection Act §22 prohibits false/misleading advertising; OCPB's direct-marketing license warning applies at ~THB 1.8M/yr scale — far above Slice-1 scope but noted. PDPA not triggered by Slice-1 activity.

(Exact in-policy wording to be re-verified at publish time; citations in Doc H.)
