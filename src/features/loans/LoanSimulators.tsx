import { useState } from 'react';
import { simulatePrepayment, foreclosureEstimate } from '../../core/loans/simulate';
import { formatINR, parseMoneyInput } from '../../core/money/money';
import { todayIST } from '../../core/dates/dates';

interface Props {
  /** Balance owed now, from the schedule after the instalments paid so far. */
  outstanding: number;
  emi: number;
  /** Reducing-equivalent annual rate used for the schedule (flat loans use their equivalent rate). */
  annualRatePct: number;
  remainingMonths: number;
  /** Date interest starts to accrue from: the last paid instalment's due date, or the loan start date. */
  accrualFrom: string;
}

/** Whole days from one ISO date to another (UTC arithmetic, so no timezone drift). */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Prepayment simulator and foreclosure estimate (FR-LOAN-06, FR-LOAN-07). Nothing is saved. */
export function LoanSimulators({
  outstanding,
  emi,
  annualRatePct,
  remainingMonths,
  accrualFrom,
}: Props) {
  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState<'tenure' | 'emi'>('tenure');
  const [fcDate, setFcDate] = useState(todayIST());
  const [chargeText, setChargeText] = useState('0');

  const amount = parseMoneyInput(amountText);
  const prepay =
    amountText.trim() === ''
      ? null
      : simulatePrepayment({
          outstanding,
          emi,
          annualRatePct,
          remainingMonths,
          amount: amount ?? Number.NaN,
          mode,
        });

  const charge = parseMoneyInput(chargeText);
  const days = daysBetween(accrualFrom, fcDate);
  const foreclosure =
    charge === null
      ? null
      : foreclosureEstimate({ outstanding, annualRatePct, chargePct: charge, days });

  return (
    <section aria-label="Loan simulators" className="loan-simulators">
      <h2>Simulate a prepayment</h2>
      <div className="field">
        <label htmlFor="prepay-amount">Prepayment amount (₹)</label>
        <input
          id="prepay-amount"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
      </div>
      <fieldset className="field">
        <legend>What should change</legend>
        <label>
          <input
            type="radio"
            name="prepay-mode"
            checked={mode === 'tenure'}
            onChange={() => setMode('tenure')}
          />{' '}
          Reduce tenure (keep EMI)
        </label>
        <label>
          <input
            type="radio"
            name="prepay-mode"
            checked={mode === 'emi'}
            onChange={() => setMode('emi')}
          />{' '}
          Reduce EMI (keep tenure)
        </label>
      </fieldset>

      {prepay && !prepay.ok && (
        <p role="alert" className="field-error">
          {prepay.error}
        </p>
      )}
      {prepay && prepay.ok && (
        <section aria-label="Prepayment result" className="mileage-summary">
          <p>New balance: {formatINR(prepay.newOutstanding)}</p>
          <p>
            Months remaining: {prepay.newMonths} (was {remainingMonths})
          </p>
          <p>
            EMI:{' '}
            {prepay.newEmi === emi
              ? `${formatINR(prepay.newEmi)} (unchanged)`
              : `${formatINR(prepay.newEmi)} (was ${formatINR(emi)})`}
          </p>
          <p>Interest saved {formatINR(prepay.interestSaved)}</p>
        </section>
      )}

      <h2>Foreclosure estimate</h2>
      <div className="field">
        <label htmlFor="fc-date">Foreclosure date</label>
        <input
          id="fc-date"
          type="date"
          value={fcDate}
          onChange={(e) => setFcDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="fc-charge">Foreclosure charge (%)</label>
        <input
          id="fc-charge"
          inputMode="decimal"
          value={chargeText}
          onChange={(e) => setChargeText(e.target.value)}
          aria-describedby="fc-charge-hint"
        />
        <p id="fc-charge-hint" className="field-hint">
          Check the charge in your loan agreement.
        </p>
      </div>

      {foreclosure ? (
        <section aria-label="Foreclosure estimate" className="mileage-summary">
          <p>Balance {formatINR(outstanding)}</p>
          <p>Charge {formatINR(foreclosure.charge)}</p>
          <p>Interest to that date (estimate) {formatINR(foreclosure.accruedInterest)}</p>
          <p>Total payable {formatINR(foreclosure.total)}</p>
        </section>
      ) : (
        <p role="alert" className="field-error">
          Enter the charge as a number, for example 4.
        </p>
      )}
    </section>
  );
}
