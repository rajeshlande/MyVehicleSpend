# System Administrator Guide — My Vehicle Spend

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| Version  | 1.0 (Draft)                                            |
| Date     | 2026-10-11                                             |
| Audience | Owner acting as system administrator (single operator) |

## 1. Responsibilities

| Area         | Task                                                  | Frequency              |
| ------------ | ----------------------------------------------------- | ---------------------- |
| Availability | Keep-alive job running; project not paused            | Continuous (automated) |
| Backups      | Database backup and JSON export check                 | Monthly                |
| Security     | Rotate keys, review Auth logs, dependency updates     | Monthly / on alert     |
| Quotas       | Check free-tier usage                                 | Monthly                |
| Access       | Review Supabase team members and GitHub collaborators | Quarterly              |
| Incidents    | Respond to outages or data concerns                   | As needed              |

## 2. Accounts & access inventory

| System             | Account owner | Access method   | MFA          |
| ------------------ | ------------- | --------------- | ------------ |
| GitHub             | Owner         | Web + SSH / PAT | **Required** |
| Supabase (staging) | Owner         | Web dashboard   | **Required** |
| Supabase (prod)    | Owner         | Web dashboard   | **Required** |
| Cloudflare Pages   | Owner         | Web dashboard   | **Required** |
| Password manager   | Owner         | App             | Required     |

Store all secrets in the password manager. Keep a list of which secret is used where (Deployment Guide §2.2).

## 3. Supabase free-tier management

### 3.1 Limits to monitor (verify current values at supabase.com/pricing)

| Resource                    | Typical free limit | Alert when |
| --------------------------- | ------------------ | ---------- |
| Database size               | 500 MB             | > 400 MB   |
| File storage                | 1 GB               | > 800 MB   |
| Egress / bandwidth          | ~5 GB / month      | > 4 GB     |
| Monthly active users (auth) | 50,000             | > 40,000   |
| Edge Function invocations   | Free quota         | > 80%      |

**Where:** Supabase Dashboard → Project → **Reports** / **Settings → Usage**.

### 3.2 Project pause prevention

- Free projects **pause after 7 days** of no activity.
- The keep-alive GitHub Action pings every 3 days (Deployment Guide §4.4).
- Check monthly that the workflow is still enabled: **GitHub → Actions → Keep Supabase alive**.
- If the repo is inactive for 60 days, GitHub may disable scheduled workflows — re-enable manually.

### 3.3 Restoring a paused project

1. Log in to supabase.com → open project → click **Restore project**.
2. Wait several minutes for status _Active_.
3. Run the smoke test checklist (Deployment Guide §6).

## 4. Backups

### 4.1 Application-level (for the user)

- Each user exports JSON from **Settings → Backup**. Encourage monthly.

### 4.2 Database-level (for the operator)

Free tier does not include daily automated backups with point-in-time recovery; use a logical backup you control.

**Monthly logical backup (run from a laptop):**

```bash
# Get the connection string from Supabase → Project Settings → Database (use the pooler, session mode)
export PGPASSWORD='<db-password>'
pg_dump "postgresql://postgres.<ref>:$PGPASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -Fc -f backups/mvs-$(date +%F).dump
```

- Store the dump **encrypted** (e.g. 7-Zip with AES-256 or `gpg -c`) on a personal drive or a private cloud folder.
- Keep the last 3 backups. Delete older ones.
- Test a restore quarterly (below).

Do **not** commit dump files to Git (`backups/` is in `.gitignore`).

### 4.3 Restore test (quarterly)

1. Create a new empty local Supabase (`supabase start`) or a scratch project.
2. `pg_restore --no-owner -d <target> backups/mvs-<date>.dump`
3. Count rows in `expenses`, `fuel_logs`, `loans`; compare with production.
4. Record the result in the sysadmin log.

## 5. Key & secret rotation

| Secret                      | Rotate when                   | How                                                                                                                     |
| --------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Database password           | Every 6 months or if leaked   | Supabase → Settings → Database → Reset password; update GitHub secret                                                   |
| Anon key                    | Only if leaked (it is public) | Supabase → API Settings → regenerate; redeploy frontend                                                                 |
| Service role key            | Every 6 months or if leaked   | Supabase → API Settings → regenerate; update Edge Function secret: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` |
| Supabase access token (CLI) | Yearly                        | Account → Access tokens                                                                                                 |
| Cloudflare API token        | Yearly                        | Cloudflare → API tokens                                                                                                 |

After any rotation, run the smoke test.

## 6. Security configuration

### 6.1 Auth settings (Supabase → Authentication)

| Setting                    | Recommended value                    |
| -------------------------- | ------------------------------------ |
| Email confirmations        | On (prod)                            |
| Minimum password length    | 8 (or 10 for extra safety)           |
| Password requirements      | Lowercase + digit                    |
| Leaked password protection | Enable if available on your plan     |
| JWT expiry                 | 3600 s (default)                     |
| Refresh token rotation     | On                                   |
| Session timebox            | Not set (sessions persist)           |
| Site URL                   | Production URL only                  |
| Redirect URLs              | Explicit allow-list; no wildcard `*` |

### 6.2 Database

- RLS enabled on all `public` tables. Verify monthly: Supabase → Advisors → Security (or run `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;` — expect empty result).
- Do not grant `anon` any table privileges.
- Use `security invoker` views (already the design) so RLS applies.

### 6.3 Storage

- `receipts` bucket: **private**. Verify it is not public in Storage settings.
- Only signed URLs are used by the app.

### 6.4 Frontend

- Confirm CSP and HSTS headers after each deploy (`curl -I https://<domain>`).
- Dependabot alerts enabled on GitHub; review weekly.

## 7. Monitoring

| What       | Tool                                                  | Check                             |
| ---------- | ----------------------------------------------------- | --------------------------------- |
| Uptime     | UptimeRobot free (50 monitors) or GitHub Action       | Every 5 min to `https://<domain>` |
| API health | Same monitor on `/rest/v1/` (expects 200 with apikey) | Every 5 min                       |
| Errors     | Supabase Logs Explorer (API, Auth)                    | Weekly skim                       |
| Usage      | Supabase Reports                                      | Monthly                           |
| CI         | GitHub Actions tab                                    | After each push                   |

## 8. Incident response

| Severity | Example                             | Response time (personal project target) | Steps                                                                                |
| -------- | ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| SEV-1    | Data leak, service-role key exposed | Within 2 hours                          | Rotate keys; disable affected sign-ups; investigate Auth logs; notify affected users |
| SEV-2    | App down, cannot sign in            | Within 24 hours                         | Check Supabase status page; check project status; roll back frontend                 |
| SEV-3    | Feature bug                         | Next release                            | Log DTL, fix on branch                                                               |

### 8.1 Incident runbook: app down

1. Open the production URL. If it loads but login fails → check Supabase project status.
2. If project **Paused** → restore (§3.3).
3. If frontend 5xx → Cloudflare Pages → roll back to last good deployment.
4. Record start time, cause, and fix in the incident log.

### 8.2 Incident runbook: suspected data exposure

1. Revoke suspicious sessions: Auth → Users → select user → _Sign out_ / ban.
2. Rotate the anon key if the key is suspected of misuse (update frontend).
3. Review RLS policies and run RLS test suite (STC-SEC).
4. If personal data of users was exposed, inform affected users promptly. Under India's Digital Personal Data Protection Act, 2023, a personal data breach should be reported to the Data Protection Board and affected individuals as required. Seek legal advice.

## 9. Maintenance calendar

| When           | Task                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| Weekly         | Check GitHub Dependabot alerts; check uptime monitor history                  |
| Monthly        | Logical backup; quota check; `npm outdated` review; check keep-alive ran      |
| Quarterly      | Restore test; access review; RLS audit; dependency major upgrades (on branch) |
| Every 6 months | Rotate DB password and service role key                                       |
| Yearly         | Rotate API tokens; review Supabase and hosting free-tier terms                |

## 10. Dependency updates

```bash
npm outdated
npm audit --omit=dev
npm update                  # minor/patch within semver
```

Major upgrades are done on a `chore/*` branch and tested with the full STC suite.

## 11. Data protection & retention

- Personal data held: email, password hash (managed by Supabase), vehicle and financial records, receipts.
- Retention: active data until user deletes it; soft-deleted rows purged after 30 days (pg_cron job `purge_soft_deleted`).
- Verify the purge job in Supabase → Integrations → Cron (or the `cron.job` table).

## 12. Contacts & references

| Resource                           | Link                                    |
| ---------------------------------- | --------------------------------------- |
| Supabase status                    | https://status.supabase.com             |
| Supabase docs                      | https://supabase.com/docs               |
| Cloudflare Pages docs              | https://developers.cloudflare.com/pages |
| GitHub Actions docs                | https://docs.github.com/actions         |
| CERT-In (India) incident reporting | https://www.cert-in.org.in              |

## 13. Sysadmin log template

| Date       | Action                     | Result   | By    |
| ---------- | -------------------------- | -------- | ----- |
| 2026-10-11 | Documentation v1.0 drafted | Complete | Owner |
