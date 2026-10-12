import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { UpdateBanner } from './features/pwa/UpdateBanner';
import { OfflineBanner } from './features/pwa/OfflineBanner';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    {/* Above App, so the service worker registers even when the app shows its setup screen. */}
    <OfflineBanner />
    <UpdateBanner />
    <App />
  </StrictMode>
);
