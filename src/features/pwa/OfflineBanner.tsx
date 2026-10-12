import { useEffect, useState } from 'react';

/** Shown while the browser is offline (TC-PWA-02). Saving needs a connection until the outbox ships (T29b). */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="pwa-banner pwa-offline">
      You are offline. The app opens from what was loaded last. Changes need a connection to save.
    </div>
  );
}
