# Changelog — My Vehicle Spend

All notable changes are listed here. Format: [Keep a Changelog](https://keepachangelog.com). Versions: [Semantic Versioning](https://semver.org).
This file mirrors `docs/05-deployment-maintenance/02-release-notes.md`. Nothing is released yet; 1.0.0 is planned, not tagged.

How to update: add each user-visible change under `## [Unreleased]` in the right section (Added, Changed, Deprecated, Removed, Fixed, Security). At release, rename `Unreleased` to the new version and date, set the same version in `package.json`, and add a new empty `Unreleased` section above it. `npm test` fails if the file and `package.json` disagree.

---

## [Unreleased]

### Added

- Versioning and changelog: the app version comes from `package.json` and is shown in the app. The change history is in this file and is checked by the test suite.
- What's new screen (`/whats-new`) shows this changelog in the app. More shows the version and build date.
- Calendar (`/calendar`): month view of reminders on their due dates, with status colours. Reminders without a date are listed below.
- Password recovery (`/recover`): sends a reset link. The answer is the same whether or not the email has an account.
- Account-created step after sign-up.
- Deployment to GitHub Pages from `main`, with the app served under the repository path.

### Changed

- New visual design (violet primary, soft grey page, rounded cards) across sign-in, sign-up, recovery, the dashboard and analytics.
- Sidebar menu on desktop: Dashboard, Analytics, Expenses, Loans, Reminders, Calendar, Settings.
- Analytics page (formerly Reports) has the new title and summary card.
- Dashboard charts use the new colour palette. Monthly bars follow the theme colour.
- Reminder rows show a status-coloured icon tile (Schedule list). Status text is unchanged.
- Calendar has day, week, month and year views.

### Security

- Production builds carry a content security policy as a meta tag, because GitHub Pages cannot set response headers. Frame blocking, HSTS and referrer headers are not set on Pages; see the deployment guide.

## [1.0.0] — planned for 2026-11-26

### Summary

First public release of My Vehicle Spend: a free, installable web app to track car and bike expenses in India, record fuel and mileage, get renewal reminders, and manage vehicle loans with EMI schedules.

### Added

- **Vehicles:** add and manage multiple cars, bikes and scooters with Indian registration numbers.
- **Expenses:** 78 default Indian expense sub-categories across fuel, insurance, RTO and government fees, tolls and FASTag, service and parts, accessories, traffic challans, loan costs and other.
- **Receipts:** attach up to 3 photos per expense, compressed in the browser.
- **Fuel log:** petrol, diesel, CNG, LPG and EV charging (kWh); automatic km/l from full-tank fills; cost per km.
- **Reminders:** insurance, PUC, fitness, licence, road tax, service by date or km; "mark done" creates the matching expense.
- **Loan tracker:** EMI calculator (reducing and flat-rate), full amortisation schedule, paid/late tracking, EMI payment auto-expense, prepayment and foreclosure simulator, loan summary.
- **Dashboard:** monthly total, category donut, monthly trend, cost per km, upcoming reminders, loan outstanding.
- **Reports:** Indian financial year (Apr–Mar) filter; monthly category table; CSV export (Excel-ready with UTF-8 BOM).
- **Data:** JSON backup and restore; account deletion with all data removed.
- **PWA:** installable on Android, iOS 16.4+ (to be confirmed in UAT) and desktop; app shell works offline; offline entries queued and synced automatically.
- **Security:** email sign-in, row-level security on every table, private receipt storage, strict security headers.
- **Formatting:** ₹ with Indian digit grouping (₹1,23,456.00), DD/MM/YYYY dates, km and litres.

### Changed

- N/A (first release).

### Fixed

- N/A (first release).

### Known issues

| ID    | Description                                                                                                                      | Workaround                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| KI-01 | iOS does not run background sync; queued entries sync when the app is next opened.                                               | Open the app to sync.                                                      |
| KI-02 | Auth emails use Supabase's shared sender and may be delayed.                                                                     | Check spam folder; use password sign-in.                                   |
| KI-03 | Supabase free projects pause after 7 days without activity (mitigated by keep-alive job).                                        | Restore from the Supabase dashboard.                                       |
| KI-04 | English UI only.                                                                                                                 | —                                                                          |
| KI-05 | Two moderate advisories in react-router 6.x (`npm audit --omit=dev`). Fix is a breaking upgrade to v7; deferred until after T35. | Not reachable from user input; app navigates to fixed internal paths only. |

### Security

- `npm audit --omit=dev`: 2 moderate, 0 high, 0 critical (react-router, see KI-05). Accepted for v1.0.

### Upgrade notes

First install; no upgrade path required.

---

---

## [0.1.0] — internal milestone (not released)

- Walking skeleton: auth, vehicles, expense list and add form, Supabase schema v1.
