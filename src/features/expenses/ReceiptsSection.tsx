import { useEffect, useRef, useState } from 'react';
import { checkReceiptFile, MAX_RECEIPTS } from '../../core/receipts/rules';
import { uploadReceipt, removeReceipt, signedReceiptUrl } from '../../data/receipts';
import { compressImage } from '../../data/receiptImage';
import { DataError } from '../../data/errors';

interface Props {
  expenseId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** Attach, view and remove up to 3 receipts for a saved expense (FR-EXP-08). */
export function ReceiptsSection({ expenseId, paths, onChange }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const full = paths.length >= MAX_RECEIPTS;

  useEffect(() => {
    let cancelled = false;
    for (const p of paths) {
      if (urls[p]) continue;
      signedReceiptUrl(p)
        .then((u) => {
          if (!cancelled) setUrls((prev) => ({ ...prev, [p]: u }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // urls is intentionally omitted: we only fetch paths we have not resolved yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|')]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const check = checkReceiptFile({ type: file.type, size: file.size }, paths.length);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setBusy(true);
    try {
      const body = check.kind === 'image' ? await compressImage(file) : file;
      const next = await uploadReceipt(expenseId, paths, body, check.kind);
      onChange(next);
    } catch (err) {
      setError(err instanceof DataError ? err.message : 'Could not add the receipt. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(path: string) {
    setError(null);
    setBusy(true);
    try {
      onChange(await removeReceipt(expenseId, paths, path));
    } catch (err) {
      setError(err instanceof DataError ? err.message : 'Could not remove the receipt. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="receipts" aria-labelledby="receipts-heading">
      <h2 id="receipts-heading">Receipts</h2>
      <p className="muted">
        {paths.length} of {MAX_RECEIPTS} attached
      </p>

      {paths.length > 0 && (
        <ul className="receipt-list">
          {paths.map((p, i) => (
            <li key={p} className="receipt-row">
              <a href={urls[p]} target="_blank" rel="noopener noreferrer">
                Receipt {i + 1}
              </a>
              <button
                type="button"
                className="btn-secondary"
                aria-label={`Remove receipt ${i + 1}`}
                disabled={busy}
                onClick={() => void remove(p)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {full && <p className="hint">You can attach up to 3 receipts. Remove one to add another.</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label="Choose receipt file"
        onChange={onPick}
        hidden
      />
      <button
        type="button"
        className="btn-secondary"
        disabled={full || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Working…' : 'Add receipt'}
      </button>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
