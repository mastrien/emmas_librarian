import React from 'react';
import { GyroscopeCanvas, type GyroAiState } from '../../components/gyroscope/GyroscopeCanvas';
import { useCanvasColors } from '../../components/gyroscope/useCanvasColors';

interface AskRingsProps {
  /** "hero" is the large one above the empty page; "avatar" is the 28 px one beside an answer (board 168). */
  size: 'hero' | 'avatar';
  /** What the AI is doing: the rings turn faster while it thinks. */
  state?: GyroAiState;
}

/**
 * The Emma's rings (the GyroscopeCanvas of the rings project) in the Ask page: large above "O que você quer saber?" until
 * the first question, then small beside the answer that is on its way or the last one.
 *
 * @example <AskRings size="hero" />
 */
export const AskRings: React.FC<AskRingsProps> = ({ size, state = 'idle' }) => {
  const { ring, inner, theme } = useCanvasColors();
  return (
    <div className={`ask-rings ask-rings--${size}`} role="img" aria-label="Anéis animados da Emma">
      <GyroscopeCanvas theme={theme} ringColor={ring} innerColor={inner} state={state} />
    </div>
  );
};

/** The still rings of the board, for the answers that are not the last: only one canvas at a time is alive. */
export const AskRingsStill: React.FC = () => (
  <svg
    className="ask-rings ask-rings--avatar ask-rings--still"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Anéis da Emma"
  >
    <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="16" cy="16" rx="5" ry="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
    <ellipse
      cx="16"
      cy="16"
      rx="11"
      ry="9"
      transform="rotate(45 16 16)"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity=".45"
    />
  </svg>
);
