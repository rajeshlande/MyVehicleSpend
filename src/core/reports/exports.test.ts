import { describe, it, expect } from 'vitest';
import { expensesCsv, fuelCsv, loanScheduleCsv } from './exports';

const FY = { from: '2026-04-01', to: '2027-03-31' };
const UTF8_BOM = '\uFEFF';

describe('expenses CSV (TC-RPT-03: columns correct, amounts numeric, BOM)', () => {
  const csv = expensesCsv(
    [
      {
        expenseDate: '2026-06-02',
        categoryGroup: 'Fuel',
        categoryName: 'Petrol',
        vendor: 'मुंबई पेट्रोल पंप',
        amount: 1250.5,
        gstAmount: 0,
        paymentMode: 'upi',
        odometerKm: 48600,
        notes: 'full, tank',
        source: 'manual',
      },
      // outside the FY, must be excluded
      {
        expenseDate: '2026-03-01',
        categoryGroup: 'Fuel',
        categoryName: 'Petrol',
        amount: 9,
        gstAmount: 0,
        paymentMode: 'cash',
        source: 'manual',
      },
    ],
    FY
  );

  it('starts with the BOM and has the header row', () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'Date,Category group,Category,Vendor,Amount (INR),GST (INR),Payment mode,Odometer (km),Notes,Source'
    );
  });

  it('writes amounts as plain numbers and keeps Hindi/Marathi vendor names', () => {
    expect(csv).toContain(
      '2026-06-02,Fuel,Petrol,मुंबई पेट्रोल पंप,1250.50,0.00,upi,48600,"full, tank",manual'
    );
  });

  it('excludes rows outside the period', () => {
    expect(csv).not.toContain('2026-03-01');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
  });
});

describe('fuel CSV', () => {
  it('writes litres, price and full-tank flag', () => {
    const csv = fuelCsv(
      [
        {
          filledOn: '2026-07-01',
          odometerKm: 48600,
          litres: 30,
          pricePerUnit: 105.4,
          totalAmount: 3162,
          isFullTank: true,
          station: 'HPCL',
        },
      ],
      FY
    );
    expect(csv.slice(1).split('\r\n')[1]).toBe('2026-07-01,48600,30.000,,105.40,3162.00,Yes,HPCL,');
  });
});

describe('loan schedule CSV', () => {
  it('writes every instalment in order, with paid details where present', () => {
    const csv = loanScheduleCsv([
      {
        installmentNo: 2,
        dueDate: '2026-02-05',
        scheduledEmi: 8500,
        principalComponent: 6000,
        interestComponent: 2500,
        openingBalance: 94000,
        closingBalance: 88000,
        status: 'scheduled',
        lateFee: 0,
        bounceCharge: 0,
      },
      {
        installmentNo: 1,
        dueDate: '2026-01-05',
        scheduledEmi: 8500,
        principalComponent: 6000,
        interestComponent: 2500,
        openingBalance: 100000,
        closingBalance: 94000,
        status: 'paid',
        paidOn: '2026-01-06',
        paidAmount: 8600,
        lateFee: 100,
        bounceCharge: 0,
      },
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]?.startsWith('1,2026-01-05,8500.00')).toBe(true);
    expect(lines[1]).toContain(',paid,2026-01-06,8600.00,100.00,0.00');
    expect(lines[2]?.startsWith('2,2026-02-05')).toBe(true);
    expect(lines[2]).toContain(',scheduled,,,0.00,0.00');
  });
});
