# Task List: My Vehicle Spend v1.0

Legend: `[ ]` open · `[x]` done · Size: XS (1 file) · S (1–2) · M (3–5) · L (5–8; split if larger)
Each task also requires the Definition of Done in `tasks/plan.md` §5.
Test IDs refer to `docs/04-testing/02-system-test-cases.md`.

---

## Phase 0 — Setup

- [x] **T1 — Scaffold the app and tooling** (M)
  - Acceptance: Vite + React 18 + TypeScript strict app in `src/`; ESLint, Prettier (per coding standards), Vitest, Playwright installed; `.env.example` present; one smoke test; `.github/workflows/ci.yml` runs lint, typecheck, test, build.
  - Verify: `npm run lint && npm run typecheck && npm test -- --run && npm run build` all pass.
  - Deps: None.

- [x] **T2 — Database schema migration 0001** (M)
  - Acceptance: `supabase/migrations/0001_init.sql` contains exactly the tables, CHECKs, composite FKs, triggers and indexes from `docs/02-architecture/04-database-schema.md` §3.
  - Verify: `npx supabase start && npx supabase db reset` succeeds; the `\d` output matches the doc.
  - Deps: T1.

- [x] **T3 — RLS policies and RPC/trigger functions** (M)
  - Acceptance: RLS enabled on all tables; owner-only policies; `anon` revoked; `add_fuel_log`, `check_odometer_monotonic` installed; views with `security_invoker`.
  - Verify: SQL test script `supabase/tests/rls.sql` covers TC-SEC-01 to TC-SEC-04 and passes.
  - Deps: T2.

- [x] **T4 — Seed system expense categories** (XS)
  - Acceptance: `supabase/seed.sql` inserts every system category from the schema doc §7 with `user_id` null.
  - Verify: `select count(*) from expense_categories where user_id is null` equals the expected count written in the seed test.
  - Deps: T2.

**CP-A Foundation — PASSED (2026-10-11).** lint ✔ typecheck ✔ 21 tests ✔ build ✔. Notes: DB tests run on PGlite, not Docker-based Supabase (see schema doc §11).

---

## Phase 1 — Auth & Shell

- [x] **T5 — Sign up, sign in, sign out, session persistence** (M)
  - Acceptance: FR-AUTH-01, 02, 04, 06; password min 8 characters; wrong password message; signed-out users redirected to login; profile row created on sign-up.
  - Verify: component tests with a mocked Supabase client ✔ (TC-AUTH-01, 02, 03, 04-guard, 06-sign-out). Profile trigger ✔ (DB test). **Pending:** live E2E on a Supabase project (TC-AUTH-04 persistence across browser restart, TC-AUTH-05 reset email).
  - Deps: T3.

- [x] **T6 — App shell and navigation** (M)
  - Acceptance: five-tab bottom nav with text labels (desktop sidebar ≥1024 px); colour tokens from UI/UX §6.1 with light and dark themes; empty-state components; offline banner placeholder.
  - Verify: TC-UI-01 ✔ (component test). TC-UI-02 ✔ and TC-UI-06 ✔ measured in Chromium at 320 px and 1280 px (`scripts/browser-checks.mjs`): no horizontal scroll, all interactive elements ≥ 44 px on sign-in, sign-up, shell and More pages. Fixed 17 px inline links (`main a` min-height 44 px). Caveat: signed-in content pages were measured only in the loading state (no backend in the sandbox). Finding: the centre “+” Add button's label is nearly invisible, to fix.
  - Deps: T5.

**CP-B (part 1)** — user can sign up and see the shell.

---

## Phase 2 — Vehicles

- [x] **T7 — Registration number and vehicle validation (pure)** (S)
  - Acceptance: normalise to upper-case no spaces; pattern from schema; display format `MH 12 AB 1234`; Zod schema for vehicle input (FR-VEH-01, FR-VEH-06).
  - Verify: unit tests; TC-VEH-04 invalid format rejected.
  - Deps: T1.

- [x] **T8 — Vehicle create, edit, list, active-vehicle switch** (M)
  - Acceptance: FR-VEH-01, 02, 04, 05; duplicate reg shows "A vehicle with this number already exists." (TC-VEH-03); active vehicle persists across refresh.
  - Verify: component tests ✔ TC-VEH-01, 02, 03, 05, 07. **Pending:** FR-VEH-05 (odometer derived from latest log) — needs fuel logs (T16). Archive ✔.
  - Deps: T3, T6, T7.

- [x] **T9 — Delete vehicle with typed confirmation** (S)
  - Acceptance: FR-VEH-03; requires typing `DELETE`; cascades to linked rows; other vehicles unchanged.
  - Verify: DB tests ✔ (soft-delete of vehicle and linked rows, cross-user blocked, double delete blocked); UI test ✔ (DELETE typed to enable). **Decision:** soft delete, not hard cascade — see schema doc N-7. **Decided (owner, 2026-10-11):** a deleted registration number is restored, not re-created — see T9b.
  - Deps: T8.

**CP-B (part 2)** — vehicles fully manageable.

---

## Phase 3 — Money & Expenses

- [x] **T9b — Restore deleted vehicle** (S)
  - Acceptance: a "Deleted vehicles" list on the Vehicles page with a Restore button for each; adding a vehicle whose registration number matches a deleted one offers Restore instead of failing with "already exists"; restore brings back the vehicle and its linked rows (expenses, fuel logs, reminders, loans) that the delete RPC soft-deleted.
  - Verify: DB test ✔ `tests/db/restore.test.ts` (owner restore; cross-user blocked; not-deleted rejected; earlier single deletes stay deleted; re-add blocked by unique index). UI test ✔ `restore.test.tsx`. Migration 0007.
  - Deps: T9.

- [x] **T10 — Money utilities (pure)** (S)
  - Acceptance: `round2`; INR formatting via `Intl.NumberFormat('en-IN')` (₹1,23,456.00); MoneyInput parses `123456.5` and `1,23,456.5`; amount bounds 0 < x ≤ 1 crore.
  - Verify: unit tests for TC-EXP-02 (boundaries) and TC-EXP-03 (grouping).
  - Deps: T1.

- [x] **T11 — Expense add, edit, delete, list (core fields)** (M)
  - Acceptance: FR-EXP-01 (all fields except receipts), FR-EXP-02, default date today, vehicle and UPI defaults; soft delete; list sorted newest first.
  - Verify: TC-EXP-01 (without photo), TC-EXP-08. ✔ component tests (13 in `expenses.test.tsx`). Receipt photos added on the edit screen (T14).
  - Deps: T8, T10, T4.

- [x] **T12 — Expense filters, search, duplicate, quick add** (M)
  - Acceptance: FR-EXP-03, 04, 05, 09; totals update with filters; quick add reachable in ≤ 3 taps.
  - Verify: TC-EXP-05 ✔, TC-EXP-06 ✔, TC-EXP-07 ✔ (component tests, `t12.test.tsx`; pure rules in `core/expenses/filters.test.ts`). TC-EXP-10 **pending**: the timed run on a mid-range Android device has not been done.
  - Deps: T11.

- [x] **T13 — Odometer warning on expenses** (XS)
  - Acceptance: FR-EXP-07; lower odometer shows warning with _Save anyway_ requiring a note; the fuel path still uses the DB trigger (RULE-03).
  - Verify: TC-EXP-04 ✔ (form test; warning blocks save until a reason is given). Fuel-path trigger is covered by DB tests.
  - Deps: T11.

- [x] **T14 — Receipt upload** (M)
  - Acceptance: up to 3 photos; browser compression to ≤ 1 MB; JPEG, PNG, WebP, PDF; ≤ 5 MB raw; private bucket path `{uid}/{expense_id}/{n}.jpg`; storage policy by folder; signed URLs with 1 h expiry.
  - Verify: TC-EXP-09 ✔ (`receipts.test.tsx`, `core/receipts/rules.test.ts`); storage policy ✔ (`tests/db/storage.test.ts`, migration 0008). Browser compression ✔ in Chromium (`scripts/receipt-compress-check.mjs`: 33.4 MB photo → 0.96 MB JPEG, max side 2000 px). **Pending:** TC-DATA-04 HTTP check (no-token request → 400/403) needs the live project.
  - Deps: T11, T3.

**CP-B (part 3)** — expenses usable end-to-end.

---

## Phase 4 — Fuel

- [x] **T15 — Mileage and cost-per-km (pure)** (M)
  - Acceptance: SDD §5.6 algorithm: intervals between full tanks; partial litres included; reject distance ≤ 0; average, best, worst; cost per km; "insufficient data" under 50 km or fewer than two full tanks.
  - Verify: unit tests for TC-FUEL-02 (expected 8.33 km/l), TC-FUEL-03, TC-FUEL-05 (₹10.00/km), TC-FUEL-07.
  - **Decided (owner, 2026-10-11):** SDD §5.6 method, 16.67 km/l for TC-FUEL-02. TC-FUEL-02 in the test document corrected to match. `src/core/fuel/mileage.test.ts` follows SDD.
  - ✔ TC-FUEL-03, TC-FUEL-05, TC-FUEL-07 (`mileage.test.ts`, 8 tests).
  - Deps: T1.

- [x] **T16a — Fuel log RPC and form** (M)
  - Acceptance: `add_fuel_log` RPC creates fuel row and linked expense atomically; idempotent on `p_id`; form auto-calculates total; full tank toggle; station and payment mode; FR-FUEL-01, 04.
  - Verify: TC-FUEL-01 ✔ and TC-FUEL-04 ✔ (`fuel.test.tsx`, plain DB message shown); idempotency ✔ and atomic rollback ✔ (`tests/db/fuel.test.ts`, migration 0009 adds kWh and the litres-or-kWh check).
  - Deps: T3, T11, T15.

- [x] **T16b — Fuel history and EV charging** (S)
  - Acceptance: fuel list with km/l per fill; EV vehicles log kWh and hide litres (FR-FUEL-05).
  - Verify: TC-FUEL-06 component part ✔ (km/l per fill, EV shows kWh and km/kWh, no litres). **Pending:** the E2E run on a live project.
  - Deps: T16a.

**CP-B (part 4)** — **Core usable checkpoint.** Owner reviews before Phase 5.

---

## Phase 5 — Loans

- [x] **T17 — EMI engine (pure, test-first)** (M)
  - Acceptance: reducing-balance EMI per SDD §5.1; flat-rate EMI per corrected formula (N in months); zero-rate case; schedule with last row adjustment (SDD §5.2); total principal equals loan amount exactly.
  - Verify: TC-LOAN-01 ✔ (₹16,703.92, cross-checked with an independent PMT calculation), TC-LOAN-02 ✔, TC-LOAN-03 ✔, TC-LOAN-04 ✔ (₹17,222.22; effective rate ≈ 14.5% nominal, computed), TC-LOAN-07 ✔ (38 months), TC-LOAN-08 ✔ (₹14,113.58), TC-LOAN-09 ✔ (engine), TC-LOAN-10 ✔ (engine). `src/core/loans/emi.test.ts`, 17 tests. **Decision recorded:** SDD §5.4 zero-denominator case is now `null` (EMI does not cover interest), not 'fully repaid'.
  - Deps: T1.

- [x] **T18 — Loan CRUD and schedule view** (M)
  - Acceptance: FR-LOAN-01, 03, 11; loan form with computed EMI (user may override); schedule rows inserted in bulk into `loan_payments`; close loan.
  - Verify: `tests/db/loans.test.ts` (8 tests: 60 rows and sums in one call, idempotent retry, bad schedule rejected with no partial write, cross-user isolation, close keeps schedule). `src/core/loans` (plan, schema, EMI, date clamping). `src/features/loans/loans.test.tsx` (8 UI tests: computed EMI, save with 60 rows, entered EMI, Active/Closed filter, schedule, close loan). **Pending:** TC-LOAN-11 end to end on a live project (blocked on staging credentials).
  - Built: migration `0010_loans.sql` (`create_loan`), `src/data/loans.ts`, `/loans` and `/loans/:loanId`.
  - Deps: T17, T8.

- [x] **T19 — Record EMI payment** (M)
  - Acceptance: `record_loan_payment` RPC; status paid/late (FR-LOAN-05); creates expense under Loan & Finance with late fee and bounce included; interest stored separately (FR-LOAN-09).
  - Verify: `tests/db/loan_payments.test.ts` (7 DB tests: TC-LOAN-05 expense ₹16,903.92 under EMI payment, bounce included, interest kept on the schedule row, no double-recording, cross-user refused, rollback on failure, future date refused). `src/core/loans/payment.test.ts` (12 tests: totals, TC-LOAN-06 Late derived from due date, summary correct in any payment order). `src/features/loans/loans.test.tsx` (11 UI tests). **Pending:** TC-LOAN-05 and TC-LOAN-06 end to end on a live project (blocked on staging credentials).
  - Built: migration `0011_loan_payments.sql` (`record_loan_payment`), `recordLoanPayment` in `src/data/loans.ts`, record form in `LoanDetailPage`.
  - Decisions: "Late" is derived from the due date, not stored, so no background job is needed. Payments can be recorded in any order; the summary uses the principal of paid rows. Late fee and bounce are rolled into the one expense; the separate "Late payment" line is not split out (TC-LOAN-05 allows either).
  - Deps: T18, T16a pattern.

- [x] **T20 — Prepayment and foreclosure simulators (pure + UI)** (M)
  - Acceptance: reduce-tenure and reduce-EMI formulas (SDD §5.4, §5.5); foreclosure estimate with charge %; loan summary (outstanding, interest paid, interest remaining, months remaining) (FR-LOAN-06, 07, 08).
  - Verify: `src/core/loans/simulate.test.ts` (11 tests: TC-LOAN-07 reduce tenure to 38 months with EMI unchanged, TC-LOAN-08 reduce EMI to ₹14,113.58 over 46 months, cleared-loan and zero-rate edge cases, accrued-interest and foreclosure totals, TC-LOAN-09). `src/features/loans/simulators.test.tsx` (5 UI tests). TC-LOAN-10 summary was covered in T17/T18. **Pending:** end-to-end on a live project (blocked on staging credentials).
  - Built: `src/core/loans/simulate.ts`, `src/features/loans/LoanSimulators.tsx`, shown on active loans in `LoanDetailPage`.
  - Decisions: simulations are not saved (no `loan_events` writes yet). Accrued interest is a simple actual/365 estimate; the lender's figure governs. Flat-rate loans use their equivalent reducing rate. The charge defaults to 0%, so the user enters it from their agreement.
  - Deps: T17, T18.

**CP-C (part 1)** — loan maths verified and loan flows usable. **PASSED with caveats (2026-10-12):** unit, DB and UI tests green; live checks pending staging credentials.

---

## Phase 6 — Reminders

- [x] **T21 — Reminders CRUD and due logic** (M)
  - Acceptance: FR-REM-01, 02, 05; types incl. service by km; "due soon" window = due date − lead days; overdue badge; insurance fields stored.
  - Verify: `src/core/reminders/due.test.ts` (12 tests: TC-REM-01 due soon from 17/11/2026, TC-REM-02 overdue, TC-REM-04 200 km to service, km and date rules, Home window). `src/core/reminders/schema.test.ts` (19 tests). `tests/db/reminders.test.ts` (5 tests: insurance fields stored, trigger rule, lead range, RLS). `src/features/reminders/reminders.test.tsx` (6 UI tests, including Home panel). Browser layout checks pass (20/20), but the signed-in routes render the setup screen in this build, so they do not cover these screens. **Pending:** TC-REM-01, 02, 04 on a live project.
  - Built: `src/core/reminders/due.ts`, `schema.ts`, `src/data/reminders.ts`, `/reminders` page, Home panel, More link.
  - Decisions: km reminders are due soon within 500 km of the due reading (the spec gives no threshold; chosen here, easy to change via `KM_LEAD`). Reminders use direct table writes with soft delete; no migration was needed.
  - Deps: T8.

- [x] **T22 — Mark done creates expense** (S)
  - Acceptance: FR-REM-03; `is_done`, `done_on`; optional expense created under the matching category.
  - Verify: TC-REM-03 at the database level (`tests/db/reminder_done.test.ts`: 6 tests covering ₹100 under PUC certificate dated today, no expense when none is recorded, already-done refused, cross-user refused, rollback on failure, category and amount required). `src/core/reminders/done.test.ts` (8 tests). `src/features/reminders/markDone.test.tsx` (4 UI tests). **Pending:** TC-REM-03 end to end on a live project.
  - Built: migration `0012_reminder_done.sql` (`mark_reminder_done`), `markReminderDone` in `src/data/reminders.ts`, `MarkDoneForm`.
  - Decisions: the category defaults from the reminder type (insurance → Insurance renewal fee, service → Periodic service, loan EMI → EMI payment). The user can change it. Recording an expense is off by default. The expense takes source `reminder`. Marking done twice is refused, and there is no undo yet.
  - Deps: T21, T11.

- [x] **T23 — Browser notification opt-in (Should)** (S)
  - Acceptance: FR-REM-04; permission asked only after user taps _Turn on reminders_; refusal does not break the app.
  - Verify: TC-REM-05.
  - Deps: T22.
  - Verify notes: 316/316 tests (TC-REM-05 UI: no prompt on load; prompt only on tap; refusal leaves list usable; unsupported message; in-app notice once per day). Lint, typecheck, Prettier, build green. Permission is requested only from the tap handler. Notifications show only while the app is open; installed-app notifications need a service worker (not built, out of scope).

**CP-C (part 2)** — loans and reminders complete.

---

## Phase 7 — Dashboard & Reports

- [x] **T24 — Dashboard** (M)
  - Acceptance: FR-RPT-01 and 02 — monthly total, category donut, monthly bar trend, cost/km, cost/month, due-soon list, loan outstanding; presets (this month, last month, this FY, last 12 months, custom); empty state with no NaN.
  - Verify: TC-RPT-01 (totals to the paisa against fixtures), TC-RPT-04.
  - Deps: T15, T20, T22.
  - Verify notes: TC-RPT-01 covered by core and UI tests (paise-exact totals, month filter, last-month switch). TC-RPT-04 covered (empty state, no NaN). Presets and custom range covered. Loan outstanding uses paid instalments only. Dashboard lives on Home (`/`). Cost per month divides by months elapsed so far in the period. Cost per km uses the odometer span of the period's fuel fills and expense rows. The donut uses category groups. Full gate green: 343 tests across 46 files, lint, typecheck, Prettier, build. Live Supabase data not yet checked (blocked on staging credentials).

- [x] **T25 — Reports and CSV export** (M)
  - Acceptance: FR-RPT-03, 04, 05; Indian FY 1 Apr to 31 Mar; monthly category table; CSV with UTF-8 BOM for expenses, fuel and loan schedule.
  - Verify: TC-RPT-02, TC-RPT-03 (open in Excel/LibreOffice).
  - Deps: T24.
  - Verify notes: automated checks pass for TC-RPT-02 (FY 1 Apr–31 Mar, 1 March excluded) and for the TC-RPT-03 file format (UTF-8 BOM bytes, CRLF, RFC 4180 quoting, numeric amounts, Hindi/Marathi text kept, spreadsheet-formula guard). Reports and exports follow the selected period. The manual check of opening each file in Excel/LibreOffice is NOT yet done (open caveat). Full gate green: 365 tests across 50 files, lint, typecheck, Prettier, build.

**CP-D (part 1)** — dashboard and reports.

---

## Phase 8 — Data & PWA

- [x] **T26 — JSON backup and restore** (M)
  - Acceptance: FR-DATA-01, 02; file includes schema version; restore only into empty account; IDs preserved.
  - Verify: TC-DATA-01, TC-DATA-02.
  - Deps: T25.
  - Verify notes: TC-DATA-02 checked on real Postgres (PGlite): row counts match, IDs kept, user_id set to the signed-in user, another user's data untouched, non-empty account refused, newer schema refused, an unsigned caller refused, bad row rolls back everything, clash of an existing ID refused with a clear message. TC-DATA-01: file format and download checked in UI tests; the live export against Supabase is NOT yet checked (open caveat). Design decision: IDs are preserved, so a restore is refused while the original rows still exist in the same project. Full gate green: 390 tests across 53 files, lint, typecheck, Prettier, build.

- [ ] **T27 — Account deletion Edge Function** (M) — built and tested; live check pending
  - Acceptance: FR-DATA-03; `delete-account` verifies JWT, deletes `receipts/{uid}/` objects, deletes auth user (cascade); typed `DELETE` confirmation; service role key set via `supabase secrets` only.
  - Verify: TC-DATA-03; sign-in fails after deletion.
  - Verify notes (so far): logic tested (13 tests): no/forged/expired token refused; typed DELETE required; user id from the token only; receipts removed before the auth user; storage failure keeps the account for retry. Cascade tested on real Postgres (PGlite): deleting the auth user empties every user table and leaves other users and system categories. UI tested (6 tests). NOT yet done: deploy the function, set the service role secret, and check on a live project that the receipts are removed and sign-in fails afterwards. Deno type check not run (no Deno in sandbox).
  - Deps: T14, T5.

- [x] **T28 — PWA shell: manifest, icons, service worker** (M)
  - Acceptance: FR-PWA-01, 02, 06; manifest with 192, 512 and maskable icons; `registerType: 'prompt'`; app shell precached; update banner.
  - Verify: TC-PWA-01 (Lighthouse PWA), TC-PWA-02 (airplane mode reload), TC-PWA-06.
  - Deps: T6.
  - Verify notes: built with vite-plugin-pwa 0.20.5, `registerType: 'prompt'`. Icons 192, 512 and maskable 512 (plus apple-touch-icon). Scripted browser check `scripts/pwa-check.mjs` passes 12/12 on the production build: manifest served, icons load (200), service worker registers and controls the page, the app shell renders with the network off (TC-PWA-02), and the offline notice shows. Unit tests cover the update prompt (only after a tap) and the offline notice (5 tests). Caveats: no formal Lighthouse audit run (TC-PWA-01); the update prompt has not been checked against a second deployed version (TC-PWA-06). API responses are deliberately NOT cached by the service worker, so user data does not stay in the cache after sign-out; the offline read cache (T29a) will handle that.

- [x] **T29a — Offline read cache (Dexie)** (M)
  - Acceptance: FR-PWA-03; last synced data viewable offline with "Last updated" time.
  - Verify: TC-PWA-03.
  - Deps: T28, T24.
  - Verify notes: Dexie store `snapshots` (`my-vehicle-spend-cache`), keys scoped by user id. Six reads go through `readThrough`: expenses, categories, fuel, loans, loan payments, reminders. Only the `NETWORK` error code falls back to the saved copy; server errors are always shown. The app shell shows "Showing saved data. Last updated DD/MM/YYYY, HH:MM" (IST) when any read is from the cache. Sign-out clears the cache. Tests: offline cache (8), real `listExpenses` online/offline with a stubbed client (2), IST formatting (1), notice (3). Full gate: 431/431 across 62 files; lint, format and typecheck clean.
  - Caveats: TC-PWA-03 is verified at the data and UI level only. A real dashboard check against live data is blocked on staging credentials. Writes still need a connection until the outbox ships (T29b).

- [x] **T29b — Outbox and sync engine** (L → split into slices)
  - Acceptance: FR-PWA-04, 05; offline inserts stored in `outbox`; replay on `online` and on app open; badge with pending count; retries with back-off, max 5 (NFR-REL-02).
  - Verify: TC-PWA-04 (expense and fuel rows appear in Supabase, no duplicates).
  - Deps: T29a, T16a.
  - Verify notes (slice 1, `cf7f0cc`): `src/data/outbox.ts` (Dexie `my-vehicle-spend-outbox`, per user). Replays oldest first and stops at the first item still backing off. Back-off 10/20/40/80 s. Gives up after 5 network attempts. Server rejections are kept as failed and not retried. 9 tests.
  - Verify notes (slice 2): `createExpense` and `addFuelLog` now go through `saveOrQueue` (`src/data/writes.ts`). Network failure or offline: the write is queued under its client UUID and a provisional row marked `pending` is returned. Replay (`src/data/sync.ts`) runs on `online` and on app open, through the same functions the online path uses. `SyncStatus` (in AppShell) shows the waiting count, refused changes with the server's reason, and a Discard button. Pending expense rows disable Duplicate, Edit and Delete. Tests: `src/data/sync.test.ts` (9, includes the lost-response case), `src/features/sync/syncStatus.test.tsx` (4). Full gate 469/469 across 68 files.
  - Caveats: TC-PWA-04 is not verified live (blocked on migrations and staging). Provisional rows appear until the next page load, when the lists re-read the server. Receipts cannot be attached to a queued expense, and Edit is disabled until it syncs. Open decision: sign-out with items still pending. Current behaviour: the outbox is not cleared, so the items stay for the same account only. Needs an owner decision.
- [x] **T29c — Idempotent retry safety** (S)
  - Acceptance: retries reuse the same client UUID; RPC `ON CONFLICT DO NOTHING` verified.
  - Verify: TC-PWA-05 (simulated drop after commit gives one row).
  - Deps: T29b.
  - Verify notes: migration `0014_add_expense.sql` (`add_expense`: `INSERT … ON CONFLICT (id) DO NOTHING`, then returns the existing row; a foreign id is refused). `add_fuel_log` (0003/0009) already returns the existing row on a retry. Tests: `tests/db/add_expense.test.ts` (6, on PGlite: retry creates no second row, foreign id refused, vehicle ownership, amount rule, no sign-in). `src/data/sync.test.ts` simulates a committed save whose response is lost, and the replay gives one row, for expenses and fuel.
  - Caveat: TC-PWA-05 is verified at the DB and client level. The live check needs the migrations applied to the project.

**CP-D (part 2)** — backup, deletion, PWA install, offline queue.

---

## Phase 9 — Hardening

- [x] **T30 — Security headers, CSP and secret checks** (S)
  - Acceptance: `public/_headers` with CSP, HSTS, nosniff, frame-ancestors none (Deployment Guide §3.1); no `service_role` in bundle; no `dangerouslySetInnerHTML`; tokens not logged.
  - Verify: TC-SEC-05, 06, 07 (XSS vendor name shown as text), 08; `npm audit --omit=dev` has no high or critical findings.
  - Deps: T27.
  - Verify notes: `public/_headers` matches Deployment Guide §3.1 exactly. `tests/security/static.test.ts` (8): no `dangerouslySetInnerHTML`, no service role key in app source, no token/session/password in console calls, no innerHTML/eval, CSP directives, HSTS, nosniff, no-cache for sw.js and manifest. `src/features/expenses/xss.test.tsx` (1): hostile vendor and note render as text. Bundle: `grep service_role` finds nothing in `dist/`. Browser: all six signed-in screens render under the policy with 0 CSP violations and 0 console errors (served with the headers applied). Full gate 478/478 across 70 files.
  - TC status: TC-SEC-05 verified. TC-SEC-06 header file verified locally. The hosted header is still to check after deploy (`curl -I`). TC-SEC-07 verified at component level, not yet in a browser. TC-SEC-08 static check only; the production console has not been checked for token strings.
  - Dependencies: `npm audit --omit=dev` shows 2 moderate findings, none high or critical. Both are in react-router 6.x (open redirect via backslash, and an SSR-only deserialize issue). The app navigates only to fixed internal paths, and it is not server-rendered, so the impact is low. The fix is a breaking upgrade to react-router 7. Accepted for v1.0; upgrade planned after T35.

- [x] **T31 — Accessibility and responsive pass** (S)
  - Acceptance: labels on all inputs; contrast ≥ 4.5:1 in both themes; keyboard path for add-expense; axe-core shows zero critical violations.
  - Verify: TC-UI-03, 04, 05.
  - Deps: all UI tasks.
  - Verify notes: `scripts/a11y-scan.mjs` (axe-core 4.14.0, exact devDependency) scans 11 signed-in and 2 signed-out routes in light and dark at 375 px against a stub-env build. Final run: 26 pages, 0 violations of any severity. Fixes: hero gradient darkened so white text passes; "Add entry" button text; dashboard cards, report table borders, bar labels and sync banners moved to theme tokens (they were hard-coded white); light `--warn` darkened to `#8a5300` (white text on the offline banner was 4.24:1); category tint text darkened; headings no longer skip h2. `tests/a11y/contrast.test.ts` (8) computes the ratios from the real token files. `scripts/keyboard-check.mjs` drives Chromium through the add-expense form with Tab, arrow keys and Enter: 6/6 pass. Full gate: vitest 486/486 across 71 files; lint, prettier, tsc and build OK.
  - TC status: TC-UI-03 verified (contrast in both themes; charts covered by the axe scan). TC-UI-04 verified in Chromium. TC-UI-05 verified (zero critical, zero serious). Not covered: TC-UI-06 (320 px) is a separate case, and the scan runs against stub data, not the live backend.

- [x] **T32 — Performance budget** (S)
  - Acceptance: initial JS ≤ 250 KB gzip; route-level lazy loading for Reports and Loans; dashboard with 5,000 rows ≤ 1.5 s.
  - Verify: TC-PERF-01, 02, 03 (Lighthouse mid-range profile).
  - Deps: T24.
  - Verify notes: Reports, Loans and Loan detail are `React.lazy` routes inside a Suspense boundary (`tests/perf/lazy-routes.test.ts`, 4 checks). Build: the three pages are separate chunks. Initial JS (entry script) is 185,219 B gzip against a 250,000 B budget (`scripts/bundle-budget.mjs`, run after `npm run build`). `scripts/perf-check.mjs` (Chromium, stub backend, 5,000 expenses, dashboard `dash-total` after the response, 3 runs): 1x CPU worst 300 ms; 4x CPU worst 895 ms; both ≤ 1,500 ms. Total shown ₹17,47,500.00, which matches the sum of the sample rows. Lighthouse 12, mobile, simulated 4G and 4x CPU, on `/login` (stub build, local server): FCP 2.0 s, LCP 2.2 s, performance 0.97.
  - TC status: TC-PERF-03 verified. TC-PERF-02 verified with the stub backend in Chromium; not yet on the hosted build. TC-PERF-01 verified on the signed-out login page only. The signed-in home has not been measured in Lighthouse.
  - Also fixed: `src/app/shell.test.tsx` raised 9 unhandled "IndexedDB API missing" errors, which made `vitest` exit 1 even with all tests passing. It now loads `fake-indexeddb`, and the sign-out test waits for the auth call (sign-out clears the offline cache first, FR-PWA-03).

**CP-E (part 1)** — quality gates green.

---

## Phase 10 — Testing, Release

- [ ] **T33 — Full system test run** (M)
  - Acceptance: every STC executed on staging; results recorded in `docs/04-testing/02-system-test-cases.md` status column; each failure logged in `03-defect-tracking-log.md`.
  - Verify: all Must cases pass; zero open Critical or High defects.
  - Deps: T30–T32.
  - Local run (done, 2026-10-13): all 77 STCs have a status with evidence. 61 Pass, 15 Partly, 1 Blocked, 0 Not run, 0 Fail. Each status line names its evidence. Failures found and fixed during T31 are logged as DTL-001 to DTL-003 (all Verified). Open Critical/High: 0.
  - Still open (not done): the acceptance says "executed on staging". Staging needs a live Supabase project, a hosted deploy (T34) and real devices. Blocked until those exist: TC-AUTH-05 (reset email); all Partly cases that name staging; the hosted `curl -I` for TC-SEC-06; the Android and iPhone checks (TC-PWA-01, TC-PWA-04, TC-REM-05, TC-PWA-06); CSV in Excel (TC-RPT-03). Keep T33 unchecked until these are run on staging.
  - Added status value "Partly" to the STC template header. It marks cases with local evidence for only part of the expected result.

- [ ] **T34 — Staging deploy and smoke test** (S)
  - Acceptance: `develop` deploys to staging; migrations applied via `db.yml`; deployment smoke checklist (Deployment Guide §6) passes; keep-alive workflow enabled.
  - Verify: smoke checklist; `curl -I` shows CSP and HSTS.
  - Deps: T33.
  - Progress (2026-10-13): workflows written from Deployment Guide §4 and parse as valid YAML: `deploy.yml` (develop → Pages staging, main → production), `db.yml` (develop → staging project; main → production; the guide's version only had main), `keep-alive.yml` (pings both projects every 3 days). Not run: there is no git remote and no `develop` branch, and no GitHub or Cloudflare secrets are set. `.env.local` points to a Supabase host marked `VITE_APP_ENV=local`, which is not confirmed as staging. Smoke checklist and `curl -I` not run. T34 stays open.

- [ ] **T35 — UAT and release v1.0.0** (S)
  - Acceptance: UAT report signed (`04-uat-report.md`); `CHANGELOG.md` and release notes updated; `main` merged; tag `v1.0.0`; production smoke test passes.
  - Verify: owner sign-off recorded; production URL works on Android and iPhone.
  - Deps: T34.

**CP-E (part 2)** — release complete.
