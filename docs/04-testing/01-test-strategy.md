# Test Strategy / Test Plan — My Vehicle Spend

| Field   | Value       |
| ------- | ----------- |
| Version | 1.0 (Draft) |
| Date    | 2026-10-11  |
| Covers  | SRS v1.0    |

## 1. Objectives

1. Prove every Must requirement works as specified.
2. Prove financial calculations (EMI, schedule, mileage, totals) are exact.
3. Prove data privacy: one user cannot read or change another user's data.
4. Prove the PWA installs and works offline for reads and queued writes.
5. Confirm usability for the primary scenarios (URS S1–S4).

## 2. Scope

| In scope                                         | Out of scope                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Functional features FR-AUTH to FR-DATA           | Load testing beyond 100 concurrent users (not needed for personal use) |
| Financial calculations                           | Penetration testing by third party (self-review only)                  |
| RLS and storage policies                         | Native app store builds                                                |
| PWA install & offline                            | Payment gateway (not present)                                          |
| Browsers: Chrome, Edge, Firefox, Safari (iOS)    | Internet Explorer / legacy browsers                                    |
| Devices: Android mid-range, iPhone, Windows, Mac |                                                                        |

## 3. Test Levels

| Level               | Tool                                   | Owner | Coverage target                          |
| ------------------- | -------------------------------------- | ----- | ---------------------------------------- |
| Unit                | Vitest                                 | Dev   | ≥ 90% of `src/core`; ≥ 70% overall       |
| Component           | Vitest + Testing Library               | Dev   | All forms and key states                 |
| Database            | SQL test scripts (pgTAP optional)      | Dev   | Every RLS policy, every CHECK, every RPC |
| API / integration   | Vitest against local Supabase          | Dev   | Each endpoint in API doc                 |
| End-to-end          | Playwright (Chromium, WebKit, Firefox) | Dev   | Scenarios S1–S4 + STC critical paths     |
| PWA / Accessibility | Lighthouse CI, axe-core                | Dev   | Score ≥ 90 PWA, a11y no critical issues  |
| Manual exploratory  | Real devices                           | Owner | Install flow, offline, Indian formats    |
| UAT                 | Owner                                  | Owner | URS acceptance                           |

## 4. Test Environments

| Env        | Backend                          | Frontend          | Data                                                    |
| ---------- | -------------------------------- | ----------------- | ------------------------------------------------------- |
| Local      | Supabase local (Docker)          | `npm run dev`     | Seeded fake data                                        |
| CI         | Supabase local in GitHub Actions | Built bundle      | Seeded fake data                                        |
| Staging    | Supabase free project "staging"  | Preview deploy    | Synthetic data only                                     |
| Production | Supabase free project "prod"     | Production deploy | Real user data — **no testing here except smoke tests** |

## 5. Test Data

- Synthetic persona data in `src/test/fixtures/`: two users (`alice@test.local`, `bob@test.local`), two vehicles each, 200 expenses, 40 fuel fills, one 60-month loan.
- Reference loan: ₹8,00,000 @ 9.25% for 60 months. Expected EMI and totals are computed independently (see STC-LOAN-01) with a spreadsheet formula `=PMT(9.25%/12, 60, -800000)`.
- Never use real registration numbers or account numbers in tests; use `MH00TEST0001`-style values.

## 6. Entry & Exit Criteria

**Entry (start system testing):**

- All Must features coded and merged to `develop`.
- Unit tests green in CI.
- Migrations applied to staging.

**Exit (release):**

- 100% of Must STC executed; ≥ 95% pass; zero open Critical or High defects.
- Should STC: ≥ 85% pass; open items logged with workaround.
- RLS suite 100% pass.
- EMI reference tests match to ₹0.01.
- Lighthouse PWA installable; Performance ≥ 90 on mobile profile.
- UAT sign-off recorded.

## 7. Defect Management

- Severity: **Critical** (data loss/leak, cannot save), **High** (feature broken, no workaround), **Medium** (workaround exists), **Low** (cosmetic).
- Priority: P1 (fix before release), P2 (next release), P3 (backlog).
- Process: found → logged in DTL → triaged → fixed on `fix/*` branch → verified → closed.
- Defect IDs: `DTL-###`.

## 8. Test Automation Strategy

- Every PR runs: lint, typecheck, unit, component, RLS, E2E smoke (5 min budget).
- Nightly on `develop`: full E2E across browsers, Lighthouse.
- Flaky test policy: quarantined after 2 unexplained failures, fixed within one week.

## 9. Test Deliverables

| Deliverable          | File                        |
| -------------------- | --------------------------- |
| Test strategy (this) | `01-test-strategy.md`       |
| System test cases    | `02-system-test-cases.md`   |
| Defect log           | `03-defect-tracking-log.md` |
| UAT report           | `04-uat-report.md`          |
| Coverage report      | CI artifact (not committed) |

## 10. Risks to Testing

| Risk                                   | Mitigation                                                    |
| -------------------------------------- | ------------------------------------------------------------- |
| Safari iOS PWA quirks                  | Manual test on real iPhone before release                     |
| Supabase local vs cloud differences    | Run RLS tests against staging too                             |
| Date/timezone bugs around midnight IST | Test cases with 23:59 and 00:01 IST; use fixed clock in tests |
| Offline sync race conditions           | Scripted scenarios (airplane mode toggle) in STC-SYNC         |

## 11. Schedule

Testing runs in parallel with development from Week 3 (see SPMP). Final regression in Week 7.

## 12. Roles

Developer writes automated tests. Owner performs manual exploratory and UAT. Where possible, a 24-hour gap is left between writing and self-testing a feature.
