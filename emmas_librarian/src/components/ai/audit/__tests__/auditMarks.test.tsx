import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { wilsonInterval } from '../../../../utils/auditSampling';
import { ForestPlot } from '../ForestPlot';
import { AuditModelComparison } from '../AuditModelComparison';

describe('ForestPlot marks (Arca 134: positions as CSS variables)', () => {
  it('places the estimate, the whisker and both caps on the 0-100% ruler', () => {
    const interval = wilsonInterval(8, 10)!;
    const { container } = render(<ForestPlot interval={interval} />);
    const at = (selector: string) => (container.querySelector(selector) as HTMLElement).style.getPropertyValue('--at');

    expect(at('.audit-point')).toBe(`${interval.estimate * 100}%`);
    expect(at('.audit-whisker')).toBe(`${interval.low * 100}%`);
    // The high cap sits 2px left of its value (audit.css), so it gets its own modifier.
    expect(at('.audit-cap--high')).toBe(`${interval.high * 100}%`);
    expect(container.querySelectorAll('.audit-cap')).toHaveLength(2);
  });
});

describe('AuditModelComparison', () => {
  it('marks the investigation being audited among the models', () => {
    const stats = { sampled: 10, marked: 10, correct: 8, interval: wilsonInterval(8, 10) };
    render(
      <AuditModelComparison
        rows={[
          { investigationId: 19, model: 'Gemini', stats },
          { investigationId: 20, model: 'Claude', stats },
        ]}
        currentId={20}
        onHelp={vi.fn()}
      />,
    );

    expect(screen.getByText('Claude').closest('td')).toHaveClass('is-current');
    expect(screen.getByText('Gemini').closest('td')).not.toHaveClass('is-current');
  });
});
