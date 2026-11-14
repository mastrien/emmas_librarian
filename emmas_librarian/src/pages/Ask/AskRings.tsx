import React, { useState } from 'react';
import { GyroscopeCanvas, type GyroAiState } from '../../components/gyroscope/GyroscopeCanvas';
import { ACCENT_TOKEN, RING_TOKEN, useCanvasColors } from '../../components/gyroscope/useCanvasColors';
import { hasWebGl } from '../../components/gyroscope/webglSupport';
import { ReactErrorBoundary } from '../../components/common/ErrorBoundary';

interface AskRingsProps {
  /** "hero" is the large one above the empty page; "avatar" is the 28 px one beside an answer (board 168). */
  size: 'hero' | 'avatar';
  /** What the AI is doing: the rings turn faster while it thinks. */
  state?: GyroAiState;
}

/**
 * The Emma's rings (the GyroscopeCanvas of the rings project) in the Ask page: large above "O que você quer saber?" until
 * the first question, then small beside the answer that is on its way or the latest one, and only that one. Where the
 * machine cannot draw WebGL (or the context dies), the place stays empty: the rings are decoration and must never take
 * the page, let alone the whole app, down with them.
 *
 * @example <AskRings size="hero" />
 */
export const AskRings: React.FC<AskRingsProps> = ({ size, state = 'idle' }) => {
  // The big ones wait quietly in the tone of the side bars; the one beside an answer is in the chosen accent.
  const { ring, inner, theme } = useCanvasColors(size === 'avatar' ? ACCENT_TOKEN : RING_TOKEN);
  const [canDraw] = useState(() => hasWebGl());
  return (
    <div className={`ask-rings ask-rings--${size}`} role="img" aria-label="Anéis animados da Emma">
      {canDraw && (
        // An empty fallback (not null: the boundary treats null as "no fallback" and shows its full-screen error).
        <ReactErrorBoundary fallback={<span />}>
          <GyroscopeCanvas theme={theme} ringColor={ring} innerColor={inner} state={state} />
        </ReactErrorBoundary>
      )}
    </div>
  );
};
