# Implementation Plan: My Vehicle Spend v1.0

**Source of truth:** `docs/` (SRS FR/NFR IDs, STC test IDs, DB schema SQL).
**Task list:** `tasks/todo.md` (default checklist; no external tracker).
**Standing quality gate:** `agent-skills/references/definition-of-done.md` (copied rules in §5 below).
**Status:** Planning only. No application code written yet.

## 1. Overview

Build the v1.0 PWA in vertical slices: each slice delivers one working user path (DB + API + UI + tests). Pure business logic (EMI, mileage, money, dates) is built test-first and early, because the financial numbers must be right before any UI depends on them.

## 2. Assumptions (please confirm — see §7)

1. Stack exactly as in `README.md` and SDD: React 18 + TypeScript + Vite, Supabase, Dexie, TanStack Query, Recharts, Zod.
2. Email + password is the primary sign-in; magic link is optional (Should).
3. Supabase project region ap-south-1 (Mumbai); two projects: staging and production.
4. Frontend host is Cloudflare Pages (free).
5. Single-user accounts only in v1.0; no family sharing.
6. Tests run with Vitest (unit/component), Playwright (E2E), and SQL scripts for RLS (against local Supabase).
7. Repository branches: `main`, `develop`, `feat/*`, `fix/*`.

## 3. Architecture Decisions

- **Pure core, thin UI:** `src/core/*` has no React or network imports. All formulas live there and are tested directly.
- **Database enforces rules:** RLS on every table; odometer monotonic check and amount CHECKs in Postgres; multi-table writes via RPC (`add_fuel_log`, `record_loan_payment`).
- **Client UUIDs** for every created row, so offline inserts are idempotent.
- **Soft delete** (`deleted_at`) on synced tables.
- **Account deletion** is the only Edge Function (needs the service role key, which must never reach the browser).
- **No custom server.** Hosting is static files only.

## 4. Dependency Graph & Phases

```
Phase 0 Setup ──► Phase 1 Auth & Shell ──► Phase 2 Vehicles ──┬─► Phase 3 Expenses ──► Phase 4 Fuel
                                                             ├─► Phase 5 Loans (pure maths can start after Phase 0)
                                                             └─► Phase 6 Reminders
Phases 3–6 ──► Phase 7 Dashboard & Reports ──► Phase 8 Data & PWA ──► Phase 9 Hardening ──► Phase 10 Release
```

Phase 5's pure EMI engine (T16) has no dependency on the UI and can run in parallel with Phases 3–4.

## 5. Definition of Done (applied to every task)

From `agent-skills/references/definition-of-done.md`, tailored to this project:

- **Correctness:** the task's acceptance criteria pass; behaviour verified at runtime, not only typechecked; new tests fail without the change; full test suite green.
- **Quality:** lint and format clean; no dead code, debug output or commented-out code; no unrelated refactors.
- **Integration:** migrations applied locally and on staging; RLS policies present for new tables.
- **Documentation:** if behaviour differs from the SRS/API/Schema docs, update the doc in the same change.
- **Ship-readiness (per phase):** security review of new input and auth paths; no secrets in diff.
- **Human review:** the owner reviews each checkpoint before the next phase starts.

## 6. Checkpoints

| Checkpoint             | After tasks | Must be true                                                                  |
| ---------------------- | ----------- | ----------------------------------------------------------------------------- |
| CP-A Foundation        | T1–T4       | Build, lint, tests green; schema applied; RLS tests pass                      |
| CP-B Core usable       | T5–T15      | Sign up, add vehicle, log expenses and fuel, see mileage; works end-to-end    |
| CP-C Loans & reminders | T16–T20     | EMI reference numbers match TC-LOAN-01 to ₹0.01; reminders work               |
| CP-D Full features     | T21–T26     | Dashboard, reports, backup, deletion, PWA install, offline queue              |
| CP-E Release candidate | T27–T31     | Security/a11y/perf gates met; STC run complete; no open Critical/High defects |

## 7. Open Questions (blocking only where noted)

| #   | Question                                 | Blocks  | Default if no answer |
| --- | ---------------------------------------- | ------- | -------------------- |
| Q1  | Email+password only, or also magic link? | T5      | Email+password only  |
| Q2  | Cloudflare Pages, Netlify or Vercel?     | T31     | Cloudflare Pages     |
| Q3  | Licence for the repo?                    | Release | MIT                  |
| Q4  | Single-user v1.0 confirmed?              | Scope   | Yes                  |

## 8. Risks & Mitigations

| Risk                    | Mitigation                                                     | Task |
| ----------------------- | -------------------------------------------------------------- | ---- |
| Wrong loan maths        | Reference tests first (TDD) against spreadsheet PMT values     | T16  |
| RLS gap exposes data    | SQL test suite run on every migration                          | T3   |
| Offline sync duplicates | Idempotent RPC on client UUID; retry test                      | T26c |
| Free-tier pause         | Keep-alive workflow                                            | T31  |
| Scope creep             | Anything not in SRS goes to a v2 backlog note, not into a task | all  |
| iOS PWA limitations     | Sync on app open; manual sync button                           | T26b |

## 9. Verification Strategy

- Every task: its focused test command, then the full suite before it is marked done.
- Every checkpoint: full suite, production build, Lighthouse PWA check on the built output, and a manual run of the core user path.
- Commands are defined by the project's `package.json` once T1 creates it (`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`).
