# Coding Standards & Style Guide — My Vehicle Spend

| Field       | Value                                        |
| ----------- | -------------------------------------------- |
| Version     | 1.0 (Draft)                                  |
| Date        | 2026-10-11                                   |
| Enforced by | ESLint, Prettier, TypeScript strict mode, CI |

## 1. Language & tooling

| Area      | Standard                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------- |
| Language  | TypeScript 5.x, `"strict": true`, no `any` (use `unknown` and narrow)                               |
| Framework | React 18 function components and hooks only                                                         |
| Formatter | Prettier: 2-space indent, semicolons, single quotes, trailing commas `es5`, print width 100         |
| Linter    | ESLint flat config with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` |
| SQL       | Lower-case keywords optional; upper-case keywords preferred in migrations; `snake_case` identifiers |
| Commit    | Conventional Commits (see Onboarding §8)                                                            |

### 1.1 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

## 2. Naming conventions

| Element                       | Convention                          | Example                                |
| ----------------------------- | ----------------------------------- | -------------------------------------- |
| Files (components)            | PascalCase `.tsx`                   | `ExpenseForm.tsx`                      |
| Files (modules, hooks, utils) | kebab-case or camelCase `.ts`       | `emi.ts`, `useVehicles.ts`             |
| Folders                       | kebab-case                          | `loan-tracker/`                        |
| Components                    | PascalCase                          | `FuelLogCard`                          |
| Hooks                         | `use` + camelCase                   | `useActiveVehicle`                     |
| Functions & variables         | camelCase                           | `calculateMileage`                     |
| Constants                     | UPPER_SNAKE_CASE                    | `MAX_RECEIPT_BYTES`                    |
| Types & interfaces            | PascalCase, no `I` prefix           | `Vehicle`, `LoanSchedule`              |
| Enum-like unions              | string literal union types          | `type FuelType = 'petrol' \| 'diesel'` |
| Database tables/columns       | snake_case                          | `expense_categories.group_name`        |
| Boolean variables             | `is`, `has`, `can`, `should` prefix | `isFullTank`                           |
| Test files                    | same name + `.test.ts(x)`           | `emi.test.ts`                          |
| E2E tests                     | `.spec.ts` in `tests/e2e/`          | `add-fuel.spec.ts`                     |

## 3. Money & date rules (critical)

1. **Never use floating-point arithmetic for money in the UI decisions.** Use integer paise internally in `core/money`:
   ```ts
   const paise = Math.round(rupees * 100); // convert once at the boundary
   ```
   Or use `decimal.js` (MIT) for loan maths.
2. Round only at the final display or storage step, always with `round2` from `core/money`.
3. Dates are `YYYY-MM-DD` strings in data transfer. Use `Date` only inside `core/dates`.
4. Always interpret business dates in `Asia/Kolkata`.
5. Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` for money display — never hand-roll the lakh grouping.

## 4. React standards

- One component per file, default export is **not** used; use named exports.
- Props typed with an interface named `<Component>Props`.
- Keep components under 150 lines; extract hooks for logic.
- No business logic inside JSX — call functions from `core/`.
- Keys in lists must be stable IDs, never array index.
- Use `React.memo` only after profiling.
- Side effects only in `useEffect` or query hooks, never during render.
- `dangerouslySetInnerHTML` is forbidden (ESLint rule `react/no-danger`).

## 5. Error handling

- Never swallow errors: `catch (e) {}` is forbidden.
- Map Supabase errors through `mapDbError()` before showing to the user.
- Throw typed errors (`class DomainError extends Error { code }`) in `core/`.
- Log unexpected errors with context but never with tokens or personal data.

## 6. Security standards

- Never log `session`, `access_token`, `refresh_token`, or receipt URLs.
- Validate all external input with Zod at the boundary (forms, imports, URL params).
- Only the anon key is used in the client. Reject PRs that contain `service_role` or long JWTs with `"role":"service_role"`.
- Don't disable RLS in migrations. Any `security definer` function must set `search_path`.
- `npm audit --omit=dev` must have no high or critical vulnerabilities at release.

## 7. Testing standards

- Unit test every function in `core/`.
- Test names describe behaviour: `it('returns 0 interest when rate is 0')`.
- Arrange-Act-Assert structure.
- No real network calls in unit tests; mock the Supabase client.
- Use fixtures in `src/test/fixtures/` (e.g. a known 60-month loan).

## 8. Accessibility standards

- Every `<input>` has a `<label>` (visible or `aria-label`).
- Buttons have text or `aria-label`; icon-only buttons must have a tooltip and label.
- Do not rely on colour alone to show state; add text or icon.
- Min tap target 44 × 44 px.
- Run `eslint-plugin-jsx-a11y` in CI.

## 9. CSS standards

- Use CSS variables from the design tokens (UI/UX §6.1). No hard-coded hex colours in components.
- Mobile-first media queries: `@media (min-width: 768px)`.
- Class names: BEM-like `block__element--modifier` if using plain CSS, or Tailwind utility classes if chosen.

## 10. SQL standards

- Migrations are numbered `NNNN_description.sql` and never edited after merge.
- Every new table: `created_at`, `updated_at`, RLS enabled, policies added in the same migration.
- Foreign keys reference `(id, user_id)` composite where a user owns both rows.
- Add `comment on` for tables and non-obvious columns.

## 11. Code review standards

- Reviewer checks: correctness, requirement coverage, tests, security, readability, performance.
- Comments prefixed: `nit:` (optional), `question:`, `blocker:`.
- Author responds to every comment before merge.

## 12. Performance guidelines

- Lazy-load routes (`React.lazy`) for Reports and Loans.
- Keep Recharts imports named (tree-shaking).
- Use TanStack Query `staleTime` of 30 s for lists.
- Images: compress receipts to ≤ 1 MB, max 1600 px longest edge, WebP/JPEG.

## 13. Accepted exceptions

Exceptions are documented in the code with `// eslint-disable-next-line <rule> -- <reason, ticket>`. Blanket disables are not allowed.
