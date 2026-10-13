# System Test Cases (STC) — My Vehicle Spend

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| Version       | 1.0 (Draft)                                    |
| Date          | 2026-10-11                                     |
| Test IDs      | `TC-<AREA>-<NN>` mapped to SRS FR IDs          |
| Status values | Not run · Pass · Partly · Fail · Blocked · N/A |

**How to read:** each case lists preconditions, steps, test data, expected results and the requirement it proves.

## Run record (T33, local pass — 2026-10-13)

- **Environment:** local only, on commit `b792d09` plus T33 docs. Automated suites run on PGlite (real PostgreSQL with a Supabase shim) and a stub-env build. **Not run on staging:** staging needs live Supabase, a hosted deploy and real devices. T33 stays open until the staging run is done.
- **Results:** 61 Pass · 15 Partly · 1 Blocked · 0 Not run · 0 Fail (as the final run).
- **Partly** means the local evidence covers part of the expected result. The rest needs staging or a device, as noted on each case.
- **Blocked:** TC-AUTH-05 (password-reset email delivery needs staging).
- **Defects:** three found and fixed during T31 are logged in `03-defect-tracking-log.md` (DTL-001 to DTL-003). The final local run has no open defects.
- **Evidence:** `npx vitest run` (490 tests, 72 files); `scripts/a11y-scan.mjs`; `scripts/keyboard-check.mjs`; `scripts/stc-local-check.mjs`; `scripts/perf-check.mjs`; `scripts/bundle-budget.mjs`; Lighthouse 12 on `/login`.

---

## TC-AUTH — Authentication

### TC-AUTH-01 — Sign up with email and password (FR-AUTH-01)

- **Pre:** App open, signed out. Email `tester1+<date>@test.local` is unused.
- **Steps:** 1) Tap _Sign up_. 2) Enter email, password `Test@1234`. 3) Submit.
- **Expected:** Account created; user lands on _Add your first vehicle_. Profile row exists with currency `INR`.
- **Status:** Partly — auth UI test, mocked backend; real account and profile row need staging.

### TC-AUTH-02 — Reject weak password (FR-AUTH-01, NFR-SEC-06)

- **Steps:** Sign up with password `abc`.
- **Expected:** Inline error "Password must be at least 8 characters". No request sent (check network tab).
- **Status:** Pass — auth.test: rejected before any request.

### TC-AUTH-03 — Sign in with wrong password (FR-AUTH-02)

- **Expected:** Message "Email or password is incorrect." No token stored.
- **Status:** Pass — auth.test: wrong-password message (mocked backend).

### TC-AUTH-04 — Session persists after browser restart (FR-AUTH-06)

- **Steps:** Sign in → close browser fully → reopen app URL.
- **Expected:** User remains signed in.
- **Status:** Partly — session guard test; restart across browser sessions needs a real browser profile on staging.

### TC-AUTH-05 — Password reset email (FR-AUTH-03)

- **Expected:** Reset email received in Mailpit (local) or inbox (staging); link opens reset page; new password works.
- **Status:** Blocked — needs real password-reset email delivery (staging).

### TC-AUTH-06 — Sign out clears session (FR-AUTH-04)

- **Expected:** Redirect to login; back button does not show private data; localStorage has no session.
- **Status:** Partly — shell.test: sign-out returns to login (mocked); server-side session revoke needs staging.

---

## TC-VEH — Vehicles

### TC-VEH-01 — Add a car (FR-VEH-01)

- **Steps:** Add vehicle: type Car, reg `mh 12 ab 1234` (typed with spaces), make Maruti Suzuki, model Swift, fuel Petrol, start odometer 25000.
- **Expected:** Saved as `MH12AB1234`; shown as "MH 12 AB 1234"; appears in vehicle switcher.
- **Status:** Pass — vehicles.test + registration.test + tests/db/vehicles.

### TC-VEH-02 — Add a bike (FR-VEH-01)

- **Steps:** Type Bike, reg `KA01XY0007`, fuel Petrol.
- **Expected:** Saved; icon shows bike.
- **Status:** Pass — vehicles.test (bike).

### TC-VEH-03 — Duplicate registration rejected (FR-VEH-06)

- **Steps:** Add vehicle with same reg as TC-VEH-01.
- **Expected:** Message "A vehicle with this number already exists."
- **Status:** Pass — vehicles.test + tests/db/vehicles (duplicate).

### TC-VEH-04 — Invalid registration format (FR-VEH-06)

- **Steps:** Reg `AB-@@`.
- **Expected:** Validation error; not saved.
- **Status:** Pass — vehicles.test + registration.test.

### TC-VEH-05 — Edit vehicle (FR-VEH-02)

- **Expected:** Changes persisted; history of expenses unchanged.
- **Status:** Pass — vehicles.test (edit).

### TC-VEH-06 — Delete vehicle requires typed confirmation (FR-VEH-03)

- **Steps:** Tap delete; type `DELETE` exactly; confirm.
- **Expected:** Vehicle and its expenses, fuel logs, loans, reminders removed (cascade). Other vehicles unaffected.
- **Status:** Pass — vehicles.test (typed confirmation).

### TC-VEH-07 — Switch active vehicle (FR-VEH-04)

- **Expected:** Dashboard, expenses and fuel views change to selected vehicle; selection survives refresh.
- **Status:** Pass — vehicles.test (switch active vehicle).

---

## TC-EXP — Expenses

### TC-EXP-01 — Add expense with all fields (FR-EXP-01)

- **Data:** Date 03/10/2026, Maintenance & Service › Periodic service, ₹4,850.00, GST ₹740.00, UPI, Sharma Motors, 48,210 km, note "Oil + filter + labour", 1 photo.
- **Expected:** Row stored; amounts exact; photo uploaded to `receipts/{uid}/{id}/1.jpg`; listed on Expenses screen.
- **Status:** Pass — expenses.test + tests/db/add_expense.

### TC-EXP-02 — Amount boundaries (FR-EXP-06)

| Input       | Expected                                |
| ----------- | --------------------------------------- |
| 0           | Rejected: "Amount must be more than ₹0" |
| 0.01        | Accepted                                |
| 10000000    | Accepted (₹1 crore)                     |
| 10000000.01 | Rejected                                |
| -5          | Rejected                                |
| `abc`       | Rejected (input blocked)                |

- **Status:** Pass — money.test boundaries + expense schema.

### TC-EXP-03 — Indian grouping in input (NFR-USE-02)

- **Steps:** Type `123456.5` or `1,23,456.5`.
- **Expected:** Stored as 123456.50; displayed as ₹1,23,456.50.
- **Status:** Pass — money.test + expenses.test (Indian grouping).

### TC-EXP-04 — Odometer lower than previous (FR-EXP-07)

- **Steps:** Previous expense at 48,210 km; add expense at 48,000 km.
- **Expected:** Warning dialog with _Save anyway_ (requires note) and _Cancel_.
- **Status:** Pass — odometer.test + expenses.test.

### TC-EXP-05 — Filter by category and date (FR-EXP-03)

- **Expected:** Only matching rows; count and total shown; clearing filters restores list.
- **Status:** Pass — filters.test + t12.test.

### TC-EXP-06 — Search by vendor (FR-EXP-04)

- **Steps:** Search "sharma".
- **Expected:** Case-insensitive match returns the Sharma Motors row.
- **Status:** Pass — filters.test (search) + t12.test.

### TC-EXP-07 — Duplicate expense (FR-EXP-05)

- **Expected:** New form pre-filled except date (today); new ID; original unchanged.
- **Status:** Pass — t12.test (duplicate).

### TC-EXP-08 — Edit and delete expense (FR-EXP-02)

- **Expected:** Edit updates `updated_at`; delete sets `deleted_at` and row disappears; totals update.
- **Status:** Pass — expenses.test (edit and delete).

### TC-EXP-09 — Receipt limits (FR-EXP-08, NFR-SEC-07)

- **Steps:** Upload 4th receipt; upload a 6 MB JPEG; upload `.exe`.
- **Expected:** 4th blocked (max 3); 6 MB rejected; `.exe` rejected with message.
- **Status:** Pass — receipts rules.test + receipts.test + tests/db/storage.

### TC-EXP-10 — Quick add speed (FR-EXP-09)

- **Steps:** Timed run: open app → category Fuel → amount 3000 → Save.
- **Expected:** ≤ 15 seconds on mid-range Android.
- **Status:** Partly — t12.test covers the quick-add flow; the timing target is not measured; keyboard run passes (TC-UI-04).

---

## TC-FUEL — Fuel log

### TC-FUEL-01 — Add full-tank fill (FR-FUEL-01)

- **Data:** Odometer 48,210; litres 32.50; price ₹102.40; full tank; HP Pump; UPI.
- **Expected:** Total ₹3,328.00; expense row created with source `fuel`; both IDs linked.
- **Status:** Pass — fuel.test + tests/db/fuel.

### TC-FUEL-02 — Mileage calculation between full tanks (FR-FUEL-02)

- **Data:**
  | Odo    | Litres | Full         |
  | ------ | ------ | ------------ |
  | 48,000 | 30.00  | Yes          |
  | 48,250 | 14.00  | No (partial) |
  | 48,500 | 16.00  | Yes          |
- **Expected:** One interval 48,000 → 48,500 = 500 km over the litres put in after the starting full tank: 14.00 + 16.00 = 30.00 L → **16.67 km/l**. (Partial fill litres are included. The 30.00 L of the starting full tank belongs to the previous interval, so it is not counted here. Corrected 2026-10-11 per SDD §5.6 and owner decision.)
- **Status:** Pass — mileage.test (partial fills).

### TC-FUEL-03 — Average, best, worst (FR-FUEL-03)

- **Expected:** Averages computed from valid intervals only; best and worst shown with dates.
- **Status:** Pass — mileage.test (average, best, worst).

### TC-FUEL-04 — Odometer must not decrease (RULE-03)

- **Steps:** Add fuel at 48,100 when last is 48,500.
- **Expected:** Database rejects; app shows "Odometer 48100 is lower than the last recorded reading 48500." (mapped message).
- **Status:** Pass — tests/db/fuel (RULE-03) + fuel.test.

### TC-FUEL-05 — Cost per km in period (FR-RPT-01)

- **Data:** Odometer 48,000 → 48,600 (600 km); total spend ₹6,000.
- **Expected:** ₹10.00/km.
- **Status:** Pass — mileage.test + dashboard.test.

### TC-FUEL-06 — EV charging with kWh (FR-FUEL-05)

- **Steps:** Vehicle fuel type EV; log 20 kWh at ₹8.50/kWh.
- **Expected:** Total ₹170.00; litres field hidden; kWh stored.
- **Status:** Partly — EV kWh form and list covered at component level; not run on a device.

### TC-FUEL-07 — Insufficient data message (SDD §5.7)

- **Steps:** Only 1 fill recorded.
- **Expected:** "Add one more full-tank fill to see mileage."
- **Status:** Pass — mileage.test + fuel.test.

---

## TC-REM — Reminders

### TC-REM-01 — Create insurance reminder (FR-REM-01, FR-REM-05)

- **Data:** Insurance, due 02/12/2026, lead 15 days, insurer ICICI Lombard, IDV ₹5,20,000.
- **Expected:** Appears in _Due soon_ from 17/11/2026 (due − 15 days).
- **Status:** Pass — due.test + reminders.test + tests/db/reminders.

### TC-REM-02 — Overdue reminder shown (FR-REM-02)

- **Steps:** Create PUC reminder due yesterday.
- **Expected:** Red "Overdue" badge on Home.
- **Status:** Pass — due.test + reminders.test (Overdue badge).

### TC-REM-03 — Mark done creates expense (FR-REM-03)

- **Steps:** Mark PUC done; enter ₹100 and date today; tick "record as expense".
- **Expected:** `is_done = true`, `done_on = today`; expense created under Government & RTO › PUC certificate.
- **Status:** Pass — done.test + markDone.test + tests/db/reminder_done.

### TC-REM-04 — Service by km reminder (FR-REM-01)

- **Data:** Due at 52,000 km; current odometer 51,800.
- **Expected:** "200 km to service" shown.
- **Status:** Pass — due.test + reminders.test + tests/db/reminders.

### TC-REM-05 — Browser notification opt-in (FR-REM-04)

- **Expected:** Permission prompt appears only after user taps _Turn on reminders_; declining does not break the app.
- **Status:** Partly — notifications.test (opt-in UI); real browser permission prompt needs a device.

---

## TC-LOAN — Loans

### TC-LOAN-01 — EMI reference calculation (FR-LOAN-02)

- **Data:** Principal ₹8,00,000; rate 9.25%; tenure 60 months; reducing.
- **Expected:** EMI **₹16,703.92** (to 2 decimals, validated against `PMT` in a spreadsheet to ±₹0.01).
- **Status:** Pass — emi.test (cross-checked with an independent PMT calculation) + loans.test.

### TC-LOAN-02 — Schedule totals (FR-LOAN-03)

- **Expected:** Sum of principal components = ₹8,00,000.00 exactly; closing balance of row 60 = 0.00; total interest = (EMI × 60) − principal, within ₹1 rounding.
- **Status:** Pass — emi.test (schedule) + loans.test.

### TC-LOAN-03 — Zero interest loan (FR-LOAN-02 edge)

- **Data:** Rate 0%, principal ₹1,20,000, 12 months.
- **Expected:** EMI ₹10,000.00; interest 0.
- **Status:** Pass — emi.test + plan.test (zero rate).

### TC-LOAN-04 — Flat-rate loan (FR-LOAN-04)

- **Data:** Principal ₹5,00,000; flat 8% p.a.; 36 months.
- **Expected:** EMI = (500000 + 500000×8×(36/12)/100) / 36 = (500000 + 120000) / 36 = **₹17,222.22**; effective reducing rate shown ≈ 14–15% (computed, not hard-coded).
- **Status:** Pass — emi.test (flat rate).

### TC-LOAN-05 — Record EMI payment creates expense (FR-LOAN-05, FR-LOAN-09)

- **Steps:** Mark installment 14 paid on 05/11/2026 with late fee ₹200.
- **Expected:** Status `paid`; expense for ₹16,903.92 under Loan & Finance › EMI payment (+ late payment line if split); interest component stored.
- **Status:** Pass — payment.test + loan_payments (PGlite) + loans.test.

### TC-LOAN-06 — Late status (FR-LOAN-05)

- **Steps:** Installment due 05/10/2026 not paid by 08/10/2026.
- **Expected:** Status shows _Late_.
- **Status:** Pass — payment.test (late status).

### TC-LOAN-07 — Prepayment tenure reduction (FR-LOAN-06)

- **Data:** After 14 EMIs, prepay ₹1,00,000 with reduce-tenure option.
- **Expected:** Remaining months decrease; EMI unchanged; interest saved shown ≥ 0.
- **Status:** Pass — simulate.test + emi.test + simulators.test.

### TC-LOAN-08 — Prepayment EMI reduction (FR-LOAN-06)

- **Expected:** Tenure unchanged; EMI recalculated; formula per SDD §5.5.
- **Status:** Pass — simulate.test + emi.test + simulators.test.

### TC-LOAN-09 — Foreclosure estimate (FR-LOAN-07)

- **Data:** Foreclosure date with outstanding ₹5,00,000 and charge 4%.
- **Expected:** Total payable = outstanding + 4% × outstanding + accrued interest to date (if shown); figures match worksheet.
- **Status:** Pass — emi.test + simulators.test (foreclosure).

### TC-LOAN-10 — Loan summary (FR-LOAN-08)

- **Expected:** Outstanding, interest paid, interest remaining, months remaining correct for 14/60 paid.
- **Status:** Pass — emi.test (summary) + loans.test.

### TC-LOAN-11 — Close loan (FR-LOAN-11)

- **Expected:** Status `closed`; loan appears under _Closed_ filter; no further EMIs due.
- **Status:** Pass — loans.test (close and Closed filter).

---

## TC-RPT — Dashboard & reports

### TC-RPT-01 — Dashboard totals (FR-RPT-01)

- **Data:** Seeded fixture data (see Test Strategy §5).
- **Expected:** Monthly total equals sum of expenses in the month for active vehicle, to the paisa.
- **Status:** Pass — dashboard.test + reports dashboard.test (to the paisa).

### TC-RPT-02 — Financial year filter (FR-RPT-05)

- **Steps:** Select "This FY" on 11/10/2026.
- **Expected:** Range 01/04/2026 – 31/03/2027; data from 01/03/2026 excluded.
- **Status:** Pass — period.test + monthly.test + reports.test.

### TC-RPT-03 — CSV export opens in Excel (FR-RPT-04)

- **Steps:** Export expenses; open in Excel/LibreOffice.
- **Expected:** Columns correct; ₹ and Hindi/Marathi vendor names readable (UTF-8 BOM); amounts numeric.
- **Status:** Partly — CSV columns, numeric amounts and BOM tested; opening in Excel is manual.

### TC-RPT-04 — Empty state (Design §9)

- **Expected:** New user sees onboarding prompts, no charts with NaN.
- **Status:** Pass — dashboard.test + dashboard empty state.

---

## TC-PWA — Installability & offline

### TC-PWA-01 — Installable (FR-PWA-01)

- **Steps:** Lighthouse → PWA audit on production build.
- **Expected:** Installable; manifest icons 192/512/maskable present.
- **Status:** Partly — manifest and icons checked in Chromium (stc-local-check); install prompt on Android and iPhone not run.

### TC-PWA-02 — App shell loads offline (FR-PWA-02)

- **Steps:** Load app online; enable airplane mode; reload.
- **Expected:** App shell renders; offline banner shown.
- **Status:** Pass — stc-local-check: shell opens offline with the offline notice (Chromium).

### TC-PWA-03 — Read cached data offline (FR-PWA-03)

- **Expected:** Dashboard shows last synced data with "Last updated" timestamp.
- **Status:** Pass — offlineReads.test + offlineCache.test + offline.test.

### TC-PWA-04 — Queue expense offline and sync (FR-PWA-04, FR-PWA-05)

- **Steps:** Airplane mode → add fuel fill → badge shows "1 pending" → disable airplane mode.
- **Expected:** Within 30 s, row appears in Supabase (verify in Studio); badge clears; no duplicate after refresh.
- **Status:** Partly — sync.test replays the queue against stubs; real offline save and sync not run on a device.

### TC-PWA-05 — Duplicate protection on retry (NFR-REL-02)

- **Steps:** Simulate network drop after server commit (DevTools throttling); app retries.
- **Expected:** Only one fuel row exists (RPC idempotent on id).
- **Status:** Pass — sync.test (no duplicates) + tests/db/fuel and add_expense (idempotent).

### TC-PWA-06 — Update prompt (FR-PWA-06)

- **Expected:** After deploying v2 build, banner "New version available — Refresh".
- **Status:** Partly — pwa.test covers the update prompt component; a real deployed update not run.

---

## TC-DATA — Backup, export, deletion

### TC-DATA-01 — JSON backup (FR-DATA-01)

- **Expected:** File contains schema version, all vehicles, expenses, fuel logs, loans, payments, reminders for user only.
- **Status:** Pass — backup.test + tests/db/backup.

### TC-DATA-02 — JSON restore into empty account (FR-DATA-02)

- **Expected:** Row counts match backup; IDs preserved; no other user data touched.
- **Status:** Pass — backup.test + tests/db/restore.

### TC-DATA-03 — Account deletion (FR-DATA-03)

- **Steps:** Settings → Delete account → type `DELETE`.
- **Expected:** Auth user removed; storage receipts removed; sign-in fails afterwards.
- **Status:** Partly — tests/db/account_delete + functions/delete-account + account.test; hosted deletion needs staging.

### TC-DATA-04 — Receipt private access (FR-DATA-04)

- **Steps:** Copy a receipt storage path; request without token.
- **Expected:** 400/403; with another user's token: 403.
- **Status:** Partly — tests/db/storage policies on PGlite; bucket config on the hosted project needs staging.

---

## TC-SEC — Security (RLS & privacy)

### TC-SEC-01 — Cross-user read blocked (NFR-SEC-01)

- **Steps:** As Alice, GET `/rest/v1/vehicles?user_id=eq.<bob-id>`.
- **Expected:** Empty array `[]` (not Bob's data).
- **Status:** Pass — tests/db/rls (PGlite, Supabase shim).

### TC-SEC-02 — Cross-user insert blocked (NFR-SEC-01)

- **Steps:** As Alice, POST expense with `user_id` = Bob's id.
- **Expected:** 403 / RLS violation.
- **Status:** Pass — tests/db/rls.

### TC-SEC-03 — Cross-vehicle attach blocked (SDD §9)

- **Steps:** As Alice, POST expense with Alice's user_id but Bob's vehicle_id.
- **Expected:** FK violation (composite key).
- **Status:** Pass — tests/db/rls (composite FK).

### TC-SEC-04 — Anonymous access blocked (NFR-SEC-01)

- **Steps:** GET `/rest/v1/expenses` with anon key only.
- **Expected:** 401/403.
- **Status:** Pass — tests/db/rls (anonymous).

### TC-SEC-05 — Service role key not in bundle (NFR-SEC-02)

- **Steps:** `grep -r "service_role" dist/`.
- **Expected:** No matches.
- **Status:** Pass — T30: no service_role in dist bundle; static.test.

### TC-SEC-06 — CSP header present (NFR-SEC-05)

- **Expected:** Response header `Content-Security-Policy` present on hosted app.
- **Status:** Partly — _headers verified locally with a header-applying server; hosted curl -I after deploy.

### TC-SEC-07 — XSS in vendor name (NFR-SEC-06)

- **Steps:** Vendor `<img src=x onerror=alert(1)>`.
- **Expected:** Shown as plain text; no alert.
- **Status:** Pass — xss.test (component level).

### TC-SEC-08 — Tokens not logged (NFR-SEC-08)

- **Expected:** Production console has no access token strings.
- **Status:** Partly — static.test (console calls); no runtime console check for token strings.

---

## TC-UI — Usability & accessibility

### TC-UI-01 — Bottom navigation labels (Design §3)

- **Expected:** All five tabs labelled with text.
- **Status:** Pass — shell.test (navigation labels).

### TC-UI-02 — Tap targets (NFR-USE-03)

- **Expected:** Interactive elements ≥ 44×44 px (checked via DevTools overlay).
- **Status:** Pass — stc-local-check: 37 controls at least 44×44 px at 390 px.

### TC-UI-03 — Dark mode (NFR-USE-03)

- **Expected:** Contrast ≥ 4.5:1 for body text; charts readable.
- **Status:** Pass — contrast.test (both themes) + axe scan; see DTL-001, DTL-002.

### TC-UI-04 — Keyboard navigation (Design §8)

- **Expected:** Full add-expense flow completable with keyboard on desktop.
- **Status:** Pass — keyboard-check.mjs: add-expense by keyboard in Chromium.

### TC-UI-05 — Screen reader labels (Design §8)

- **Expected:** axe-core scan shows zero critical violations.
- **Status:** Pass — a11y-scan.mjs: 0 critical, 0 serious on 26 pages; see DTL-003.

### TC-UI-06 — Responsive 320 px (NFR-PERF/Compat)

- **Expected:** No horizontal scroll on 320 px width.
- **Status:** Pass — stc-local-check: no horizontal overflow at 320 px on 11 routes.

---

## TC-PERF — Performance

### TC-PERF-01 — First contentful paint (NFR-PERF-01)

- **Expected:** ≤ 2.5 s on Lighthouse mid-range 4G profile.
- **Status:** Partly — Lighthouse mobile on /login: FCP 2.0 s; signed-in home and hosted build not measured.

### TC-PERF-02 — Dashboard load with 5,000 expenses (NFR-PERF-02)

- **Expected:** ≤ 1.5 s from data fetch complete to render.
- **Status:** Pass — perf-check.mjs: 300 ms at 1x, 895 ms at 4x (stub backend).

### TC-PERF-03 — Bundle size (NFR-PERF-04)

- **Expected:** Initial JS gzip ≤ 250 KB (`npm run build` report).
- **Status:** Pass — bundle-budget.mjs: 185,219 B gzip against 250,000 B.

---

## Traceability Summary

| Area        | Test cases    | FR coverage       |
| ----------- | ------------- | ----------------- |
| Auth        | TC-AUTH-01…06 | FR-AUTH-01…04, 06 |
| Vehicles    | TC-VEH-01…07  | FR-VEH-01…06      |
| Expenses    | TC-EXP-01…10  | FR-EXP-01…09      |
| Fuel        | TC-FUEL-01…07 | FR-FUEL-01…05     |
| Reminders   | TC-REM-01…05  | FR-REM-01…05      |
| Loans       | TC-LOAN-01…11 | FR-LOAN-01…11     |
| Reports     | TC-RPT-01…04  | FR-RPT-01…05      |
| PWA         | TC-PWA-01…06  | FR-PWA-01…06      |
| Data        | TC-DATA-01…04 | FR-DATA-01…04     |
| Security    | TC-SEC-01…08  | NFR-SEC-01…08     |
| UI / a11y   | TC-UI-01…06   | NFR-USE-01…05     |
| Performance | TC-PERF-01…03 | NFR-PERF-01…05    |

Total: **77 test cases**. FR-AUTH-05 and FR-EXP/RPT items marked Should are included at lower priority.
