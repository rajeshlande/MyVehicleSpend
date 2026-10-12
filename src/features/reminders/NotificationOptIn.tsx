import { useState } from 'react';
import { optInState, type OptInState } from '../../core/notifications/notify';
import {
  browserPermission,
  readPreference,
  requestBrowserPermission,
  writePreference,
  type BrowserPermission,
} from './notificationSettings';

function stateFor(permission: BrowserPermission, preferenceOn: boolean): OptInState {
  return optInState({ permission, preferenceOn });
}

/**
 * "Turn on reminders" control (FR-REM-04). The permission prompt is requested only from a tap, never on load.
 * Refusal or an unsupported browser shows a message; the reminder list still works.
 */
export function NotificationOptIn() {
  const [state, setState] = useState<OptInState>(() =>
    stateFor(browserPermission(), readPreference())
  );
  const [busy, setBusy] = useState(false);

  async function turnOn() {
    setBusy(true);
    let permission = browserPermission();
    if (permission === 'default') permission = await requestBrowserPermission();
    if (permission === 'granted') writePreference(true);
    setState(stateFor(permission, permission === 'granted'));
    setBusy(false);
  }

  function turnOff() {
    writePreference(false);
    setState(stateFor(browserPermission(), false));
  }

  return (
    <section aria-label="Reminder notifications" className="notify-optin">
      {state === 'ask' || state === 'off' ? (
        <>
          <button type="button" className="btn-secondary" onClick={turnOn} disabled={busy}>
            Turn on reminders
          </button>
          {state === 'off' && (
            <p className="muted">Reminders are off. The list still shows everything.</p>
          )}
        </>
      ) : null}
      {state === 'on' ? (
        <>
          <p className="muted">Reminders are on.</p>
          <button type="button" className="btn-secondary" onClick={turnOff}>
            Turn off reminders
          </button>
        </>
      ) : null}
      {state === 'blocked' ? (
        <p className="muted">
          Notifications are blocked for this site. Reminders still show in the app. To get alerts,
          allow notifications in your browser settings.
        </p>
      ) : null}
      {state === 'unsupported' ? (
        <p className="muted">
          This browser does not support notifications. Reminders still show in the app.
        </p>
      ) : null}
    </section>
  );
}
