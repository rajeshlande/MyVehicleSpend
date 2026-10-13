import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WhatsNewPage } from './WhatsNewPage';
import { AppVersion } from './AppVersion';

describe("What's new screen", () => {
  it('lists the unreleased changes and the planned 1.0.0 release with its sections', () => {
    render(
      <MemoryRouter>
        <WhatsNewPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: "What's new" })).toBeInTheDocument();

    const unreleased = screen.getByRole('region', { name: 'Unreleased' });
    expect(within(unreleased).getByText(/Versioning and changelog/)).toBeInTheDocument();

    const v1 = screen.getByRole('region', { name: /Version 1\.0\.0/ });
    expect(within(v1).getByRole('heading', { name: 'Added' })).toBeInTheDocument();
  });

  it('shows the running version', () => {
    render(
      <MemoryRouter>
        <WhatsNewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument();
  });
});

describe('AppVersion', () => {
  it('shows the version and the build date', () => {
    render(<AppVersion />);
    expect(screen.getByText(new RegExp(`Version ${__APP_VERSION__}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(__BUILD_DATE__))).toBeInTheDocument();
  });
});
