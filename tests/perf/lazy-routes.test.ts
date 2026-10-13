// T32 — route-level lazy loading for Reports and Loans (TC-PERF-03 supports the budget).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const app = readFileSync(join(resolve(__dirname, '../..'), 'src/app/App.tsx'), 'utf8');

describe('route-level code splitting', () => {
  for (const name of ['ReportsPage', 'LoansPage', 'LoanDetailPage']) {
    it(`${name} is loaded with React.lazy, not a static import`, () => {
      expect(app).not.toMatch(new RegExp(`import \\{ ${name} \\}`));
      expect(app).toMatch(new RegExp(`const ${name} = lazy\\(\\(\\)\\s*=>\\s*import\\(`));
    });
  }

  it('lazy routes render inside a Suspense boundary', () => {
    expect(app).toMatch(/<Suspense/);
  });
});
