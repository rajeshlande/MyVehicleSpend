# Release Notes — My Vehicle Spend

Format follows [Keep a Changelog](https://keepachangelog.com) and [Semantic Versioning](https://semver.org). The same content is mirrored in `CHANGELOG.md` at the repository root.

---

## [1.0.0] — planned for 2026-11-26

### Summary

First public release of My Vehicle Spend: a free, installable web app to track car and bike expenses in India, record fuel and mileage, get renewal reminders, and manage vehicle loans with EMI schedules.

### Added

- **Vehicles:** add and manage multiple cars, bikes and scooters with Indian registration numbers.
- **Expenses:** about 100 Indian expense sub-categories across fuel, insurance, RTO and government fees, tolls and FASTag, service and parts, accessories, traffic challans, loan costs and other.
- **Receipts:** attach up to 3 photos per expense, compressed in the browser.
- **Fuel log:** petrol, diesel, CNG, LPG and EV charging (kWh); automatic km/l from full-tank fills; cost per km.
- **Reminders:** insurance, PUC, fitness, licence, road tax, service by date or km; "mark done" creates the matching expense.
- **Loan tracker:** EMI calculator (reducing and flat-rate), full amortisation schedule, paid/late tracking, EMI payment auto-expense, prepayment and foreclosure simulator, loan summary.
- **Dashboard:** monthly total, category donut, monthly trend, cost per km, upcoming reminders, loan outstanding.
- **Reports:** Indian financial year (Apr–Mar) filter; monthly category table; CSV export (Excel-ready with UTF-8 BOM).
- **Data:** JSON backup and restore; account deletion with all data removed.
- **PWA:** installable on Android, iOS 16.4+ and desktop; app shell works offline; offline entries queued and synced automatically.
- **Security:** email sign-in, row-level security on every table, private receipt storage, strict security headers.
- **Formatting:** ₹ with Indian digit grouping (₹1,23,456.00), DD/MM/YYYY dates, km and litres.

### Changed

- N/A (first release).

### Fixed

- N/A (first release).

### Known issues

| ID    | Description                                                                               | Workaround                               |
| ----- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| KI-01 | iOS does not run background sync; queued entries sync when the app is next opened.        | Open the app to sync.                    |
| KI-02 | Auth emails use Supabase's shared sender and may be delayed.                              | Check spam folder; use password sign-in. |
| KI-03 | Supabase free projects pause after 7 days without activity (mitigated by keep-alive job). | Restore from the Supabase dashboard.     |
| KI-04 | English UI only.                                                                          | —                                        |

### Security

- No known vulnerabilities at release (`npm audit --omit=dev` clean).

### Upgrade notes

First install; no upgrade path required.

---

## [0.1.0] — internal milestone (planned 2026-11-01)

- Walking skeleton: auth, vehicles, expense list and add form, Supabase schema v1.
- Not released to users.

## Versioning policy

- **MAJOR** — breaking change to data format or removal of a feature.
- **MINOR** — new feature, backward-compatible.
- **PATCH** — bug fix, copy or style change.
- Pre-releases use `-rc.N` (for example `1.0.0-rc.1` for UAT).
