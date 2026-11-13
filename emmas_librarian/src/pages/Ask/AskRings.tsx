import React from 'react';
import { useMemo } from 'react';
import { GyroscopeCanvas, renderRingsStill, type GyroAiState } from '../../components/gyroscope/GyroscopeCanvas';
import { ACCENT_TOKEN, RING_TOKEN, useCanvasColors } from '../../components/gyroscope/useCanvasColors';

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
  // The big ones wait quietly in the tone of the side bars; the one beside an answer is in the chosen accent.
  const { ring, inner, theme } = useCanvasColors(size === 'avatar' ? ACCENT_TOKEN : RING_TOKEN);
  return (
    <div className={`ask-rings ask-rings--${size}`} role="img" aria-label="Anéis animados da Emma">
      <GyroscopeCanvas theme={theme} ringColor={ring} innerColor={inner} state={state} />
    </div>
  );
};

/** The size, in pixels, the still frame is drawn at: six times the 28 the avatar shows, so it is sharp. */
const STILL_PX = 168;

/**
 * The same rings, still, for the answers that are not the last: a frame of the 3D drawing as an image, so that only one
 * canvas is alive at a time. Where it cannot be drawn (no WebGL), the board's flat drawing takes its place.
 */
export const AskRingsStill: React.FC = () => {
  const { ring, inner } = useCanvasColors(ACCENT_TOKEN);
  const src = useMemo(() => (ring && inner ? renderRingsStill({ ring, inner }, STILL_PX) : null), [ring, inner]);
  if (!src) return <FlatRings />;
  return <img className="ask-rings ask-rings--avatar" src={src} alt="Anéis da Emma" />;
};

const FlatRings: React.FC = () => (
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
