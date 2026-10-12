// Home redesign: category tiles show each group's share as a ring and its amount.
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CategoryTiles } from './Dashboard';

describe('CategoryTiles', () => {
  it('shows each category with its percentage and amount', () => {
    render(
      <CategoryTiles
        groups={[
          { group: 'Fuel', total: 3000, share: 0.75 },
          { group: 'Service', total: 1000, share: 0.25 },
        ]}
      />
    );
    const fuel = screen.getByText('Fuel').closest('article') as HTMLElement;
    expect(within(fuel).getByText('75%')).toBeInTheDocument();
    expect(within(fuel).getByText('₹3,000.00')).toBeInTheDocument();
    const service = screen.getByText('Service').closest('article') as HTMLElement;
    expect(within(service).getByText('25%')).toBeInTheDocument();
  });

  it('draws the ring to the share: dash length is the share of the circumference', () => {
    const { container } = render(
      <CategoryTiles groups={[{ group: 'Fuel', total: 1000, share: 0.5 }]} />
    );
    const value = container.querySelector('.ring-value') as SVGCircleElement;
    const circumference = 2 * Math.PI * 20;
    expect(value.getAttribute('stroke-dasharray')).toBe(`${circumference * 0.5} ${circumference}`);
  });

  it('renders nothing when there are no categories', () => {
    const { container } = render(<CategoryTiles groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
