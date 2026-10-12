// T28 UI — update prompt and offline notice (FR-PWA-06; TC-PWA-02).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  update: vi.fn(),
}));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.update,
  }),
}));

import { UpdateBanner } from './UpdateBanner';
import { OfflineBanner } from './OfflineBanner';

beforeEach(() => {
  vi.clearAllMocks();
  sw.needRefresh = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

describe('update prompt (FR-PWA-06)', () => {
  it('shows nothing when no new version is waiting', () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a refresh when a new version is waiting, and applies it only on tap', async () => {
    sw.needRefresh = true;
    const user = userEvent.setup();
    render(<UpdateBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('A new version is available.');
    expect(sw.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(sw.update).toHaveBeenCalledWith(true);
  });
});

describe('offline notice (TC-PWA-02)', () => {
  it('is hidden while online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears when the connection drops and goes away when it returns', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('You are offline.');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('starts offline if the browser says so at load', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('You are offline.');
  });
});
