import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  uploadReceipt: vi.fn(),
  removeReceipt: vi.fn(),
  signedReceiptUrl: vi.fn(),
  compressImage: vi.fn(),
}));
vi.mock('../../data/receipts', () => ({
  uploadReceipt: api.uploadReceipt,
  removeReceipt: api.removeReceipt,
  signedReceiptUrl: api.signedReceiptUrl,
}));
vi.mock('../../data/receiptImage', () => ({ compressImage: api.compressImage }));

import { ReceiptsSection } from './ReceiptsSection';

const EXP = '44444444-4444-4444-8444-444444444444';
const P1 = `u/${EXP}/1.jpg`;
const P2 = `u/${EXP}/2.pdf`;
const P3 = `u/${EXP}/3.jpg`;

beforeEach(() => {
  vi.clearAllMocks();
  api.signedReceiptUrl.mockImplementation(
    async (p: string) => `https://signed.example/${p}?token=t`
  );
  api.compressImage.mockImplementation(
    async (f: File) => new Blob([f.name], { type: 'image/jpeg' })
  );
});

function file(name: string, type: string, size = 1024) {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('Receipts section (FR-EXP-08, TC-EXP-09)', () => {
  it('lists saved receipts as links that open a signed URL', async () => {
    render(<ReceiptsSection expenseId={EXP} paths={[P1, P2]} onChange={vi.fn()} />);
    const link = await screen.findByRole('link', { name: 'Receipt 1' });
    await waitFor(() =>
      expect(link).toHaveAttribute('href', `https://signed.example/${P1}?token=t`)
    );
    expect(api.signedReceiptUrl).toHaveBeenCalledWith(P1);
    expect(screen.getByRole('link', { name: 'Receipt 2' })).toBeInTheDocument();
  });

  it('disables adding a 4th receipt (max 3)', async () => {
    render(<ReceiptsSection expenseId={EXP} paths={[P1, P2, P3]} onChange={vi.fn()} />);
    expect(await screen.findByText(/up to 3 receipts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add receipt' })).toBeDisabled();
  });

  it('rejects a 6 MB JPEG and does not upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ReceiptsSection expenseId={EXP} paths={[]} onChange={vi.fn()} />);
    await user.upload(
      screen.getByLabelText('Choose receipt file'),
      file('big.jpg', 'image/jpeg', 6 * 1024 * 1024)
    );
    expect(await screen.findByText(/larger than 5 MB/)).toBeInTheDocument();
    expect(api.uploadReceipt).not.toHaveBeenCalled();
  });

  it('rejects an .exe with a message and does not upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ReceiptsSection expenseId={EXP} paths={[]} onChange={vi.fn()} />);
    await user.upload(
      screen.getByLabelText('Choose receipt file'),
      file('setup.exe', 'application/x-msdownload')
    );
    expect(await screen.findByText('Use a JPEG, PNG, WebP or PDF file.')).toBeInTheDocument();
    expect(api.uploadReceipt).not.toHaveBeenCalled();
  });

  it('compresses an image, uploads it and reports the new list', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    api.uploadReceipt.mockResolvedValue([P1]);
    render(<ReceiptsSection expenseId={EXP} paths={[]} onChange={onChange} />);
    const f = file('bill.jpg', 'image/jpeg', 2 * 1024 * 1024);
    await user.upload(screen.getByLabelText('Choose receipt file'), f);
    await waitFor(() => expect(api.uploadReceipt).toHaveBeenCalledTimes(1));
    expect(api.compressImage).toHaveBeenCalledWith(f);
    expect(api.uploadReceipt).toHaveBeenCalledWith(EXP, [], expect.any(Blob), 'image');
    expect(onChange).toHaveBeenCalledWith([P1]);
  });

  it('uploads a PDF without compression', async () => {
    const user = userEvent.setup({ applyAccept: false });
    api.uploadReceipt.mockResolvedValue([P2]);
    render(<ReceiptsSection expenseId={EXP} paths={[]} onChange={vi.fn()} />);
    await user.upload(
      screen.getByLabelText('Choose receipt file'),
      file('bill.pdf', 'application/pdf')
    );
    await waitFor(() =>
      expect(api.uploadReceipt).toHaveBeenCalledWith(EXP, [], expect.any(File), 'pdf')
    );
    expect(api.compressImage).not.toHaveBeenCalled();
  });

  it('removes a receipt after the storage call succeeds', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    api.removeReceipt.mockResolvedValue([P2]);
    render(<ReceiptsSection expenseId={EXP} paths={[P1, P2]} onChange={onChange} />);
    await user.click(await screen.findByRole('button', { name: 'Remove receipt 1' }));
    await waitFor(() => expect(api.removeReceipt).toHaveBeenCalledWith(EXP, [P1, P2], P1));
    expect(onChange).toHaveBeenCalledWith([P2]);
  });
});
