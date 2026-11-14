import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The machine's WebGL answer and the canvas's behaviour are the two things this suite controls.
const machine = vi.hoisted(() => ({ canDraw: true, canvasThrows: false }));

vi.mock('../../../components/gyroscope/webglSupport', () => ({ hasWebGl: () => machine.canDraw }));
vi.mock('../../../components/gyroscope/GyroscopeCanvas', () => ({
  GyroscopeCanvas: () => {
    if (machine.canvasThrows) throw new Error('Error creating WebGL context.');
    return <canvas data-testid="rings-canvas" />;
  },
}));

import { AskRings } from '../AskRings';

afterEach(() => {
  machine.canDraw = true;
  machine.canvasThrows = false;
});

describe('AskRings', () => {
  it('draws the rings where WebGL works', () => {
    render(<AskRings size="hero" />);

    expect(screen.getByTestId('rings-canvas')).toBeInTheDocument();
  });

  it('leaves the place empty where the machine cannot draw WebGL, without a canvas', () => {
    machine.canDraw = false;

    render(<AskRings size="avatar" />);

    expect(screen.getByRole('img', { name: 'Anéis animados da Emma' })).toBeInTheDocument();
    expect(screen.queryByTestId('rings-canvas')).toBeNull();
  });

  it('keeps the page when the canvas throws while mounting, instead of the whole-app error screen', () => {
    machine.canvasThrows = true;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<AskRings size="hero" />);

    expect(screen.getByRole('img', { name: 'Anéis animados da Emma' })).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado na interface')).toBeNull();
    quiet.mockRestore();
  });
});
