import { useRegisterSW } from 'virtual:pwa-register/react';

/** Asks the user before a new version replaces the running one (FR-PWA-06). */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="pwa-banner">
      <span>A new version is available.</span>{' '}
      <button type="button" className="btn-primary" onClick={() => void updateServiceWorker(true)}>
        Refresh
      </button>
    </div>
  );
}
