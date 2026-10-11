# User Acceptance Testing (UAT) Report — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 (Template — to be completed before release) |
| Date | UAT planned for Week 7 (2026-11-23 to 2026-11-26) |
| Release under test | v1.0.0 (release candidate tag `v1.0.0-rc.1`) |
| Tester (UAT owner) | Product owner |

## 1. Purpose
Confirm that My Vehicle Spend meets the business requirements (BRD) and user requirements (URS) and may be released.

## 2. UAT Scope
- URS scenarios S1–S4 executed end-to-end on a real phone and a laptop.
- All **Must** user needs (UR-01 to UR-24 marked Must) verified.
- Sample of **Should** needs verified.
- Real-world data entry for at least 30 days of prior history (or 1 month reconstructed from bills).

## 3. Test Environment
| Item | Value |
|---|---|
| Frontend URL | https://<production-domain> |
| Backend | Supabase production project (Mumbai region) |
| Devices | Android phone (Chrome), iPhone (Safari 16.4+), Windows laptop (Edge) |
| Network | 4G / Wi-Fi / airplane mode |
| Vehicles used | One car, one bike (owner's own) |

## 4. UAT Scenario Results

| Scenario | Description | Result | Comments |
|---|---|---|---|
| S1 | Quick fuel entry in ≤ 20 s, including offline | ☐ Pass ☐ Fail | |
| S2 | Insurance renewal flow and next reminder | ☐ Pass ☐ Fail | |
| S3 | Car loan review and prepayment simulation | ☐ Pass ☐ Fail | |
| S4 | FY report exported to Excel | ☐ Pass ☐ Fail | |

## 5. User Requirement Coverage

| UR ID | Requirement (short) | Priority | Result | Evidence |
|---|---|---|---|---|
| UR-01 | Add car/bike | Must | ☐ Pass ☐ Fail | |
| UR-02 | Multiple vehicles | Must | ☐ | |
| UR-03 | Quick fuel log | Must | ☐ | |
| UR-04 | Automatic mileage | Must | ☐ | |
| UR-05 | Service bill with GST | Must | ☐ | |
| UR-06 | FASTag & tolls | Must | ☐ | |
| UR-07 | Insurance premium & renewal | Must | ☐ | |
| UR-08 | PUC / insurance / licence reminders | Must | ☐ | |
| UR-09 | Challan record | Should | ☐ | |
| UR-10 | RTO costs | Must | ☐ | |
| UR-11 | Loan EMI schedule | Must | ☐ | |
| UR-12 | Record actual EMI | Must | ☐ | |
| UR-13 | Prepay / foreclose simulation | Should | ☐ | |
| UR-14 | Cost per month & km | Must | ☐ | |
| UR-15 | Spend chart | Must | ☐ | |
| UR-16 | FY total | Should | ☐ | |
| UR-17 | Export to Excel | Must | ☐ | |
| UR-18 | Receipt photo | Should | ☐ | |
| UR-19 | Offline use | Should | ☐ | |
| UR-20 | Install to home screen | Must | ☐ | |
| UR-21 | Privacy | Must | ☐ | |
| UR-22 | Backup and restore | Must | ☐ | |
| UR-23 | Delete account | Must | ☐ | |
| UR-24 | EV charging | Should | ☐ | |
| UR-25 | Loan prepayment record | Should | ☐ | |

## 6. Defects Outstanding at UAT Close
| DTL ID | Severity | Status | Accepted for release? |
|---|---|---|---|
| — | — | — | — |

## 7. Usability Observations
| Observation | Impact | Action |
|---|---|---|
| | | |

## 8. Overall Assessment
- Must requirements passed: ____ / ____
- Should requirements passed: ____ / ____
- Open Critical / High defects: ____
- **Recommendation:** ☐ Accept for release ☐ Accept with known issues ☐ Reject

## 9. Sign-off

| Role | Name | Decision | Signature | Date |
|---|---|---|---|---|
| Product owner / UAT lead | | ☐ Accept ☐ Reject | | |
| Developer | | | | |
