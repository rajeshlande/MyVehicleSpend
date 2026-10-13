import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard (Base design)', () => {
  it('shows the label, the value and the note', () => {
    render(<StatCard label="Total spend" value="₹12,400" note="5 expenses" tint="tint-teal" />);
    expect(screen.getByText('Total spend')).toBeInTheDocument();
    expect(screen.getByText('₹12,400')).toBeInTheDocument();
    expect(screen.getByText('5 expenses')).toBeInTheDocument();
  });

  it('puts the icon tile in a tinted, decorative element', () => {
    const { container } = render(
      <StatCard label="Cost per km" value="₹3.2/km" tint="tint-rose" icon="⛽" />
    );
    const tile = container.querySelector('.stat-icon');
    expect(tile).toHaveClass('tint-rose');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveTextContent('⛽');
  });

  it('renders a value or a message in place of the value', () => {
    render(<StatCard label="Cost per km" value={<span>Needs two full fills</span>} />);
    expect(screen.getByText('Needs two full fills')).toBeInTheDocument();
  });
});
