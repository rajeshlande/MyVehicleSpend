/** Version and build date of this app. Both are set at build time (see vite.config.ts). */
export function AppVersion() {
  return (
    <p className="app-version hint">
      Version {__APP_VERSION__} · built {__BUILD_DATE__}
    </p>
  );
}
