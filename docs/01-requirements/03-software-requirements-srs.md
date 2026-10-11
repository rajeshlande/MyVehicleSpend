# Software Requirements Specification (SRS) — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 (Draft) |
| Date | 2026-10-11 |
| Standard reference | IEEE 830-style structure (adapted) |

## 1. Introduction

### 1.1 Purpose
Defines functional and non-functional requirements for the My Vehicle Spend PWA, to be implemented on React + Supabase.

### 1.2 Scope
A web application (PWA) for individual users to record vehicle expenses, fuel logs, reminders and vehicle loan details.

### 1.3 Definitions
See BRD Appendix B. Additional: **RLS** — Row Level Security; **PWA** — Progressive Web App; **Full tank** — a fuel fill-up where the tank was filled to the top.

### 1.4 References
BRD, URS, SDD, Database Schema, UI/UX Design.

## 2. Overall Description

### 2.1 Product Perspective
Standalone web app. Frontend is static assets served from a CDN. All persistence and authentication is handled by Supabase (managed PostgreSQL + Auth + Storage). No custom server.

### 2.2 User Classes
| Class | Description | Access |
|---|---|---|
| Owner (authenticated) | Registers and manages own vehicles | Own data only |
| Guest (unauthenticated) | Sees sign-in and sign-up pages only | None |
| Administrator | Operator of the Supabase project | Supabase dashboard (not in app) |

### 2.3 Operating Environment
- Browsers: latest 2 versions of Chrome, Edge, Firefox, Safari (iOS 16.4+ for PWA install).
- Devices: Android 9+, iOS 16.4+, Windows 10+, macOS 12+, Linux desktop.
- Network: online for sync; app shell and cached data work offline.

### 2.4 Design & Implementation Constraints
- Frontend: React 18, TypeScript (strict), Vite.
- Backend: Supabase free tier only.
- Security: all tables protected by RLS; anon key only in client; service role key never in client.
- Accessibility: WCAG 2.1 AA target.

### 2.5 Assumptions & Dependencies
- Supabase Auth email delivery uses Supabase default SMTP (rate-limited on free tier) — acceptable for personal use.
- Browser supports IndexedDB, Service Workers, Web Crypto.

## 3. Functional Requirements

### 3.1 Authentication & Profile (AUTH)
| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | User can sign up with email and password. | Must |
| FR-AUTH-02 | User can sign in with email and password or magic link. | Must |
| FR-AUTH-03 | User can reset password by email. | Must |
| FR-AUTH-04 | User can sign out from all screens. | Must |
| FR-AUTH-05 | Profile stores display name, preferred currency (INR default), and locale (en-IN). | Should |
| FR-AUTH-06 | Session persists across browser restarts until expiry. | Must |

### 3.2 Vehicle Management (VEH)
| ID | Requirement | Priority |
|---|---|---|
| FR-VEH-01 | User can add a vehicle with: type (car / bike / scooter / other), registration number (Indian format, e.g. MH12AB1234, validated loosely), make, model, variant, fuel type (petrol, diesel, CNG, EV, hybrid, LPG), purchase date, purchase price, odometer at start. | Must |
| FR-VEH-02 | User can edit and archive a vehicle. | Must |
| FR-VEH-03 | User can delete a vehicle after typed confirmation; linked data is deleted (cascade). | Must |
| FR-VEH-04 | User can have multiple vehicles and select an active vehicle. | Must |
| FR-VEH-05 | Vehicle screen shows current odometer, derived from latest log. | Must |
| FR-VEH-06 | Registration number is stored upper-case without spaces, unique per user. | Must |

### 3.3 Expense Management (EXP)
| ID | Requirement | Priority |
|---|---|---|
| FR-EXP-01 | User can add an expense with: vehicle, date, category, sub-category (from BRD Appendix A), amount (INR), payment mode (cash, UPI, card, net banking, FASTag wallet, EMI, other), vendor, odometer (optional), GST amount (optional), notes, receipt photo (optional). | Must |
| FR-EXP-02 | User can edit and delete own expenses. | Must |
| FR-EXP-03 | User can filter expenses by vehicle, date range, category, payment mode, amount range. | Must |
| FR-EXP-04 | User can search by vendor or note text. | Should |
| FR-EXP-05 | User can duplicate an expense (for recurring items). | Should |
| FR-EXP-06 | Amount must be > 0 and ≤ ₹1,00,00,000 (one crore) per entry. | Must |
| FR-EXP-07 | Expense with odometer must not be lower than previous odometer for the same vehicle (warning, user may override with reason). | Must |
| FR-EXP-08 | User can attach up to 3 receipt images (≤ 1 MB each after client-side compression). | Should |
| FR-EXP-09 | Quick-add form supports entry in under 15 seconds for a common expense (category + amount + Save). | Should |

### 3.4 Fuel Log (FUEL)
| ID | Requirement | Priority |
|---|---|---|
| FR-FUEL-01 | User can record a fuel fill-up: date, odometer, litres, price per litre, total (auto-calc), full tank (yes/no), station, payment mode. | Must |
| FR-FUEL-02 | System computes km/l between consecutive full-tank fill-ups, ignoring partial fills in the calculation. | Must |
| FR-FUEL-03 | System shows average km/l, best and worst, and cost per km for selected period. | Must |
| FR-FUEL-04 | Fuel logs also create an expense row under category Fuel (single source for totals). | Must |
| FR-FUEL-05 | EV users can log charging sessions with kWh instead of litres. | Should |

### 3.5 Reminders & Documents (REM)
| ID | Requirement | Priority |
|---|---|---|
| FR-REM-01 | User can create a reminder with type (insurance, PUC, fitness, licence, road tax, service due by date, service due by km, custom), due date and/or due odometer, and lead-time (default 15 days). | Must |
| FR-REM-02 | Dashboard lists reminders due in the next 30 days and overdue items. | Must |
| FR-REM-03 | User can mark a reminder as done; the system stores completion date and optionally creates the matching expense. | Must |
| FR-REM-04 | Browser notifications are offered (opt-in) when the app is open or installed. | Should |
| FR-REM-05 | Insurance reminders store policy number, insurer, premium, IDV, expiry date. | Should |

### 3.6 Loan Tracker (LOAN)
| ID | Requirement | Priority |
|---|---|---|
| FR-LOAN-01 | User can add a loan: vehicle, lender, loan account (masked), principal, annual interest rate, tenure (months), start date, EMI (computed or entered), interest method (reducing / flat), processing fee, other charges. | Must |
| FR-LOAN-02 | System computes EMI using EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1), where r = annual rate ÷ 12 ÷ 100, and rounds to 2 decimals. | Must |
| FR-LOAN-03 | System generates full amortisation schedule (month, EMI, principal, interest, balance). | Must |
| FR-LOAN-04 | For flat-rate loans, the system computes EMI as (P + P × R × (N/12)/100) ÷ N using the flat annual rate R and N in months, and shows the effective reducing-balance rate as an estimate. | Should |
| FR-LOAN-05 | User records each actual EMI payment (date, amount, late fee, bounce charge, notes). Schedule shows paid / pending / late. | Must |
| FR-LOAN-06 | User can simulate a prepayment (amount, month) and see revised tenure or EMI and interest saved. | Should |
| FR-LOAN-07 | User can simulate foreclosure (date, foreclosure charge %) and see total payable. | Should |
| FR-LOAN-08 | Loan summary shows total interest paid, total interest outstanding, outstanding principal, months remaining. | Must |
| FR-LOAN-09 | Each EMI payment auto-creates an expense row under category Loan & Finance Costs (EMI), with interest component stored separately. | Must |
| FR-LOAN-10 | Reminder generated 3 days before each EMI date (configurable). | Should |
| FR-LOAN-11 | Loan can be marked Closed; closed loans remain viewable. | Must |

### 3.7 Dashboard & Reports (RPT)
| ID | Requirement | Priority |
|---|---|---|
| FR-RPT-01 | Dashboard shows, for the selected vehicle and period: total spend, spend by category (donut), monthly trend (bar), cost per km, cost per month, upcoming reminders, loan outstanding. | Must |
| FR-RPT-02 | Period presets: this month, last month, this financial year (Apr–Mar), last 12 months, custom. | Must |
| FR-RPT-03 | Monthly report table with category columns. | Should |
| FR-RPT-04 | CSV export of expenses, fuel logs and loan schedule (UTF-8 with BOM for Excel). | Must |
| FR-RPT-05 | Financial year option uses Indian FY (1 April to 31 March). | Must |

### 3.8 Offline & PWA (PWA)
| ID | Requirement | Priority |
|---|---|---|
| FR-PWA-01 | App is installable (manifest + service worker + icons 192, 512, maskable). | Must |
| FR-PWA-02 | App shell loads offline after first visit. | Must |
| FR-PWA-03 | Previously fetched data is viewable offline (read cache). | Should |
| FR-PWA-04 | New expenses and fuel logs created offline are queued and synced when online, with conflict-free insert (client-generated UUID). | Should |
| FR-PWA-05 | Pending-sync indicator shows number of queued items. | Should |
| FR-PWA-06 | App prompts user to refresh when a new version is available. | Should |

### 3.9 Data Management (DATA)
| ID | Requirement | Priority |
|---|---|---|
| FR-DATA-01 | User can export all their data as a JSON backup. | Must |
| FR-DATA-02 | User can import a JSON backup into an empty account. | Should |
| FR-DATA-03 | User can permanently delete their account and all data (in-app request, executed by a server-side function). | Must |
| FR-DATA-04 | Receipt files are stored in a private bucket; access by signed URL valid 1 hour. | Must |

## 4. Non-Functional Requirements

### 4.1 Performance
| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-01 | First contentful paint on 4G mid-range Android | ≤ 2.5 s |
| NFR-PERF-02 | Dashboard data load (≤ 5,000 expense rows per user) | ≤ 1.5 s |
| NFR-PERF-03 | Save expense round-trip | ≤ 1 s p95 online |
| NFR-PERF-04 | Initial JS bundle (gzip) | ≤ 250 KB |
| NFR-PERF-05 | Lighthouse Performance score (mobile) | ≥ 90 |

### 4.2 Security & Privacy
| ID | Requirement |
|---|---|
| NFR-SEC-01 | Row Level Security enabled on every table in the exposed `public` schema; policies restrict rows to `auth.uid()`. |
| NFR-SEC-02 | Only the Supabase anon key is embedded in the client. Service role key is never committed or shipped. |
| NFR-SEC-03 | All traffic over HTTPS (enforced by hosting and Supabase). |
| NFR-SEC-04 | Passwords hashed by Supabase Auth (bcrypt). App never stores raw passwords. |
| NFR-SEC-05 | Content Security Policy header restricts scripts to self and Supabase domain. |
| NFR-SEC-06 | Input validated with Zod on client and CHECK constraints in the database. |
| NFR-SEC-07 | Receipt uploads limited to JPEG, PNG, WebP, PDF; max 5 MB raw. |
| NFR-SEC-08 | Session tokens are not logged to console in production builds. |
| NFR-SEC-09 | Personal data is not sent to third-party analytics by default. |

### 4.3 Reliability & Availability
| ID | Requirement |
|---|---|
| NFR-REL-01 | Target availability 99% (bounded by Supabase free tier; no SLA). |
| NFR-REL-02 | Offline queue retries failed syncs with exponential back-off (max 5 attempts, then manual retry). |
| NFR-REL-03 | No data loss for queued offline entries across browser restarts (IndexedDB). |
| NFR-REL-04 | Weekly backup via JSON export is documented and encouraged (see Sysadmin Guide). |

### 4.4 Usability
| ID | Requirement |
|---|---|
| NFR-USE-01 | Mobile-first layout; all primary actions reachable with one thumb. |
| NFR-USE-02 | Indian number format, ₹ symbol, DD/MM/YYYY. |
| NFR-USE-03 | Text size adjustable via system settings; minimum tap target 44 × 44 px. |
| NFR-USE-04 | Error messages are plain language and state the fix. |
| NFR-USE-05 | English UI in v1.0; strings externalised for future Hindi/Marathi translation. |

### 4.5 Maintainability
| ID | Requirement |
|---|---|
| NFR-MNT-01 | Test coverage ≥ 70% lines for business logic (EMI, mileage, schedule). |
| NFR-MNT-02 | Database changes made only through versioned SQL migrations in `supabase/migrations`. |
| NFR-MNT-03 | Code follows the Coding Standards document; CI runs lint, type-check, tests. |

### 4.6 Portability & Compatibility
- Responsive from 320 px to 1920 px width.
- Works in light and dark mode (follows system preference).

### 4.7 Legal & Compliance
- Privacy notice displayed at sign-up.
- Users can export and delete their data (DPDP Act, 2023 principles of consent and erasure considered; not legal advice).

## 5. System Inputs & Outputs

| Input | Source | Validation |
|---|---|---|
| Sign-up / login credentials | User | Email format; password ≥ 8 chars |
| Vehicle details | User | Reg. number pattern; numeric ranges |
| Expense / fuel / loan entries | User | Zod schema; amount > 0; dates not in far future (≤ 1 day ahead) |
| Receipt images | User | Type & size checks |
| Backup JSON | User | Schema version check |

| Output | Format | Destination |
|---|---|---|
| Dashboard & reports | HTML/Charts | Screen |
| CSV export | `.csv` UTF-8 BOM | Download |
| JSON backup | `.json` | Download |
| Notifications | Browser Notification API | Device |
| EMI schedule | Table / CSV | Screen / Download |

## 6. Acceptance Criteria Summary
All Must requirements pass system tests (see System Test Cases). Any open Critical or High defect blocks release.

## 7. Traceability
Each FR maps to test cases in `02-system-test-cases.md` using the same ID (e.g. TC-EXP-01 ↔ FR-EXP-01).
