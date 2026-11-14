import React, { useRef } from 'react';

interface StartScreenProps {
  /** Whether this page came from the desktop app, which a phone can pair with. */
  servedByDesktop: boolean;
  /** Something the person should know: a pairing that failed, a file that could not be read. */
  notice: string | null;
  onOpenFile: (file: File) => void;
}

const ConnectHelp: React.FC = () => (
  <section className="m-card">
    <h2>Conectar a este computador</h2>
    <p>
      No Emma&apos;s Librarian do computador, abra Configurações › Acesso pelo celular, toque em &quot;Parear um
      celular&quot; e leia o código QR com a câmera deste aparelho.
    </p>
  </section>
);

/**
 * The first screen: pair with the desktop (when served by it) or open a project file kept on the phone.
 *
 * @example <StartScreen servedByDesktop notice={null} onOpenFile={openFile} />
 */
export const StartScreen: React.FC<StartScreenProps> = ({ servedByDesktop, notice, onOpenFile }) => {
  const input = useRef<HTMLInputElement>(null);
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) onOpenFile(file);
    event.target.value = '';
  };
  return (
    <main className="m-screen m-start">
      <h1 className="m-start__title">Emma&apos;s Librarian</h1>
      {notice && (
        <p className="m-note m-note--error" role="alert">
          {notice}
        </p>
      )}
      {servedByDesktop && <ConnectHelp />}
      <section className="m-card">
        <h2>Abrir um projeto exportado</h2>
        <p>Leia um arquivo .emmapcarc guardado neste aparelho, sem o computador por perto. Nada é alterado.</p>
        <button className="m-button m-button--primary" onClick={() => input.current?.click()}>
          Escolher arquivo .emmapcarc
        </button>
        {/* No accept filter: phones do not know the .emmapcarc type and would grey the file out. */}
        <input ref={input} type="file" hidden onChange={pick} aria-label="Arquivo de projeto" />
      </section>
    </main>
  );
};
