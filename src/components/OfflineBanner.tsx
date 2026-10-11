import { useEffect, useState } from 'react';

/** Shows when the browser reports no network. Sync behaviour arrives in Phase 8. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      Offline — changes will sync later
    </div>
  );
}
