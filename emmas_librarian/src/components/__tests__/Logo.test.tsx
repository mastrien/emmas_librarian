import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Logo } from '../common/Logo';

describe('Logo Component', () => {
  it('renders SVG logo correctly with default props', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('renders SVG with custom size, className, and style', () => {
    const { container } = render(<Logo size={48} className="custom-logo" style={{ color: 'red' }} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
    expect(svg?.classList.contains('custom-logo')).toBe(true);
    expect(svg?.style.color).toBe('red');
  });
});
