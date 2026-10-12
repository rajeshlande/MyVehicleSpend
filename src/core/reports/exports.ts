/**
 * CSV builders for expenses, fuel logs and loan schedules (FR-RPT-04). Each returns the full file text,
 * with the UTF-8 BOM, ready to download.
 */
import { money, toCsv, withBom } from './csv';
import { inRange } from './monthly';
import type { DateRange } from './period';

export interface ExportExpense {
  expenseDate: string;
  categoryGroup: string;
  categoryName: string;
  vendor?: string;
  amount: number;
  gstAmount: number;
  paymentMode: string | null;
  odometerKm?: number;
  notes?: string;
  source: string;
}

export interface ExportFuel {
  filledOn: string;
  odometerKm: number;
  litres?: number;
  energyKwh?: number;
  pricePerUnit: number;
  totalAmount: number;
  isFullTank: boolean;
  station?: string;
  paymentMode?: string;
}

export interface ExportLoanRow {
  installmentNo: number;
  dueDate: string;
  scheduledEmi: number;
  principalComponent: number;
  interestComponent: number;
  openingBalance: number;
  closingBalance: number;
  status: string;
  paidOn?: string;
  paidAmount?: number;
  lateFee: number;
  bounceCharge: number;
}

const opt = (v: number | undefined) => (v === undefined ? null : v);

export function expensesCsv(rows: readonly ExportExpense[], range: DateRange): string {
  const header = [
    'Date',
    'Category group',
    'Category',
    'Vendor',
    'Amount (INR)',
    'GST (INR)',
    'Payment mode',
    'Odometer (km)',
    'Notes',
    'Source',
  ];
  const body = rows
    .filter((r) => inRange(r.expenseDate, range))
    .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate))
    .map((r) => [
      r.expenseDate,
      r.categoryGroup,
      r.categoryName,
      r.vendor ?? null,
      money(r.amount),
      money(r.gstAmount),
      r.paymentMode,
      opt(r.odometerKm),
      r.notes ?? null,
      r.source,
    ]);
  return withBom(toCsv(header, body));
}

export function fuelCsv(rows: readonly ExportFuel[], range: DateRange): string {
  const header = [
    'Date',
    'Odometer (km)',
    'Litres',
    'kWh',
    'Price per unit (INR)',
    'Total (INR)',
    'Full tank',
    'Station',
    'Payment mode',
  ];
  const body = rows
    .filter((r) => inRange(r.filledOn, range))
    .sort((a, b) => a.filledOn.localeCompare(b.filledOn))
    .map((r) => [
      r.filledOn,
      r.odometerKm,
      r.litres === undefined ? null : r.litres.toFixed(3),
      r.energyKwh === undefined ? null : r.energyKwh.toFixed(3),
      money(r.pricePerUnit),
      money(r.totalAmount),
      r.isFullTank ? 'Yes' : 'No',
      r.station ?? null,
      r.paymentMode ?? null,
    ]);
  return withBom(toCsv(header, body));
}

export function loanScheduleCsv(rows: readonly ExportLoanRow[]): string {
  const header = [
    'Instalment',
    'Due date',
    'EMI (INR)',
    'Principal (INR)',
    'Interest (INR)',
    'Opening balance (INR)',
    'Closing balance (INR)',
    'Status',
    'Paid on',
    'Paid amount (INR)',
    'Late fee (INR)',
    'Bounce charge (INR)',
  ];
  const body = [...rows]
    .sort((a, b) => a.installmentNo - b.installmentNo)
    .map((r) => [
      r.installmentNo,
      r.dueDate,
      money(r.scheduledEmi),
      money(r.principalComponent),
      money(r.interestComponent),
      money(r.openingBalance),
      money(r.closingBalance),
      r.status,
      r.paidOn ?? null,
      opt(r.paidAmount) === null ? null : money(r.paidAmount ?? 0),
      money(r.lateFee),
      money(r.bounceCharge),
    ]);
  return withBom(toCsv(header, body));
}
