# Mission 1 — Evidence Log (append-only)

Schema per `docs/mission1/D-data-model.md` §3.1. One block per source.

Rules:
- Every entry has a source, a URL or file reference, and a retrieval date.
- `claim_class` is one of FACT / INFERENCE / HYPOTHESIS / UNKNOWN.
- FACT claims require a URL or file reference. Anything used in a decision must be class FACT or INFERENCE.
- Nothing is recorded here until it has actually been inspected. An application submission is `PENDING`, never `VERIFIED`.
- Entries are never edited to change a finding; a correction is a new entry referencing the old id.

Entry format — each entry begins with a level-2 heading such as `## EV-1-2`, followed by:

```
id: EV-<cycle>-<n>
- source_name:
- url_or_reference:
- retrieved_at:
- finding:
- relevance_note:
- claim_class:
- methodology_limitations:
- related_program:
```

## Entries

## EV-1-1
- **source_name:** ACE planning documents — Data Model Specification
- **url_or_reference:** `docs/mission1/D-data-model.md` §3.1 (repository file)
- **retrieved_at:** 2026-10-19
- **finding:** An Evidence record requires `id`, `source_name`, `url_or_reference`, `retrieved_at`, `finding`, `relevance_note`, and `claim_class` (FACT / INFERENCE / HYPOTHESIS / UNKNOWN); Facts require a URL or file reference.
- **relevance_note:** Defines the schema this log follows, so later entries are comparable and auditable.
- **claim_class:** FACT
- **methodology_limitations:** Internal planning document, not an external market or program source. It carries no product, channel, commission, or performance claim.
- **related_program:** none (internal document)

## EV-1-2
- **source_name:** Shopee TH Help Center — Shopee Affiliate Program terms (dated 20 January 2026), §§1.1, 2.1–2.3
- **url_or_reference:** https://help.shopee.co.th/portal/4/article/200784
- **retrieved_at:** 2026-10-19
- **finding:** Applicants may be buyers or sellers (§1.1). Affiliate Media must be publicly accessible and approved by Shopee; examples include websites/blogs, Facebook, Pinterest and Twitter (§2.3, §2.3(ก)). Facebook promotion must use a Fan Page, not a personal page. Shopee has sole discretion to approve or reject an application (§2.1). No follower minimum appears in the terms or the application page checked.
- **relevance_note:** Determines which registered channel can be used and establishes that approval is discretionary, not automatic.
- **claim_class:** FACT
- **methodology_limitations:** Terms text only. A follower or account-age requirement may exist in the application UI, which was not accessed; "not found" is not proof of absence.
- **related_program:** shopee_th

## EV-1-3
- **source_name:** Shopee TH Help Center — Shopee Affiliate Program terms (20 January 2026), §§1.13(ซ), 7.7(ง), 7.7(จ), 8.1
- **url_or_reference:** https://help.shopee.co.th/portal/4/article/200784
- **retrieved_at:** 2026-10-19
- **finding:** Content unrelated to the advertised product via an affiliate link is defined as spam (§1.13(ซ)). Compensation may be withheld or recovered for orders placed through the affiliate's own link, and for cancelled, incomplete, returned or refunded transactions (§7.7(ง), §7.7(จ)). Deceptive, misleading or fraudulent conduct is prohibited (§8.1).
- **relevance_note:** Sets the content and traffic rules that G3 must check and that measurement must not reward.
- **claim_class:** FACT
- **methodology_limitations:** Clause summary from the official Thai text. The cross-referenced "prohibited actions" clause (§7.5 in the definition) was not fully readable in the fetched extract, so the full list is UNKNOWN.
- **related_program:** shopee_th

## EV-1-4
- **source_name:** Shopee TH Help Center — Shopee Affiliate Program terms (20 January 2026), §§4.2–4.3
- **url_or_reference:** https://help.shopee.co.th/portal/4/article/200784
- **retrieved_at:** 2026-10-19
- **finding:** PPS commission = seller commission rate × Net Completed Purchase Value, where net value deducts discounts, shipping fees, voucher fees and rebates such as Shopee Coins (§4.3). Seller rates may vary by product, product category and/or affiliate (§4.2); there is no single public rate.
- **relevance_note:** M1 arithmetic must use the actual seller rate shown per product, not a headline percentage from marketing material.
- **claim_class:** FACT
- **methodology_limitations:** The terms define the calculation but not which dashboard field displays each component; dashboard mapping remains UNKNOWN (OQ-8).
- **related_program:** shopee_th

## EV-1-5
- **source_name:** Shopee TH Help Center — Shopee Affiliate Program terms (20 January 2026), §7.4(b), §7.5(a)
- **url_or_reference:** https://help.shopee.co.th/portal/4/article/200784
- **retrieved_at:** 2026-10-19
- **finding:** Payment requires an account balance of at least THB 100 on the payment date; lower balances carry forward. The terms state bank transfer every two weeks, with payment within 15 days after Shopee approves the payable amount and receives the required invoice.
- **relevance_note:** Establishes the payout threshold and a terms-level payment cadence for M2 planning.
- **claim_class:** FACT
- **methodology_limitations:** The cadence conflicts with the 2026 payout help page (EV-1-6); the owner's dashboard remains authoritative for actual timing.
- **related_program:** shopee_th

## EV-1-6
- **source_name:** Shopee TH Help Center — "รอบการจ่ายเงินโปรแกรม Shopee Affiliate ปี 2026" (2026 payment cycles)
- **url_or_reference:** https://help.shopee.co.th/portal/10/article/142437
- **retrieved_at:** 2026-10-19
- **finding:** Individuals not VAT-registered are paid twice a week for new bills; juristic persons and VAT-registered individuals are paid twice a month, including historical bills. Pre-payment conditions: KYC status "ยืนยัน (Valid)" and accumulated compensation of at least THB 100. Normal delays are 1–2 days, or 1–3 business days during a bank-system disruption.
- **relevance_note:** More current operational cadence than the terms and directly relevant to when M2 cash can be recorded.
- **claim_class:** FACT
- **methodology_limitations:** Conflicts with §7.4's "every two weeks" in EV-1-5. The page describes policy, not this account's actual payment history.
- **related_program:** shopee_th

## EV-1-7
- **source_name:** Shopee TH Help Center — "(FAQ) ทำไมบางคำสั่งซื้อค่าตอบแทนขึ้นเป็น 0" (order status and zero commission)
- **url_or_reference:** https://help.shopee.co.th/portal/10/article/136159
- **retrieved_at:** 2026-10-19
- **finding:** Commission is earned only when an order reaches "สำเร็จ" (received). Statuses listed: "รอดำเนินการ" (paid, not yet received), "สำเร็จ" (received), "ยกเลิกแล้ว" (cancelled), "ยังไม่ชำระเงิน" (unpaid). Cancelled or unpaid orders earn THB 0. Certain categories earn no commission at all: jewellery, weapons, tobacco, living organisms/animal remains, services, and powdered milk.
- **relevance_note:** Defines which dashboard status may count toward M1 and constrains which product categories can support the experiment.
- **claim_class:** FACT
- **methodology_limitations:** No "refunded" status is listed; refunds appear only as a recovery ground in §7.7 (EV-1-3). Actual dashboard field names and layout are UNKNOWN until account access.
- **related_program:** shopee_th

## EV-1-8
- **source_name:** Shopee TH Help Center — "วิธีการสมัครโปรแกรม Shopee Affiliate" (how to apply)
- **url_or_reference:** https://help.shopee.co.th/portal/10/article/123889
- **retrieved_at:** 2026-10-19
- **finding:** Application is made through the website or the Shopee app by entering account and personal details and connecting the social channel used for promotion. For website applications, a confirmation email is expected within 1–2 business days; the page then describes starting to promote under program conditions. No official definitions of pending/approved/rejected application statuses, and no guaranteed end-to-end approval time, were found.
- **relevance_note:** Bounds what "under document review" can mean and prevents inferring approval from submission.
- **claim_class:** FACT
- **methodology_limitations:** The page states a confirmation-email window, not an approval decision. The owner's actual application status was not accessed (see EV-1-10).
- **related_program:** shopee_th

## EV-1-9
- **source_name:** Shopee TH Help Center — "(FAQ) กรอกข้อมูลการชำระเงินและภาษีไปแล้ว ใช้ระยะเวลาในการตรวจสอบนานแค่ไหน?" (payment/tax verification time)
- **url_or_reference:** https://help.shopee.co.th/portal/10/article/135876
- **retrieved_at:** 2026-10-19
- **finding:** Payment/tax data is reviewed only for partners whose accumulated earnings reach THB 1,500; once reached, review is within 30 business days. Requirements include Thai-language entries, name and address matching the ID card, a bank-book page in the same name, and tax ID/address matching the ID card, ภ.พ.20, or company certificate. The page states partners may promote while awaiting review.
- **relevance_note:** Reconciles the THB 100 payout minimum (EV-1-5/EV-1-6) with a separate THB 1,500 review trigger; they are different conditions and must not be conflated.
- **claim_class:** FACT
- **methodology_limitations:** Review time is a stated maximum, not a guarantee. This is payment/tax KYC review, not the affiliate application review.
- **related_program:** shopee_th

## EV-1-10
- **source_name:** Owner report (conversation, 2026-10-19)
- **url_or_reference:** Conversation record, 2026-10-19 (no file)
- **retrieved_at:** 2026-10-19
- **finding:** The owner reports that the Shopee Affiliate application is under document review. No official status page or account was accessed in this task.
- **relevance_note:** The only known application status. It must not be recorded or treated as approval.
- **claim_class:** UNKNOWN
- **methodology_limitations:** Self-reported and unverified against Shopee; the status may have changed. Official status requires account access, which this task forbids.
- **related_program:** shopee_th

## Remaining Phase 1 captures (not evidence)

Shopee terms and help pages have been inspected (EV-1-2..EV-1-9). Still outstanding:

1. ACCESSTRADE TH publisher requirements and payout terms (program's own page)
2. Official Shopee application outcome (owner reports document review; no account access yet)
3. Channel eligibility: TikTok profile-link gate and/or Facebook Page bio link (in-app)
4. Channel policy checklist: commercial disclosure and AI-label requirements (platform-level; the Shopee terms do not state an affiliate-disclosure rule)
5. Niche/product evidence for Stage 1 candidates (public product pages)
6. OQ-8: dashboard field mapping for commission statuses (requires account access)
