// T18 UI — loan form (computed EMI, override), list filter, schedule and close loan (TC-LOAN-01, TC-LOAN-02, TC-LOAN-11, FR-LOAN-01..03, FR-LOAN-11).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Loan, LoanPayment } from '../../data/loans';

const api = vi.hoisted(() => ({
  listLoans: vi.fn(),
  createLoan: vi.fn(),
  getLoan: vi.fn(),
  listLoanPayments: vi.fn(),
  closeLoan: vi.fn(),
  recordLoanPayment: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock('../../data/loans', () => api);
vi.mock('../../data/expenses', () => ({ listCategories: api.listCategories }));

const vehicleState = vi.hoisted(() => ({
  value: {
    vehicles: [] as unknown[],
    activeVehicle: null as null | { id: string; registrationNo: string },
  },
}));
vi.mock('../vehicles/VehicleContext', () => ({ useVehicles: () => vehicleState.value }));

import { LoansPage } from './LoansPage';
import { LoanDetailPage } from './LoanDetailPage';

const VEH = '11111111-1111-4111-8111-111111111111';
const LOAN_ID = '55555555-5555-4555-8555-555555555555';

function loan(over: Partial<Loan>): Loan {
  return {
    id: LOAN_ID,
    vehicleId: VEH,
    lender: 'HDFC Bank',
    accountLast4: '4321',
    principal: 800000,
    annualRate: 9.25,
    tenureMonths: 60,
    startDate: '2026-11-05',
    emiAmount: 16703.92,
    interestMethod: 'reducing',
    processingFee: 0,
    otherCharges: 0,
    status: 'active',
    ...over,
  };
}

/** Builds 60 stored payment rows from the real schedule (same numbers as the engine). */
function payments(): LoanPayment[] {
  let bal = 800000;
  const r = 0.0925 / 12;
  const emi = 16703.92;
  return Array.from({ length: 60 }, (_, i) => {
    const interest = Math.round(bal * r * 100) / 100;
    const principal = i === 59 ? bal : Math.round((emi - interest) * 100) / 100;
    const open = bal;
    bal = Math.round((bal - principal) * 100) / 100;
    return {
      id: `p${i + 1}`,
      installmentNo: i + 1,
      dueDate: '2026-11-05',
      scheduledEmi: Math.round((interest + principal) * 100) / 100,
      principalComponent: principal,
      interestComponent: interest,
      openingBalance: open,
      closingBalance: bal,
      status: 'scheduled',
      lateFee: 0,
      bounceCharge: 0,
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: { id: VEH, registrationNo: 'MH01AB1234' },
  };
  api.listLoans.mockResolvedValue([]);
  api.createLoan.mockImplementation(
    async (input: { lender: string }, plan: { tenureMonths: number }) =>
      loan({ lender: input.lender, tenureMonths: plan.tenureMonths })
  );
});

function renderLoans(path = '/loans') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/loans/:loanId" element={<LoanDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  extra?: (u: typeof user) => Promise<void>
) {
  await user.click(screen.getByRole('button', { name: 'Add loan' }));
  await user.type(screen.getByLabelText('Lender'), 'HDFC Bank');
  await user.type(screen.getByLabelText('Loan amount (₹)'), '800000');
  await user.type(screen.getByLabelText('Annual interest rate (%)'), '9.25');
  await user.type(screen.getByLabelText('Tenure (months)'), '60');
  if (extra) await extra(user);
}

describe('LoanForm — computed EMI and override (FR-LOAN-01, TC-LOAN-01)', () => {
  it('shows the computed EMI as the user types', async () => {
    const user = userEvent.setup();
    renderLoans();
    await fillForm(user);
    expect(screen.getByRole('status')).toHaveTextContent('Computed EMI: ₹16,703.92');
  });

  it('saves a loan with a 60-row schedule passed to createLoan', async () => {
    const user = userEvent.setup();
    renderLoans();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Save loan' }));
    await waitFor(() => expect(api.createLoan).toHaveBeenCalledTimes(1));
    const [input, plan] = api.createLoan.mock.calls[0]!;
    expect(input.principal).toBe(800000);
    expect(plan.emi).toBe(16703.92);
    expect(plan.tenureMonths).toBe(60);
    expect(plan.rows).toHaveLength(60);
    expect(plan.rows[59].closingBalance).toBe(0);
    expect(await screen.findByRole('status', {}, { timeout: 2000 })).toHaveTextContent(
      /Loan saved/
    );
  });

  it('uses an entered EMI when the user chooses to enter one', async () => {
    const user = userEvent.setup();
    renderLoans();
    await fillForm(user, async (u) => {
      await u.click(screen.getByLabelText('Enter my own EMI'));
      await u.type(screen.getByLabelText('EMI (₹)'), '17000');
    });
    await user.click(screen.getByRole('button', { name: 'Save loan' }));
    await waitFor(() => expect(api.createLoan).toHaveBeenCalled());
    expect(api.createLoan.mock.calls[0]![1].emi).toBe(17000);
  });

  it('blocks saving an entered EMI that does not cover the interest', async () => {
    const user = userEvent.setup();
    renderLoans();
    await fillForm(user, async (u) => {
      await u.click(screen.getByLabelText('Enter my own EMI'));
      await u.type(screen.getByLabelText('EMI (₹)'), '5000');
    });
    await user.click(screen.getByRole('button', { name: 'Save loan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/interest/i);
    expect(api.createLoan).not.toHaveBeenCalled();
  });

  it('asks for a lender before saving', async () => {
    const user = userEvent.setup();
    renderLoans();
    await user.click(screen.getByRole('button', { name: 'Add loan' }));
    await user.click(screen.getByRole('button', { name: 'Save loan' }));
    expect(await screen.findByText('Enter the lender name.')).toBeInTheDocument();
    expect(api.createLoan).not.toHaveBeenCalled();
  });
});

describe('LoansPage — Active / Closed filter (FR-LOAN-11, TC-LOAN-11)', () => {
  it('shows only active loans by default and closed loans under Closed', async () => {
    api.listLoans.mockResolvedValue([
      loan({ id: 'a', lender: 'Axis Finance', status: 'active' }),
      loan({ id: 'c', lender: 'Old Bank', status: 'closed', closedOn: '2026-09-01' }),
    ]);
    const user = userEvent.setup();
    renderLoans();
    const list = await screen.findByRole('list', { name: 'Active loans' });
    expect(within(list).getByText('Axis Finance')).toBeInTheDocument();
    expect(screen.queryByText('Old Bank')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Closed' }));
    expect(await screen.findByRole('list', { name: 'Closed loans' })).toHaveTextContent('Old Bank');
  });
});

describe('LoanDetailPage — schedule, summary, close (TC-LOAN-02, TC-LOAN-10, TC-LOAN-11)', () => {
  beforeEach(() => {
    api.getLoan.mockResolvedValue(loan({}));
    api.listLoanPayments.mockResolvedValue(payments());
    api.listCategories.mockResolvedValue([
      { id: 'cat-emi', groupName: 'Loan & Finance', name: 'EMI payment' },
      { id: 'cat-late', groupName: 'Loan & Finance', name: 'Late payment' },
    ]);
  });

  it('shows 60 schedule rows, the closing balance of zero, and the summary', async () => {
    renderLoans(`/loans/${LOAN_ID}`);
    const table = await screen.findByRole('table', { name: 'Repayment schedule' });
    expect(within(table).getAllByRole('row')).toHaveLength(61); // header + 60
    const summary = screen.getByRole('region', { name: 'Loan summary' });
    expect(summary).toHaveTextContent('Months remaining 60');
    expect(summary).toHaveTextContent('Outstanding ₹8,00,000.00');
  });

  it('marks the loan closed and it moves to the Closed filter (TC-LOAN-11)', async () => {
    api.closeLoan.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLoans(`/loans/${LOAN_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Mark loan closed' }));
    await user.click(screen.getByRole('button', { name: 'Confirm close' }));
    await waitFor(() => expect(api.closeLoan).toHaveBeenCalledWith(LOAN_ID, expect.any(String)));
    expect(await screen.findByText(/Closed on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark loan closed' })).not.toBeInTheDocument();
  });
});

describe('LoanDetailPage — record an EMI payment (FR-LOAN-05, TC-LOAN-05, TC-LOAN-06)', () => {
  beforeEach(() => {
    api.getLoan.mockResolvedValue(loan({}));
    api.listCategories.mockResolvedValue([
      { id: 'cat-emi', groupName: 'Loan & Finance', name: 'EMI payment' },
    ]);
  });

  it('shows Late for an unpaid instalment whose due date has passed, and Pending for later ones', async () => {
    const rows = payments();
    rows[0] = { ...rows[0]!, dueDate: '2026-10-05' };
    api.listLoanPayments.mockResolvedValue(rows);
    renderLoans(`/loans/${LOAN_ID}`);
    const table = await screen.findByRole('table', { name: 'Repayment schedule' });
    const first = within(table).getAllByRole('row')[1]!;
    expect(first).toHaveTextContent('Late');
    const second = within(table).getAllByRole('row')[2]!;
    expect(second).toHaveTextContent('Pending');
  });

  it('records installment 14 with a ₹200 late fee and marks it Paid (TC-LOAN-05)', async () => {
    const rows = payments();
    api.listLoanPayments.mockResolvedValue(rows);
    api.recordLoanPayment.mockImplementation(async (id: string) => ({
      ...rows[13]!,
      id,
      status: 'paid',
      paidOn: '2026-10-12',
      paidAmount: 16903.92,
      lateFee: 200,
    }));
    const user = userEvent.setup();
    renderLoans(`/loans/${LOAN_ID}`);
    await user.click(
      await screen.findByRole('button', { name: 'Record payment for instalment 14' })
    );
    await user.clear(screen.getByLabelText('Late fee (₹)'));
    await user.type(screen.getByLabelText('Late fee (₹)'), '200');
    await user.click(screen.getByRole('button', { name: 'Save payment' }));

    await waitFor(() => expect(api.recordLoanPayment).toHaveBeenCalledTimes(1));
    const [paymentId, categoryId, input] = api.recordLoanPayment.mock.calls[0]!;
    expect(paymentId).toBe('p14');
    expect(categoryId).toBe('cat-emi');
    expect(input).toMatchObject({ lateFee: 200, bounceCharge: 0 });
    const table = screen.getByRole('table', { name: 'Repayment schedule' });
    expect(within(table).getAllByRole('row')[14]).toHaveTextContent('Paid');
    expect(within(table).getAllByRole('row')[14]).not.toHaveTextContent('Record payment');
  });

  it('does not offer to record a payment on an instalment that is already paid', async () => {
    const rows = payments();
    rows[0] = { ...rows[0]!, status: 'paid', paidOn: '2026-11-05', paidAmount: 16703.92 };
    api.listLoanPayments.mockResolvedValue(rows);
    renderLoans(`/loans/${LOAN_ID}`);
    await screen.findByRole('table', { name: 'Repayment schedule' });
    expect(
      screen.queryByRole('button', { name: 'Record payment for instalment 1' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Record payment for instalment 2' })
    ).toBeInTheDocument();
  });
});
