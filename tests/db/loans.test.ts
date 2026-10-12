// @vitest-environment node
// T18 — create_loan RPC and close loan (FR-LOAN-01, FR-LOAN-03, FR-LOAN-11). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';
import { planLoan } from '../../src/core/loans/plan';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let bobCar: string;

/** Schedule rows in the shape create_loan expects, with due dates one month apart from the start. */
function scheduleJson(
  startDate: string,
  rows: ReturnType<typeof planLoan> extends infer P
    ? P extends { rows: infer R }
      ? R
      : never
    : never
) {
  const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
  return JSON.stringify(
    rows.map((r, i) => {
      const due = new Date(Date.UTC(y!, m! - 1 + i, d!)).toISOString().slice(0, 10);
      return {
        installment_no: r.no,
        due_date: due,
        scheduled_emi: r.emi,
        principal_component: r.principal,
        interest_component: r.interest,
        opening_balance: Math.round((r.balance + r.principal) * 100) / 100,
        closing_balance: r.balance,
      };
    })
  );
}

const PLAN = planLoan({ principal: 800000, annualRatePct: 9.25, months: 60, method: 'reducing' });
if (!PLAN.ok) throw new Error('fixture plan failed');
const ROWS = PLAN.rows;
const START = '2026-11-05';

function args(
  over: Partial<{ id: string; schedule: string; principal: number; tenure: number }> = {}
) {
  return [
    over.id ?? crypto.randomUUID(),
    car,
    'HDFC Bank',
    '4321',
    over.principal ?? 800000,
    9.25,
    over.tenure ?? 60,
    START,
    16703.92,
    'reducing',
    0,
    0,
    over.schedule ?? scheduleJson(START, ROWS),
  ];
}

const createLoan = (uid: string, a: unknown[]) =>
  asUser(db, uid, () =>
    db.query<{ id: string; status: string; tenure_months: number }>(
      `select * from public.create_loan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      a
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@l.local');
  bob = await createUser(db, 'bob@l.local');
  car = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00LOAN0001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
  bobCar = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00LOAN0002','petrol') returning id`,
      [bob]
    )
  ).rows[0]!.id;
});

describe('create_loan (FR-LOAN-01, FR-LOAN-03)', () => {
  it('stores the loan and exactly 60 schedule rows, in one call', async () => {
    const id = crypto.randomUUID();
    const [loan] = (await createLoan(alice, args({ id }))).rows;
    expect(loan?.id).toBe(id);
    expect(loan?.status).toBe('active');
    const n = await db.query<{ n: string; s: string; last: string }>(
      `select count(*) n, sum(principal_component) s,
              (select closing_balance from public.loan_payments where loan_id=$1 order by installment_no desc limit 1) last
         from public.loan_payments where loan_id = $1`,
      [id]
    );
    expect(Number(n.rows[0]!.n)).toBe(60);
    expect(Number(n.rows[0]!.s)).toBe(800000);
    expect(Number(n.rows[0]!.last)).toBe(0);
  });

  it('is idempotent: a retry with the same client id creates nothing new', async () => {
    const id = crypto.randomUUID();
    await createLoan(alice, args({ id }));
    await createLoan(alice, args({ id }));
    const c = await db.query<{ n: string }>(
      `select count(*) n from public.loan_payments where loan_id = $1`,
      [id]
    );
    expect(Number(c.rows[0]!.n)).toBe(60);
  });

  it('rejects a schedule whose row count does not match the tenure, and writes nothing', async () => {
    const id = crypto.randomUUID();
    await expect(createLoan(alice, args({ id, tenure: 48 }))).rejects.toThrow(
      /rows but the tenure/
    );
    const c = await db.query<{ n: string }>(`select count(*) n from public.loans where id = $1`, [
      id,
    ]);
    expect(Number(c.rows[0]!.n)).toBe(0);
  });

  it('rejects a schedule whose principal does not add up to the loan amount', async () => {
    await expect(createLoan(alice, args({ principal: 900000 }))).rejects.toThrow(
      /principal does not add up/
    );
  });

  it('rejects a schedule that does not clear the balance by the final instalment', async () => {
    const bad = ROWS.map((r, i) => (i === 59 ? { ...r, balance: 500 } : r));
    await expect(createLoan(alice, args({ schedule: scheduleJson(START, bad) }))).rejects.toThrow(
      /does not clear the loan/
    );
  });

  it('cannot attach a loan to another user’s vehicle', async () => {
    const a = args();
    a[1] = bobCar; // alice tries to use bob's vehicle
    await expect(createLoan(alice, a)).rejects.toThrow();
  });
});

describe('loan visibility and close (FR-LOAN-11)', () => {
  let loanId: string;

  beforeAll(async () => {
    loanId = crypto.randomUUID();
    await createLoan(alice, args({ id: loanId }));
  });

  it('another user cannot read the loan or its schedule', async () => {
    const seen = await asUser(db, bob, () =>
      db.query<{ n: string }>(`select count(*) n from public.loans where id = $1`, [loanId])
    );
    const rows = await asUser(db, bob, () =>
      db.query<{ n: string }>(`select count(*) n from public.loan_payments where loan_id = $1`, [
        loanId,
      ])
    );
    expect(Number(seen.rows[0]!.n)).toBe(0);
    expect(Number(rows.rows[0]!.n)).toBe(0);
  });

  it('closing a loan sets status and closed_on, keeps the schedule, and the loan stays viewable', async () => {
    await asUser(db, alice, () =>
      db.query(
        `update public.loans set status = 'closed', closed_on = '2026-10-12' where id = $1`,
        [loanId]
      )
    );
    const r = await asUser(db, alice, () =>
      db.query<{ status: string; closed_on: string; n: string }>(
        `select l.status, l.closed_on::text, (select count(*) from public.loan_payments p where p.loan_id = l.id) n
           from public.loans l where l.id = $1`,
        [loanId]
      )
    );
    expect(r.rows[0]).toEqual({ status: 'closed', closed_on: '2026-10-12', n: expect.anything() });
    expect(Number(r.rows[0]!.n)).toBe(60);
  });
});
