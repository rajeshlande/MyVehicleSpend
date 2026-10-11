# Source Code / In-Code Documentation Guide — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 (Draft) |
| Date | 2026-10-11 |

## 1. Purpose
Explain how code is documented so that a future maintainer can understand intent, inputs/outputs and algorithms without reading the whole codebase.

## 2. What to document (and what not to)

| Document | Yes | No |
|---|---|---|
| **Why** a non-obvious decision was made | ✔ | |
| Algorithms (EMI, mileage) with formula | ✔ | |
| Public functions and exported types | ✔ | |
| Business rules with rule ID (e.g. `RULE-04`) | ✔ | |
| Obvious code (`i++ // increment i`) | | ✘ |
| Commented-out code | | ✘ (delete it; Git keeps history) |
| Secrets, keys, personal data | | ✘ |

## 3. Comment types

### 3.1 File header (one per module file)
```ts
/**
 * @module core/loan/emi
 * Pure functions for Indian vehicle-loan EMI calculation.
 * Implements SRS FR-LOAN-02 and FR-LOAN-04. No React or network imports.
 */
```

### 3.2 Function docstring (TSDoc)
```ts
/**
 * Computes the equated monthly instalment for a reducing-balance loan.
 *
 * Formula: EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1), r = annualRate / 12 / 100.
 *
 * @param principal - Loan amount in rupees, > 0.
 * @param annualRatePct - Annual interest rate in percent, e.g. 9.25 for 9.25%.
 * @param tenureMonths - Number of monthly instalments, integer 1–360.
 * @returns EMI rounded to 2 decimal places (rupees).
 * @throws {RangeError} If inputs are outside the allowed range.
 * @example
 * emiReducing(800000, 9.25, 60) // 16,703.92
 * @see SRS FR-LOAN-02, BRD RULE-04
 */
export function emiReducing(principal: number, annualRatePct: number, tenureMonths: number): number { /* … */ }
```

### 3.3 Inline comment
Explain *why*, referencing the requirement when relevant:
```ts
// Last instalment absorbs rounding difference so balance reaches exactly 0 (FR-LOAN-03).
const principal = k === n ? balance : round2(emi - interest);
```

### 3.4 Component docs
```tsx
/**
 * Money amount input in Indian format.
 * - Accepts "1,23,456.5" or "123456.5"
 * - Emits a number with max 2 decimals
 * Used in: expense form, fuel form, loan form (FR-EXP-01, FR-FUEL-01, FR-LOAN-01)
 */
```

### 3.5 SQL comments
Use `comment on` in migrations so the database documents itself:
```sql
comment on table public.loan_payments is 'Scheduled and actual EMI rows. One per installment. FR-LOAN-03/05.';
comment on column public.expenses.gst_amount is 'GST component included in amount (RULE-05).';
```

### 3.6 TODO / FIXME format
```
// TODO(owner, 2026-11-01, FR-PWA-04): replace with background sync when iOS supports it.
// FIXME(bug DTL-007): rounding drift on flat-rate loans above 60 months.
```
Every TODO must include an owner, a date, and a requirement or defect ID. CI flags TODOs without these fields (ESLint rule `no-warning-comments` configured with pattern).

## 4. Documenting algorithms
Each algorithm module must include:
1. The formula in plain text or LaTeX-style (`$...$` is not rendered; use plain text).
2. Assumptions and edge cases (zero rate, zero tenure, partial last month).
3. A worked example with numbers that a human can check on a calculator.
4. Link to the test file that verifies it.

## 5. Generated reference documentation
- `typedoc` (Apache-2.0) can generate HTML API reference from TSDoc.
- Command: `npm run docs:api` → output to `docs/generated/api/` (git-ignored, regenerated in CI, published as artifact).

## 6. Review checklist (documentation part of code review)
- [ ] Every exported function has a TSDoc block.
- [ ] Each algorithm has a worked example.
- [ ] No commented-out code.
- [ ] TODOs follow the format.
- [ ] Changes that alter behaviour are reflected in SRS / API docs.
- [ ] Database changes have `comment on` statements.

## 7. Keeping docs current
When code and docs disagree, the code is the truth for behaviour and the docs must be updated in the same pull request.
