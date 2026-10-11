# Software Design Document (SDD) — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 (Draft) |
| Date | 2026-10-11 |
| Implements | SRS v1.0 |

## 1. Design Overview
A single-page React application (PWA) that talks directly to Supabase through `@supabase/supabase-js`. There is no custom backend server. Security is enforced in PostgreSQL through Row Level Security (RLS). Multi-step writes (fuel log + expense, loan payment + expense) use Postgres functions (RPC) so they are atomic.

## 2. Design Goals & Principles
1. **Simplicity** — fewest moving parts that meet requirements.
2. **Security by default** — RLS on everything; client holds only the anon key.
3. **Offline tolerance** — writes are queued locally; reads come from cache.
4. **Pure business logic** — EMI, mileage, and schedule code is framework-free and unit-tested.
5. **India-first** — INR, Indian FY, lakh formatting, Indian vehicle categories.

## 3. Module Decomposition

```
src/
├── app/                 # bootstrap, router, providers, PWA registration
├── core/                # framework-free domain logic (pure TS, no React)
│   ├── money/           # paise-safe arithmetic, INR formatting
│   ├── dates/           # Indian FY, period presets, DD/MM/YYYY helpers
│   ├── loan/            # EMI, amortisation, prepayment, foreclosure
│   ├── fuel/            # km/l, cost per km
│   ├── reminders/       # due-date computation
│   └── validation/      # Zod schemas (shared client-side)
├── data/                # Supabase client, query hooks, RPC wrappers, Dexie offline store
├── features/
│   ├── auth/
│   ├── vehicles/
│   ├── expenses/
│   ├── fuel/
│   ├── reminders/
│   ├── loans/
│   ├── dashboard/
│   ├── reports/
│   └── settings/        # backup/restore, account deletion
├── components/          # shared UI (Button, Card, Money, DatePicker, Donut, Bar)
├── styles/
└── test/                # fixtures, test helpers
```

**Dependency rule:** `core` depends on nothing. `features` depend on `core`, `data`, `components`. `components` depend on nothing except React and styles.

## 4. Key Components

| Component | Responsibility |
|---|---|
| `SupabaseClient` | Single instance created from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| `AuthProvider` | Holds session; redirects guests to `/login`. |
| `VehicleContext` | Holds the active vehicle ID; persisted in localStorage. |
| `SyncEngine` | Pushes queued Dexie records to Supabase; pulls changed rows since last sync. |
| `QueryLayer` | Read path: TanStack Query (or equivalent) with cache in IndexedDB for offline. |
| `MoneyInput` | Accepts ₹ amounts with Indian grouping; outputs number with 2 decimals. |
| `Dashboard` | Aggregates from views `v_monthly_spend` and `v_fuel_efficiency`. |

## 5. Key Algorithms

### 5.1 EMI (reducing balance)
```
r = annualRate / 12 / 100
n = tenureMonths
if r == 0: EMI = P / n
else:      EMI = P * r * (1+r)^n / ((1+r)^n - 1)
EMI = round2(EMI)
```
Final instalment adjusts to clear residual balance (± ₹1–2 rounding).

### 5.2 Amortisation schedule
```
balance = P
for k in 1..n:
    interest  = round2(balance * r)
    principal = (k == n) ? balance : round2(EMI - interest)
    balance   = round2(balance - principal)
    emd       = principal + interest   # last row adjusts
```

### 5.3 Flat-rate loan
```
EMI_flat = (P + P * R * (n/12) / 100) / n    # R = flat annual %, n = months
effective_rate ≈ solve r such that PV(EMI_flat, n, r) = P   # Newton-Raphson, 50 iterations max
```

### 5.4 Prepayment (reduce tenure, keep EMI)
Recompute remaining months `n'` so that `PV(EMI, n', r) = outstanding`:
`n' = -ln(1 - outstanding * r / EMI) / ln(1 + r)`, rounded up. If the denominator ≤ 0, the loan is fully repaid.

### 5.5 Prepayment (reduce EMI, keep tenure)
`EMI' = outstanding * r * (1+r)^m / ((1+r)^m − 1)` where `m` = remaining months.

### 5.6 Fuel efficiency
- Sort full-tank fills by odometer.
- For each consecutive pair (i-1, i) where both are full-tank:
  - `distance = odo[i] − odo[i-1]`
  - `litres = sum(litres of fills after i-1 up to and including i)` (partial fills in between are included in litres).
  - `kmpl = distance / litres` (reject if distance ≤ 0 or litres ≤ 0).
- Average = total distance / total litres over valid intervals.

### 5.7 Cost per km
`costPerKm = totalSpendInPeriod / (odoEnd − odoStart)` where odometer values come from the vehicle log in that period. Show "insufficient data" if distance < 50 km.

### 5.8 Indian Financial Year
`FY start = (month >= 4) ? year : year − 1`; range `1 Apr FY_start` to `31 Mar FY_start+1`.

## 6. Data Flow (write path, online)
1. User submits form → Zod validation.
2. If online: call RPC (`add_fuel_log`) or table insert.
3. On success, invalidate query cache and update Dexie copy.
4. On network failure: write to Dexie `outbox` with status `pending`; show pending badge.

## 7. Offline Design
- **Stores (IndexedDB via Dexie):** `vehicles`, `expenses`, `fuel_logs`, `loans`, `loan_payments`, `reminders`, `outbox`, `meta` (last_sync_at).
- **Client-generated UUIDs** (`crypto.randomUUID()`) for all new rows → idempotent retries.
- **Outbox entry:** `{ id, table, op: 'insert'|'update'|'delete', payload, attempts, last_error, created_at }`.
- **Sync order:** vehicles → expenses/fuel (fuel uses RPC with client `id`) → loans → loan_payments → reminders.
- **Conflict policy:** inserts never conflict. Updates use `updated_at` last-write-wins. Deletes are soft-deleted (`deleted_at`) for sync safety.

> Soft delete: add `deleted_at timestamptz` to synced tables, filter `deleted_at is null` in RLS-safe views and queries.

## 8. Error Handling
| Error class | Handling |
|---|---|
| Validation (client) | Inline message under field; no request sent. |
| 401 / expired session | Silent refresh; if fail → login screen, keep outbox. |
| 403 (RLS) | Show "Not allowed" and log to console in dev only. |
| 409 (unique: reg. no.) | "Vehicle with this number already exists." |
| 5xx / network | Retry with back-off; keep in outbox. |
| Storage quota full | Warn user; disable receipt upload. |

## 9. Security Design
- Auth: Supabase Auth, email + password, magic link optional.
- Tokens stored by Supabase JS in localStorage (acceptable for personal app; see SRS NFR-SEC).
- RLS policies per table (see Database Schema).
- Storage bucket `receipts` private; path format `{user_id}/{expense_id}/{n}.jpg`; storage policy checks first folder = `auth.uid()`.
- CSP meta header via hosting config (see Deployment Guide).
- No user input rendered as HTML (React escapes by default; `dangerouslySetInnerHTML` forbidden by lint rule).

## 10. Configuration
| Variable | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local`, hosting env | No |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, hosting env | No (public, RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets only | **Yes** |

## 11. Logging & Monitoring
- Client errors: `window.onerror` → console in dev; in prod a small `error_logs` table (optional, RLS insert-only).
- Supabase dashboard logs for API and Auth (free tier retention is limited; check docs).

## 12. Testing Hooks
- Core functions are pure → unit tests with Vitest.
- RPC functions tested with `pgTAP` (optional) or SQL scripts in `supabase/tests`.
- Components use Testing Library with mocked Supabase client.

## 13. Open Design Decisions
| ID | Question | Current decision |
|---|---|---|
| D-1 | Use TanStack Query or simple hooks? | TanStack Query (MIT) for cache & retries |
| D-2 | Hard vs soft delete | Soft delete on synced tables |
| D-3 | Charting library | Recharts |
| D-4 | Account deletion via RPC or Edge Function | Edge Function (needs admin API to delete auth user) |
