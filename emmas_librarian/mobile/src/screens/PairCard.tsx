import React, { useState } from 'react';

interface PairCardProps {
  /** Pairs with the code (or the address of the QR code) the person pasted; rejects with the reason in words. */
  onPair: (text: string) => Promise<unknown>;
  /** Reads the QR code with the camera, where the app can; the card hides the button otherwise. */
  onScan?: () => Promise<string>;
}

/**
 * Where the code of "Parear um celular" goes in. Shows why a pairing failed, in the words of the error.
 *
 * @example <PairCard onPair={(text) => workspace.pair(text)} />
 */
export const PairCard: React.FC<PairCardProps> = ({ onPair, onScan }) => {
  const [text, setText] = useState('');
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const run = async (code: string) => {
    setState({ busy: true, error: null });
    try {
      await onPair(code);
      setText('');
      setState({ busy: false, error: null });
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
  return (
    <section className="m-card">
      <h2>Parear com o computador</h2>
      <p>
        No computador, abra Configurações › Acesso pelo celular › &quot;Parear um celular para sincronizar&quot;. Leia o
        QR code ou cole o código aqui.
      </p>
      {onScan && (
        <button
          className="m-button"
          onClick={() => void onScan().then(run, (error: unknown) => setState({ busy: false, error: String(error) }))}
        >
          Ler QR code
        </button>
      )}
      <textarea
        className="m-input m-input--area"
        aria-label="Código de pareamento"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {state.error && (
        <p className="m-note m-note--error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="m-button m-button--primary"
        disabled={state.busy || text.trim() === ''}
        onClick={() => void run(text)}
      >
        {state.busy ? 'Pareando…' : 'Parear'}
      </button>
    </section>
  );
};
