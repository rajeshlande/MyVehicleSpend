# Deployment Guide — My Vehicle Spend

| Field        | Value                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Version      | 1.0 (Draft)                                                                                                       |
| Date         | 2026-10-11                                                                                                        |
| Environments | Local → Staging → Production                                                                                      |
| Platforms    | Supabase (backend), Cloudflare Pages (frontend, primary), Netlify or Vercel (alternative), GitHub Actions (CI/CD) |
| Cost         | ₹0 on free tiers                                                                                                  |

## 1. Prerequisites

- GitHub repository with `main` and `develop` branches.
- Two Supabase free projects: `mvs-staging` and `mvs-prod` (region **ap-south-1 Mumbai**).
- Cloudflare account (free) — or Netlify/Vercel.
- Node.js 22 LTS locally (see Onboarding Guide).
- Access to the password manager with DB passwords and keys.

## 2. One-time setup

### 2.1 Supabase projects

1. Create `mvs-staging` and `mvs-prod`.
2. In each: **Project Settings → API**: note _Project URL_, _anon public key_, _Project ref_. Note the _service role key_ but store it only in the password manager and in GitHub Secrets for the Edge Function.
3. **Authentication → URL Configuration**:
   - Site URL: staging or prod frontend URL.
   - Redirect URLs: `http://localhost:5173/**`, `https://<staging-domain>/**`, `https://<prod-domain>/**`.
4. **Authentication → Providers → Email**: enabled; "Confirm email" on for prod; optional off for staging.
5. **Storage**: create private bucket `receipts`.
6. **Database → Extensions**: enable `pg_cron` (available on free tier) for retention job.

### 2.2 GitHub repository secrets

| Secret                                                        | Used by                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`                                       | CLI migrations (personal access token from Supabase account settings) |
| `STAGING_PROJECT_REF`, `PROD_PROJECT_REF`                     | `supabase link`                                                       |
| `STAGING_DB_PASSWORD`, `PROD_DB_PASSWORD`                     | migrations                                                            |
| `VITE_SUPABASE_URL_STAGING`, `VITE_SUPABASE_ANON_KEY_STAGING` | build                                                                 |
| `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD`       | build                                                                 |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`               | Pages deploy                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`                                   | Edge Function secret (set via `supabase secrets set`, not GitHub)     |

### 2.2a GitHub Pages site (free for public repositories)

1. Repository → Settings → Pages → Source: **GitHub Actions**.
2. Repository → Settings → Secrets and variables → Actions → Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public values from the Supabase API settings). Never add the service_role key.
3. Supabase → Authentication → URL Configuration:
   - Site URL: `https://<owner>.github.io/<repo>/`
   - Redirect URLs: add `https://<owner>.github.io/<repo>/login` and `https://<owner>.github.io/<repo>/**`
     Without this, the password-reset and sign-up email links are rejected.
4. Push to `main`. The site is at `https://<owner>.github.io/<repo>/`.

### 2.3 Cloudflare Pages project

1. Dashboard → Workers & Pages → Create → Pages → Connect to Git (optional; CI deploy is preferred).
2. Create project `my-vehicle-spend`. Build command: `npm run build`. Output: `dist`. Node version: 22.
3. Note the `*.pages.dev` URL. Use custom domain later (optional, paid domain).

## 3. Configuration files

### 3.1 `public/_headers` (Cloudflare Pages / Netlify-compatible)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), geolocation=(), microphone=()
  X-Frame-Options: DENY

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache
```

### 3.2 `public/_redirects` (SPA routing)

```
/*    /index.html   200
```

### 3.3 `vite.config.ts` (PWA essentials, abridged)

```ts
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // FR-PWA-06: user chooses to refresh
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'My Vehicle Spend',
        short_name: 'Vehicle Spend',
        description: 'Track car and bike expenses and loans in India',
        theme_color: '#0B6E4F',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        lang: 'en-IN',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
});
```

## 4. CI/CD pipeline

### 4.1 `.github/workflows/ci.yml` (on every push and pull request)

```yaml
name: CI
on:
  push:
    branches: [develop, main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }
```

### 4.2 `.github/workflows/db.yml` (migrations on main)

```yaml
name: Database
on:
  push:
    branches: [main]
    paths: ['supabase/migrations/**', 'supabase/seed.sql']
jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase link --project-ref ${{ secrets.PROD_PROJECT_REF }}
        env:
          {
            SUPABASE_ACCESS_TOKEN: '${{ secrets.SUPABASE_ACCESS_TOKEN }}',
            SUPABASE_DB_PASSWORD: '${{ secrets.PROD_DB_PASSWORD }}',
          }
      - run: supabase db push
        env:
          {
            SUPABASE_ACCESS_TOKEN: '${{ secrets.SUPABASE_ACCESS_TOKEN }}',
            SUPABASE_DB_PASSWORD: '${{ secrets.PROD_DB_PASSWORD }}',
          }
```

Staging migrations run the same way on `develop`, using staging secrets.

### 4.3 `.github/workflows/deploy.yml` (frontend)

- `main` push → checks (lint, typecheck, tests), build with `VITE_BASE_PATH=/<repo>/`, publish to **GitHub Pages**.
- A copy of `index.html` is saved as `404.html` so deep links work after a refresh.
- The Cloudflare Pages route described in §2.3 is an alternative. It needs `public/_headers` for the full security headers.

### 4.3a Known gap on GitHub Pages: response headers

GitHub Pages cannot set response headers. The build therefore adds the content security policy as a `<meta>` tag (`src/security/cspMeta.ts`, production builds only). These controls are **not** enforced on GitHub Pages:

- `frame-ancestors` / `X-Frame-Options` (clickjacking protection)
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`

Accept this for a free public demo, or host on Cloudflare Pages (§2.3) for the full set. The gap is recorded here so it is not forgotten at sign-off.

### 4.4 `.github/workflows/keep-alive.yml` (prevents free-tier pause)

```yaml
name: Keep Supabase alive
on:
  schedule:
    - cron: '0 3 */3 * *' # every 3 days at 03:00 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -o /dev/null -w "%{http_code}\n" \
            "${{ secrets.PROD_SUPABASE_URL }}/rest/v1/" \
            -H "apikey: ${{ secrets.PROD_ANON_KEY }}"
```

Ping staging similarly. Note: scheduled workflows on GitHub may be delayed or disabled after 60 days of repository inactivity.

## 5. Release procedure (per version)

| Step | Action                                                                              | Owner |
| ---- | ----------------------------------------------------------------------------------- | ----- |
| 1    | Merge feature branches into `develop`. CI green.                                    | Dev   |
| 2    | Deploy to staging (automatic). Run smoke tests (§6).                                | Dev   |
| 3    | Run System Tests (Test Strategy §6). Log defects.                                   | Dev   |
| 4    | UAT on staging with real phone. Sign UAT report.                                    | Owner |
| 5    | Update `CHANGELOG.md` and Release Notes. Bump version in `package.json`.            | Dev   |
| 6    | Merge `develop` → `main` (PR).                                                      | Dev   |
| 7    | Tag: `git tag -a v1.0.0 -m "My Vehicle Spend v1.0.0" && git push --tags`.           | Dev   |
| 8    | Migrations auto-applied to prod (`db.yml`). Verify in Supabase Studio → Migrations. | Dev   |
| 9    | Frontend deployed to production.                                                    | CI    |
| 10   | Post-release smoke test (§6). Monitor 48 h.                                         | Dev   |

### 5.1 Rollback

- **Frontend:** Cloudflare Pages → Deployments → choose last good → _Rollback to this deployment_. Takes under a minute.
- **Database:** migrations are forward-only. Write a new migration that reverses the change, reviewed and tested on staging first. Restore from backup only as a last resort (see Sysadmin Guide).

## 6. Smoke test checklist (run after each deploy, ~10 minutes)

- [ ] Home page loads over HTTPS; padlock valid.
- [ ] Sign in with test account works.
- [ ] Add one fuel entry; appears in list; dashboard total updates.
- [ ] Open a loan; schedule shows 60 rows (or configured tenure).
- [ ] Export CSV downloads and opens.
- [ ] App install prompt available (Chrome Lighthouse → PWA).
- [ ] Browser console shows no errors.
- [ ] `curl -I https://<prod-domain>` shows CSP and HSTS headers.

## 7. Database migration procedure (manual)

```bash
supabase link --project-ref <ref>
supabase db diff -f <migration_name>       # generate from local changes (optional)
supabase migration new <name>              # or write SQL by hand
supabase db reset                          # test locally
supabase db push --dry-run                 # preview on linked project
supabase db push                           # apply
```

## 8. Environment variable change

1. Update value in GitHub Secrets (and Cloudflare Pages env if used at runtime — note Vite values are baked at build time, so rebuild is required).
2. Re-run deploy workflow.

## 9. Custom domain (optional)

- Buy a `.in` or `.com` domain (paid, ~₹800–1,000/yr). Skip to stay on ₹0.
- Cloudflare Pages → Custom domains → add; DNS managed by Cloudflare.
- Update Supabase **Redirect URLs** and **Site URL** to the new domain.

## 10. Deployment checklist (sign-off)

- [ ] Staging matches prod migrations.
- [ ] `VITE_SUPABASE_URL` points to prod project (not staging) in prod build.
- [ ] Service role key absent from repo and bundle.
- [ ] Email templates customised with app name (Supabase → Auth → Templates).
- [ ] Rate limits and "Confirm email" set appropriately.
- [ ] Backup taken (JSON export of test data or `pg_dump`).
- [ ] Release notes published.
