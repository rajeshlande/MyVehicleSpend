# Technical Onboarding Guide — My Vehicle Spend

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Version           | 1.0 (Draft)                                 |
| Date              | 2026-10-11                                  |
| Audience          | New developer or future you on a new laptop |
| Time to first run | ~45–60 minutes                              |

## 1. What you need (all free)

| Tool                            | Version          | Install                              |
| ------------------------------- | ---------------- | ------------------------------------ |
| Git                             | 2.40+            | https://git-scm.com                  |
| Node.js                         | 20 LTS or 22 LTS | https://nodejs.org or `nvm`          |
| npm                             | comes with Node  | —                                    |
| VS Code (optional)              | latest           | https://code.visualstudio.com        |
| Docker Desktop or Docker Engine | latest           | Needed only for local Supabase       |
| Supabase CLI                    | 1.x              | `npm i -D supabase` (dev dependency) |
| A GitHub account                | —                | For repo access and CI               |
| A Supabase account              | —                | Free plan at supabase.com            |

Windows users: use WSL 2 (Ubuntu) for the smoothest experience.

## 2. Get the code

```bash
git clone https://github.com/<your-user>/my-vehicle-spend.git
cd my-vehicle-spend
git checkout develop          # default working branch
```

## 3. Project layout (short form)

```
my-vehicle-spend/
├── docs/                   # all project documents (this set)
├── public/                 # static assets, icons (192, 512, maskable)
├── src/                    # application source (see SDD §3)
├── supabase/
│   ├── migrations/         # SQL migrations, numbered 0001_…
│   ├── seed.sql            # system categories
│   └── config.toml         # local Supabase config
├── tests/                  # e2e (Playwright) and api tests
├── .env.example            # template for local env vars
├── .github/workflows/      # CI: ci.yml, deploy.yml, keep-alive.yml
├── package.json
└── vite.config.ts
```

## 4. Environment variables

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

`.env.example`:

```dotenv
# Public values only. Never put the service_role key here.
VITE_SUPABASE_URL=http://127.0.0.1:54321        # local; use your cloud URL for staging/prod
VITE_SUPABASE_ANON_KEY=<paste anon key from `supabase status`>
VITE_APP_ENV=local
```

## 5. Run the backend locally (recommended)

```bash
npx supabase start            # starts Postgres, Auth, Storage, Studio in Docker
npx supabase status           # shows API URL and anon key
npx supabase db reset         # applies migrations + seed.sql to a fresh local DB
```

- Local Studio: http://127.0.0.1:54323
- Local inbox for auth emails (Mailpit): http://127.0.0.1:54324

## 6. Run the frontend

```bash
npm ci                        # install exact versions from lockfile
npm run dev                   # Vite dev server on http://localhost:5173
```

Open the URL, sign up with any email (local mail goes to Mailpit), add a vehicle, and log a fuel fill.

## 7. Everyday commands

| Command                    | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run dev`              | Dev server with hot reload                                            |
| `npm run build`            | Type-check and production build to `dist/`                            |
| `npm run preview`          | Serve `dist/` locally to test the PWA                                 |
| `npm run lint`             | ESLint                                                                |
| `npm run typecheck`        | `tsc --noEmit`                                                        |
| `npm test`                 | Vitest unit tests                                                     |
| `npm run test:e2e`         | Playwright end-to-end tests                                           |
| `npm run test:coverage`    | Coverage report to `coverage/`                                        |
| `npm run db:new -- <name>` | Create new migration file                                             |
| `npm run db:reset`         | Rebuild local DB from migrations                                      |
| `npm run db:types`         | Generate TypeScript types from schema to `src/data/database.types.ts` |
| `npm run docs:api`         | Generate TypeDoc HTML                                                 |

## 8. Branching & commits

- `main` — production, protected, tagged releases.
- `develop` — integration branch.
- `feat/<short-name>` — features, e.g. `feat/loan-prepayment`.
- `fix/<short-name>` — bug fixes.
- `docs/<short-name>` — documentation only.
- Commit messages follow **Conventional Commits**:
  - `feat(loans): add prepayment simulator`
  - `fix(fuel): handle zero litres in mileage`
  - `docs(srs): clarify FR-REM-03`
  - `test(emi): add flat-rate boundary cases`

Workflow:

1. `git checkout develop && git pull`
2. `git checkout -b feat/my-feature`
3. Commit small, run `npm run lint && npm test`
4. Push and open a Pull Request into `develop`.
5. CI must be green; one review (self-review checklist acceptable for solo work).
6. Squash-merge into `develop`. Release: merge `develop` → `main`, tag `vX.Y.Z`.

## 9. Pull request checklist

- [ ] Linked requirement or defect ID in PR title/body
- [ ] Unit tests added or updated
- [ ] STC entry added or updated if user-visible behaviour changed
- [ ] No secrets in diff
- [ ] Migration is additive or documented
- [ ] Docs updated (SRS/API/Schema) if behaviour changed

## 10. Working with Supabase

### 10.1 Create a cloud project (free)

1. Sign in at supabase.com → **New project** → choose the free plan, region **ap-south-1 (Mumbai)** for lowest latency in India.
2. Save the database password in a password manager.
3. Settings → API → copy **Project URL** and **anon public key**. Do **not** copy the service role key into the repo.

### 10.2 Link and push migrations

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push          # applies pending migrations to the linked cloud project
```

### 10.3 Auth settings for development

- Authentication → Providers → Email: enabled.
- Authentication → URL configuration: add `http://localhost:5173` and your production URL to **Redirect URLs**.
- For quicker local testing, you can disable "Confirm email" on the staging project only.

## 11. Troubleshooting

| Symptom                               | Fix                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `docker: cannot connect`              | Start Docker Desktop / `sudo systemctl start docker`                     |
| Port already in use                   | `npx supabase stop` then retry; or change port in `supabase/config.toml` |
| `Invalid API key`                     | Re-copy anon key from `npx supabase status`; restart dev server          |
| `new row violates row-level security` | Check RLS policy and that `user_id` is set to `auth.uid()`               |
| PWA not updating                      | DevTools → Application → Service Workers → "Update on reload"            |
| Cloud project paused                  | Dashboard → "Restore project" (see Sysadmin Guide)                       |
| `npm ci` fails on Node version        | Use Node 20 or 22 LTS (`nvm use 22`)                                     |

## 12. Learning resources (free)

- React: react.dev
- TypeScript handbook: typescriptlang.org/docs
- Supabase docs: supabase.com/docs (Auth, RLS, Database functions)
- Vite PWA plugin: vite-pwa-org.netlify.app
- Dexie.js: dexie.org/docs

## 13. Getting help

Record questions and answers in `docs/decision-log.md`. Log defects in `docs/04-testing/03-defect-tracking-log.md`.
