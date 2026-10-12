import { useLastUpdated } from '../../data/freshness';
import { formatDateTimeIST } from '../../core/dates/dates';

/** Shown when the page is using saved data because the connection failed (FR-PWA-03, TC-PWA-03). */
export function LastUpdatedNotice() {
  const at = useLastUpdated();
  if (!at) return null;
  return (
    <p role="status" className="pwa-banner pwa-offline">
      Showing saved data. Last updated {formatDateTimeIST(at)}.
    </p>
  );
}
