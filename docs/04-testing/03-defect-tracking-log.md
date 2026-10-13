# Bug / Defect Track Log (DTL) — My Vehicle Spend

| Field        | Value                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| Version      | 1.0                                                                                  |
| Date created | 2026-10-11                                                                           |
| Owner        | Developer / tester                                                                   |
| Status       | 3 defects logged in T31 (all fixed and verified locally). Staging run pending (T33). |

## 1. How to use

1. Log every failed test case as a defect with a new `DTL-###` ID.
2. Fill all fields. Attach screenshot or console output where useful.
3. Update status as it moves: **New → Triaged → In progress → Fixed → Verified → Closed** (or **Won't fix / Duplicate / Deferred**).
4. Never delete rows. Close them instead.

## 2. Field definitions

| Field              | Values                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| ID                 | `DTL-001`, `DTL-002` …                                                                     |
| Test case          | `TC-xxx-nn` that failed (or "exploratory")                                                 |
| Requirement        | FR/NFR ID                                                                                  |
| Severity           | Critical · High · Medium · Low                                                             |
| Priority           | P1 (before release) · P2 (next) · P3 (backlog)                                             |
| Environment        | Local / Staging / Prod; browser, OS, device                                                |
| Build / commit     | Git SHA                                                                                    |
| Steps to reproduce | Numbered                                                                                   |
| Expected           |                                                                                            |
| Actual             |                                                                                            |
| Status             | New · Triaged · In progress · Fixed · Verified · Closed · Won't fix · Duplicate · Deferred |
| Fix commit / PR    |                                                                                            |
| Verified by / date |                                                                                            |

## 3. Severity guide

| Severity | Definition                                                  | Example                      |
| -------- | ----------------------------------------------------------- | ---------------------------- |
| Critical | Data loss, data leak, cannot sign in, financial total wrong | Other user's expense visible |
| High     | Core feature broken with no workaround                      | Fuel log not saved           |
| Medium   | Feature wrong but workaround exists                         | Filter resets after edit     |
| Low      | Cosmetic or copy issue                                      | Misaligned icon              |

## 4. Defect register

| ID      | Test case | Requirement | Severity | Priority | Environment                     | Summary                                                                                                                                   | Status   | Fix ref | Verified                                                         |
| ------- | --------- | ----------- | -------- | -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------- |
| DTL-001 | TC-UI-03  | NFR-USE-03  | Medium   | P1       | Local (Chromium, axe, PGlite)   | Dark mode: grey hint text, the account warning and the Home hero sat on hard-coded light backgrounds. Contrast below 4.5:1 (axe serious). | Verified | 7e7ad59 | Agent, local run, 2026-10-13. Owner re-check on staging pending. |
| DTL-002 | TC-UI-03  | NFR-USE-03  | Medium   | P1       | Local (Chromium, contrast test) | Light mode: white text on the offline banner was 4.24:1 (warn colour #b26a00). Changed to #8a5300 (6.33:1).                               | Verified | 7e7ad59 | Agent, local run, 2026-10-13.                                    |
| DTL-003 | TC-UI-05  | NFR-USE-03  | Low      | P2       | Local (Chromium, axe)           | Heading order: dashboard and reports sections jumped from h1 to h3 (axe moderate). Changed to h2.                                         | Verified | 7e7ad59 | Agent, local run, 2026-10-13.                                    |

## 5. Metrics (update at each milestone)

| Metric                    | Value |
| ------------------------- | ----- |
| Total defects             | 3     |
| Open Critical / High      | 0     |
| Defect density (per KLOC) | —     |
| Average time to fix       | —     |
| Reopened count            | 0     |
