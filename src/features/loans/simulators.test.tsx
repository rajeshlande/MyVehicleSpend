// T20 UI — prepayment simulator and foreclosure estimate (TC-LOAN-07, TC-LOAN-08, TC-LOAN-09; FR-LOAN-06, FR-LOAN-07).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoanSimulators } from './LoanSimulators';

// Position after 14 of 60 EMIs on ₹8,00,000 at 9.25% (EMI ₹16,703.92).
const POS = {
  outstanding: 644854.2,
  emi: 16703.92,
  annualRatePct: 9.25,
  remainingMonths: 46,
  accrualFrom: '2026-10-05',
};

describe('LoanSimulators — prepayment (TC-LOAN-07, TC-LOAN-08)', () => {
  it('reduce tenure: ₹1,00,000 leaves the EMI unchanged and cuts the months to 38', async () => {
    const user = userEvent.setup();
    render(<LoanSimulators {...POS} />);
    await user.type(screen.getByLabelText('Prepayment amount (₹)'), '100000');
    const result = screen.getByRole('region', { name: 'Prepayment result' });
    expect(result).toHaveTextContent('Months remaining: 38 (was 46)');
    expect(result).toHaveTextContent('EMI: ₹16,703.92 (unchanged)');
    expect(result).toHaveTextContent(/Interest saved ₹/);
  });

  it('reduce EMI: the same prepayment keeps 46 months and gives an EMI of ₹14,113.58', async () => {
    const user = userEvent.setup();
    render(<LoanSimulators {...POS} />);
    await user.click(screen.getByLabelText('Reduce EMI (keep tenure)'));
    await user.type(screen.getByLabelText('Prepayment amount (₹)'), '100000');
    const result = screen.getByRole('region', { name: 'Prepayment result' });
    expect(result).toHaveTextContent('Months remaining: 46 (was 46)');
    expect(result).toHaveTextContent('EMI: ₹14,113.58 (was ₹16,703.92)');
  });

  it('shows a plain message when the prepayment is more than the balance', async () => {
    const user = userEvent.setup();
    render(<LoanSimulators {...POS} />);
    await user.type(screen.getByLabelText('Prepayment amount (₹)'), '999999999');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /more than the outstanding balance/i
    );
  });
});

describe('LoanSimulators — foreclosure (TC-LOAN-09)', () => {
  it('adds the charge percentage to the balance', async () => {
    const user = userEvent.setup();
    render(<LoanSimulators {...POS} outstanding={500000} remainingMonths={36} />);
    await user.clear(screen.getByLabelText('Foreclosure charge (%)'));
    await user.type(screen.getByLabelText('Foreclosure charge (%)'), '4');
    // Set the date to the accrual start so no interest has built up: total = 500,000 + 4%.
    fireEvent.change(screen.getByLabelText('Foreclosure date'), {
      target: { value: '2026-10-05' },
    });
    const result = screen.getByRole('region', { name: 'Foreclosure estimate' });
    expect(result).toHaveTextContent('Charge ₹20,000.00');
    expect(result).toHaveTextContent('Total payable ₹5,20,000.00');
  });

  it('adds accrued interest from the last instalment to the chosen date', async () => {
    const user = userEvent.setup();
    render(<LoanSimulators {...POS} outstanding={500000} remainingMonths={36} />);
    await user.clear(screen.getByLabelText('Foreclosure charge (%)'));
    await user.type(screen.getByLabelText('Foreclosure charge (%)'), '4');
    fireEvent.change(screen.getByLabelText('Foreclosure date'), {
      target: { value: '2026-11-04' },
    });
    const result = screen.getByRole('region', { name: 'Foreclosure estimate' });
    expect(result).toHaveTextContent(/Interest to that date \(estimate\) ₹/);
    expect(result).toHaveTextContent(/Total payable ₹5,2\d,\d{3}\.\d{2}/);
  });
});
