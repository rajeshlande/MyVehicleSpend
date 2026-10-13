import { describe, it, expect } from 'vitest';
import { routerBasename } from './basename';

describe('routerBasename', () => {
  it('is empty when the app is served from the root', () => {
    expect(routerBasename('/')).toBe('');
  });
  it('drops the trailing slash for a sub-path such as GitHub Pages', () => {
    expect(routerBasename('/MyVehicleSpend/')).toBe('/MyVehicleSpend');
  });
});
