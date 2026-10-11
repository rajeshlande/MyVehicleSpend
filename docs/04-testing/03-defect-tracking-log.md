# Bug / Defect Track Log (DTL) — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 |
| Date created | 2026-10-11 |
| Owner | Developer / tester |
| Status | Open log, no defects logged yet (implementation not started) |

## 1. How to use
1. Log every failed test case as a defect with a new `DTL-###` ID.
2. Fill all fields. Attach screenshot or console output where useful.
3. Update status as it moves: **New → Triaged → In progress → Fixed → Verified → Closed** (or **Won't fix / Duplicate / Deferred**).
4. Never delete rows. Close them instead.

## 2. Field definitions

| Field | Values |
|---|---|
| ID | `DTL-001`, `DTL-002` … |
| Test case | `TC-xxx-nn` that failed (or "exploratory") |
| Requirement | FR/NFR ID |
| Severity | Critical · High · Medium · Low |
| Priority | P1 (before release) · P2 (next) · P3 (backlog) |
| Environment | Local / Staging / Prod; browser, OS, device |
| Build / commit | Git SHA |
| Steps to reproduce | Numbered |
| Expected | |
| Actual | |
| Status | New · Triaged · In progress · Fixed · Verified · Closed · Won't fix · Duplicate · Deferred |
| Fix commit / PR | |
| Verified by / date | |

## 3. Severity guide

| Severity | Definition | Example |
|---|---|---|
| Critical | Data loss, data leak, cannot sign in, financial total wrong | Other user's expense visible |
| High | Core feature broken with no workaround | Fuel log not saved |
| Medium | Feature wrong but workaround exists | Filter resets after edit |
| Low | Cosmetic or copy issue | Misaligned icon |

## 4. Defect register

| ID | Test case | Requirement | Severity | Priority | Environment | Summary | Status | Fix ref | Verified |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | *No defects logged yet* | — | — | — |

## 5. Example entry (template — delete when first real defect is logged)

| Field | Value |
|---|---|
| ID | DTL-000 (example) |
| Test case | TC-LOAN-02 |
| Requirement | FR-LOAN-03 |
| Severity | High |
| Priority | P1 |
| Environment | Staging, Chrome 130, Windows 11 |
| Build | `a1b2c3d` |
| Steps | 1. Create loan ₹8,00,000 @ 9.25%, 60 months. 2. Open schedule. 3. Sum principal column. |
| Expected | Sum = 800000.00 |
| Actual | Sum = 799998.97 |
| Root cause | Last-row adjustment not applied |
| Status | Fixed |
| Fix ref | PR #12 |
| Verified | Owner, 2026-10-20 |

## 6. Metrics (update at each milestone)

| Metric | Value |
|---|---|
| Total defects | 0 |
| Open Critical / High | 0 |
| Defect density (per KLOC) | — |
| Average time to fix | — |
| Reopened count | 0 |
