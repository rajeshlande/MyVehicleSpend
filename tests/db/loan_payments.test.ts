// @vitest-environment node
// T19 — record_loan_payment RPC (FR-LOAN-05, FR-LOAN-09; TC-LOAN-05, TC-LOAN-06). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';
import { planLoan, scheduleWithDates } from '../../src/core/loans/plan';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let emiCategory: string;
let loanId: string;
let p14: string; // installment 14 of the loan
const START = '2026-11-05';

function scheduleJson(): string {
  const p = planLoan({ principal: 800000, annualRatePct: 9.25, months: 60, method: 'reducing' });
  if (!p.ok) throw new Error('fixture');
  return JSON.stringify(
    scheduleWithDates(START, p.rows).map((r) => ({
      installment_no: r.no,
      due_date: r.dueDate,
      scheduled_emi: r.emi,
      principal_component: r.principal,
      interest_component: r.interest,
      opening_balance: r.openingBalance,
      closing_balance: r.closingBalance,
    }))
  );
}

const pay = (uid: string, args: unknown[]) =>
  asUser(db, uid, () =>
    db.query<{
      status: string;
      paid_amount: string;
      late_fee: string;
      expense_id: string;
      interest_component: string;
    }>(`select * from public.record_loan_payment($1,$2,$3,$4,$5,$6,$7)`, args)
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@p.local');
  bob = await createUser(db, 'bob@p.local');
  car = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00PAY00001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
  emiCategory = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where name = 'EMI payment'`
    )
  ).rows[0]!.id;
  loanId = crypto.randomUUID();
  await asUser(db, alice, () =>
    db.query(
      `select * from public.create_loan($1,$2,'HDFC Bank','4321',800000,9.25,60,$3,16703.92,'reducing',0,0,$4::jsonb)`,
      [loanId, car, START, scheduleJson()]
    )
  );
  p14 = (
    await db.query<{ id: string }>(
      `select id from public.loan_payments where loan_id = $1 and installment_no = 14`,
      [loanId]
    )
  ).rows[0]!.id;
});

describe('record_loan_payment (TC-LOAN-05)', () => {
  it('marks installment 14 paid and creates an EMI expense of EMI + late fee (₹16,903.92)', async () => {
    const [row] = (await pay(alice, [p14, emiCategory, '2026-10-12', 200, 0, 'upi', 'paid late']))
      .rows;
    expect(row?.status).toBe('paid');
    expect(Number(row?.paid_amount)).toBe(16903.92);
    expect(Number(row?.late_fee)).toBe(200);

    const exp = await db.query<{
      amount: string;
      source: string;
      category_id: string;
      vendor: string;
      expense_date: string;
      payment_mode: string;
    }>(
      `select amount, source, category_id, vendor, expense_date::text, payment_mode from public.expenses where id = $1`,
      [row!.expense_id]
    );
    expect(exp.rows[0]).toEqual({
      amount: '16903.92',
      source: 'loan',
      category_id: emiCategory,
      vendor: 'HDFC Bank',
      expense_date: '2026-10-12',
      payment_mode: 'upi',
    });
  });

  it('keeps the interest component stored separately on the schedule row (FR-LOAN-09)', async () => {
    const r = await db.query<{ interest_component: string; principal_component: string }>(
      `select interest_component, principal_component from public.loan_payments where id = $1`,
      [p14]
    );
    expect(Number(r.rows[0]!.interest_component)).toBeGreaterThan(0);
    expect(Number(r.rows[0]!.principal_component)).toBeGreaterThan(0);
  });

  it('includes a bounce charge in the expense amount', async () => {
    const id = (
      await db.query<{ id: string }>(
        `select id from public.loan_payments where loan_id=$1 and installment_no=15`,
        [loanId]
      )
    ).rows[0]!.id;
    const [row] = (await pay(alice, [id, emiCategory, '2026-10-12', 0, 500, 'upi', null])).rows;
    expect(Number(row?.paid_amount)).toBe(17203.92);
  });

  it('refuses to record the same instalment twice', async () => {
    await expect(pay(alice, [p14, emiCategory, '2026-10-12', 0, 0, 'upi', null])).rejects.toThrow(
      /already recorded/
    );
    const n = await db.query<{ n: string }>(
      `select count(*) n from public.expenses where source='loan' and vendor='HDFC Bank' and expense_date='2026-10-12' and amount = 16903.92`
    );
    expect(Number(n.rows[0]!.n)).toBe(1);
  });

  it('another user cannot record a payment on this loan', async () => {
    const id = (
      await db.query<{ id: string }>(
        `select id from public.loan_payments where loan_id=$1 and installment_no=16`,
        [loanId]
      )
    ).rows[0]!.id;
    await expect(pay(bob, [id, emiCategory, '2026-10-12', 0, 0, 'upi', null])).rejects.toThrow(
      /not found/
    );
    const r = await db.query<{ status: string }>(
      `select status from public.loan_payments where id = $1`,
      [id]
    );
    expect(r.rows[0]!.status).toBe('scheduled');
  });

  it('a failed expense insert rolls the payment back, so nothing is half-recorded', async () => {
    const id = (
      await db.query<{ id: string }>(
        `select id from public.loan_payments where loan_id=$1 and installment_no=17`,
        [loanId]
      )
    ).rows[0]!.id;
    await expect(
      pay(alice, [id, crypto.randomUUID(), '2026-10-12', 0, 0, 'upi', null])
    ).rejects.toThrow();
    const r = await db.query<{ status: string; expense_id: string | null }>(
      `select status, expense_id from public.loan_payments where id = $1`,
      [id]
    );
    expect(r.rows[0]).toEqual({ status: 'scheduled', expense_id: null });
  });

  it('rejects a payment dated more than a day in the future', async () => {
    const id = (
      await db.query<{ id: string }>(
        `select id from public.loan_payments where loan_id=$1 and installment_no=18`,
        [loanId]
      )
    ).rows[0]!.id;
    await expect(pay(alice, [id, emiCategory, '2099-01-01', 0, 0, 'upi', null])).rejects.toThrow(
      /future/
    );
  });
});
