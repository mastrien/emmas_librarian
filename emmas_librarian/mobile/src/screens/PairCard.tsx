import React, { useState } from 'react';
import { errorText } from '../errorText';

interface PairCardProps {
  /** Pairs with the code (or the address of the QR code) the person pasted; rejects with the reason in words. */
  onPair: (text: string) => Promise<unknown>;
  /** Reads the QR code with the camera, where the app can; the card hides the button otherwise. */
  onScan?: () => Promise<string>;
}

/** Pairing attempts and their outcome: `pair(text)` never throws, it keeps the reason in `error`. */
function usePairing(onPair: PairCardProps['onPair']) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const pair = async (code: string): Promise<boolean> => {
    setState({ busy: true, error: null });
    try {
      await onPair(code);
      setState({ busy: false, error: null });
      return true;
    } catch (error) {
      setState({ busy: false, error: errorText(error) });
      return false;
    }
  };
  return { ...state, pair, fail: (error: unknown) => setState({ busy: false, error: errorText(error) }) };
}

/**
 * Where the code of "Parear um celular" goes in. Shows why a pairing failed, in the words of the error.
 *
 * @example <PairCard onPair={(text) => workspace.pair(text)} />
 */
export const PairCard: React.FC<PairCardProps> = ({ onPair, onScan }) => {
  const [text, setText] = useState('');
  const { busy, error, pair, fail } = usePairing(onPair);
  const submit = async (code: string) => {
    if (await pair(code)) setText('');
  };
  return (
    <section className="m-card">
      <h2>Parear com o computador</h2>
      <p>
        No computador, abra Configurações › Acesso pelo celular › &quot;Parear um celular para sincronizar&quot;. Leia o
        QR code ou cole o código aqui.
      </p>
      {onScan && (
        <button className="m-button" onClick={() => void onScan().then(submit, fail)}>
          Ler QR code
        </button>
      )}
      <textarea
        className="m-input m-input--area"
        aria-label="Código de pareamento"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {error && (
        <p className="m-note m-note--error" role="alert">
          {error}
        </p>
      )}
      <button
        className="m-button m-button--primary"
        disabled={busy || text.trim() === ''}
        onClick={() => void submit(text)}
      >
        {busy ? 'Pareando…' : 'Parear'}
      </button>
    </section>
  );
};
