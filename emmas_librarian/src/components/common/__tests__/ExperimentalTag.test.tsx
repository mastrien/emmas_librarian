import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExperimentalTag } from '../ExperimentalTag';

describe('ExperimentalTag', () => {
  it('says it is experimental, and why on hover', () => {
    render(<ExperimentalTag reason="Ainda não medido." />);

    expect(screen.getByText('Experimental')).toHaveAttribute('title', 'Ainda não medido.');
  });
});
