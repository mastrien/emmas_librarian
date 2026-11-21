import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../../src/types';
import { errorText } from '../errorText';
import type { LocalWorkspace } from '../local/LocalWorkspace';
import { useReader, useWorkspace } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

const megabytes = (bytes: number) => `${(bytes / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

/** Runs an action and keeps its failure in words, for the card to show; `reload` runs after a success. */
function useAction(reload: () => void): {
  problem: string | null;
  run: (action: () => Promise<unknown>) => Promise<void>;
} {
  const [problem, setProblem] = useState<string | null>(null);
  const run = (action: () => Promise<unknown>) =>
    action().then(
      () => {
        setProblem(null);
        reload();
      },
      (error: unknown) => setProblem(errorText(error)),
    );
  return { problem, run };
}

const OpenPdf: React.FC<{ article: Article; size: number }> = ({ article, size }) => (
  <>
    <Link className="m-button m-button--primary" to={`/articles/${article.id}/pdf`}>
      Abrir PDF
    </Link>
    <p className="m-row__detail">PDF no celular · {megabytes(size)}</p>
  </>
);

interface WorkspaceActionProps {
  workspace: LocalWorkspace;
  article: Article;
  run: (action: () => Promise<unknown>) => Promise<void>;
}

const DownloadPdf: React.FC<WorkspaceActionProps> = ({ workspace, article, run }) => (
  <button
    className="m-button"
    onClick={() =>
      void run(async () => {
        if (!(await workspace.downloadPdf(article.id))) throw new Error('O computador não tem PDF para este artigo.');
      })
    }
  >
    Baixar PDF para ler offline
  </button>
);

const PickPdf: React.FC<WorkspaceActionProps> = ({ workspace, article, run }) => {
  const picker = useRef<HTMLInputElement>(null);
  const attach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) void run(async () => workspace.attachPdf(article.id, new Uint8Array(await file.arrayBuffer())));
    event.target.value = '';
  };
  return (
    <>
      <button className="m-button" onClick={() => picker.current?.click()}>
        Adicionar PDF deste aparelho
      </button>
      <input ref={picker} type="file" hidden aria-label="PDF do aparelho" onChange={attach} />
    </>
  );
};

// On the phone's own library a PDF is there only if it was downloaded (or picked); the person chooses which ones.
const LocalPdfAction: React.FC<{ article: Article; size: number | null; reload: () => void }> = ({
  article,
  size,
  reload,
}) => {
  const { workspace, status } = useWorkspace();
  const { problem, run } = useAction(reload);
  if (size !== null) return <OpenPdf article={article} size={size} />;
  const canDownload = workspace !== null && Boolean(status?.pairedTo);
  return (
    <>
      {workspace && canDownload && <DownloadPdf workspace={workspace} article={article} run={run} />}
      {workspace && <PickPdf workspace={workspace} article={article} run={run} />}
      <p className="m-row__detail">
        {canDownload ? 'Este PDF não está no celular.' : 'Este artigo não tem PDF no celular.'}
      </p>
      {problem && (
        <p className="m-note m-note--error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
};

/**
 * The way into an article's PDF. On the live desktop or a file it is a link when the article has a PDF; on the
 * phone's own library it is a link when the PDF was downloaded, or a button to download it.
 *
 * @example <PdfAction article={article} />
 */
export const PdfAction: React.FC<{ article: Article }> = ({ article }) => {
  const reader = useReader();
  const size = useLoaded(
    useCallback(async () => (reader.pdfSize ? reader.pdfSize(article.id) : undefined), [reader, article.id]),
  );
  if (!reader.pdfSize) {
    return article.local_file_path ? (
      <Link className="m-button m-button--primary" to={`/articles/${article.id}/pdf`}>
        Abrir PDF
      </Link>
    ) : (
      <p className="m-row__detail">Este artigo não tem PDF.</p>
    );
  }
  if (size.state !== 'ready') return null;
  return <LocalPdfAction article={article} size={size.value ?? null} reload={size.reload} />;
};
