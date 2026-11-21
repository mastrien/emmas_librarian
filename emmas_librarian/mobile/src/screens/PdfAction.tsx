import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../../src/types';
import { useReader, useWorkspace } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

const megabytes = (bytes: number) => `${(bytes / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

interface LocalPdfProps {
  article: Article;
  size: number | null;
  reload: () => void;
}

// On the phone's own library a PDF is there only if it was downloaded (or picked); the person chooses which ones.
const LocalPdfAction: React.FC<LocalPdfProps> = ({ article, size, reload }) => {
  const { workspace, status } = useWorkspace();
  const picker = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = (action: () => Promise<unknown>) =>
    action().then(
      () => {
        setProblem(null);
        reload();
      },
      (error: unknown) => setProblem(error instanceof Error ? error.message : String(error)),
    );
  if (size !== null) {
    return (
      <>
        <Link className="m-button m-button--primary" to={`/articles/${article.id}/pdf`}>
          Abrir PDF
        </Link>
        <p className="m-row__detail">PDF no celular · {megabytes(size)}</p>
      </>
    );
  }
  const canDownload = workspace !== null && status?.pairedTo;
  return (
    <>
      {canDownload && (
        <button
          className="m-button"
          onClick={() =>
            void run(async () => {
              if (!(await workspace.downloadPdf(article.id)))
                throw new Error('O computador não tem PDF para este artigo.');
            })
          }
        >
          Baixar PDF para ler offline
        </button>
      )}
      {workspace && (
        <>
          <button className="m-button" onClick={() => picker.current?.click()}>
            Adicionar PDF deste aparelho
          </button>
          <input
            ref={picker}
            type="file"
            hidden
            aria-label="PDF do aparelho"
            onChange={(event) => {
              const [file] = Array.from(event.target.files ?? []);
              if (file) void run(async () => workspace.attachPdf(article.id, new Uint8Array(await file.arrayBuffer())));
              event.target.value = '';
            }}
          />
        </>
      )}
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
