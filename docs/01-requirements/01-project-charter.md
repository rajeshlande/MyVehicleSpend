# Project Charter — My Vehicle Spend

| Field | Value |
|---|---|
| Document | Vision / Project Charter |
| Version | 1.0 (Draft) |
| Date | 2026-10-11 |
| Owner | Product owner (single user / personal project) |

## 1. Vision

Give every Indian car and two-wheeler owner a simple, private, free way to know exactly what their vehicle really costs per month and per kilometre — and to see their vehicle loan clearly.

## 2. Problem Statement

Vehicle costs in India are spread across many small, irregular payments: petrol top-ups, FASTag recharges, PUC renewals, insurance premiums, RTO fees, service bills, parking, and challans. Owners usually remember only the big items. Loan EMIs add interest cost that is rarely visible. Existing apps are either paid, ad-heavy, or do not understand Indian vehicle expense categories (PUC, RTO road tax, FASTag, challans, IDV-based insurance).

## 3. Business Goals

| ID | Goal | Measure of success |
|---|---|---|
| G1 | Capture all vehicle expenses in one place | ≥ 95% of a user's monthly spend logged within 30 days of first use |
| G2 | Show true cost of ownership | Dashboard shows cost/km and cost/month per vehicle |
| G3 | Track vehicle loans end-to-end | EMI schedule matches bank statement within ₹1 rounding |
| G4 | Zero recurring cost | Runs entirely on free tiers (see §7) |
| G5 | Installable, works offline-tolerant | Installable on Android/iOS/desktop; app shell loads offline |

## 4. Scope

### 4.1 In scope (v1.0)
- Multiple vehicles per user (car, bike/scooter).
- Expense logging across ~40 Indian vehicle expense sub-categories (see BRD Appendix A).
- Fuel log with automatic mileage (km/l) and cost/km.
- Document & renewal reminders (insurance, PUC, licence, RC/fitness where applicable).
- Vehicle loan tracker: EMI calculator, amortisation schedule, prepayment and foreclosure simulation, actual-vs-scheduled payment tracking.
- Receipt photo upload (compressed in browser).
- Dashboard, monthly/yearly reports, CSV export.
- Email magic-link / password login via Supabase Auth.
- PWA: installable, app-shell caching, offline read of cached data, offline queue for new entries.

### 4.2 Out of scope (v1.0)
- Bank account / UPI / SMS auto-import.
- Multi-user family sharing (planned for v2.0).
- Official RTO, insurer or FASTag API integrations.
- Tax filing advice. The app records amounts; it does not give tax advice.
- Native Android/iOS store apps (PWA only).

## 5. Key Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Vehicle owner (primary user) | End user | Quick logging, clear costs |
| Product owner | Decision maker | Scope, budget (₹0), timeline |
| Developer | Builder & maintainer | Maintainable free-tier stack |
| Future family member (v2) | Secondary user | Shared vehicle view |

## 6. Assumptions

1. Users have a smartphone with a modern browser (Chrome, Edge, Safari 16.4+, Firefox).
2. Users accept email-based sign-in.
3. Amounts are in INR; the app stores paise-safe values (`numeric(12,2)`).
4. Odometer readings are entered in km.
5. Initial user base is small (< 50 users), well inside free-tier limits.

## 7. Constraints

- **Budget:** ₹0 recurring. Only free tiers and open-source tools.
- **Supabase free tier:** 500 MB database, 1 GB file storage, 50,000 monthly active users, and projects pause after 7 days of inactivity. Verify current limits at supabase.com/pricing before launch.
- **Privacy:** personal financial data; must be protected by Row Level Security (RLS).
- **Timeline:** documentation first, then implementation (see SPMP).

## 8. High-Level Milestones

| Milestone | Target |
|---|---|
| M0 — Documentation approved | Week 1 |
| M1 — Backend schema + auth working | Week 2 |
| M2 — Core expense & fuel logging | Week 3–4 |
| M3 — Loan tracker & reminders | Week 5 |
| M4 — PWA, offline queue, reports | Week 6 |
| M5 — UAT & v1.0 release | Week 7 |

## 9. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Product owner | | | |
