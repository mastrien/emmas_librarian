import React, { useState } from 'react';
import { failureNotice } from '../common/dialogs/failureNotice';
import { Download, Link2 } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { openAccessMessage } from '../../pages/ProjectDetails/components/articles/openAccessText';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useDialogs } from '../common/dialogs/DialogProvider';
import { PdfDropZone } from './attachPdf/PdfDropZone';
import { PdfLibraryPicker } from './attachPdf/PdfLibraryPicker';
import './attachPdf/attachPdf.css';

interface AttachPdfModalProps {
  isOpen: boolean;
  articleId: number;
  onClose: () => void;
  onAttached: () => void;
}

// Hooks live in the content component so the early return for a closed modal cannot change hook order.
export const AttachPdfModal: React.FC<AttachPdfModalProps> = (props) =>
  props.isOpen ? <AttachPdfModalContent {...props} /> : null;

/**
 * The ways to give an article its PDF (board 176): drop one, pick a file, look for the open access copy, or reuse one
 * already in the library.
 */
const AttachPdfModalContent: React.FC<AttachPdfModalProps> = ({ articleId, onClose, onAttached }) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [view, setView] = useState<'options' | 'library'>('options');
  const [searching, setSearching] = useState(false);

  const attached = () => {
    onAttached();
    onClose();
  };

  const upload = async (filePath: string) => {
    try {
      await projectService.uploadPdf(articleId, filePath);
      attached();
    } catch (err) {
      await inform(failureNotice('Não conseguimos enviar o PDF', 'O arquivo não foi anexado ao artigo.', err));
    }
  };

  const chooseFile = async () => {
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) await upload(filePath);
    } catch (err) {
      await inform(failureNotice('Não conseguimos enviar o PDF', 'O arquivo não foi anexado ao artigo.', err));
    }
  };

  const link = async (filePath: string) => {
    try {
      await projectService.linkPdfToArticle(articleId, filePath);
      attached();
    } catch (err) {
      await inform(failureNotice('Não conseguimos vincular o PDF', 'O PDF escolhido não foi ligado ao artigo.', err));
    }
  };

  const findOpenAccess = async () => {
    setSearching(true);
    try {
      const outcome = await projectService.fetchOpenAccessPdf(articleId);
      if (outcome.status === 'downloaded') return attached();
      await inform({ title: 'Acesso aberto', message: openAccessMessage(outcome).text });
    } catch (err) {
      await inform(failureNotice('Não conseguimos procurar o PDF', 'A busca em acesso aberto não terminou.', err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal label="PDF do artigo" title="PDF do artigo" onClose={onClose} width={400} busy={searching}>
      {view === 'library' ? (
        <PdfLibraryPicker onLink={link} onBack={() => setView('options')} />
      ) : (
        <div className="attach-pdf">
          <PdfDropZone
            onPick={upload}
            onChoose={chooseFile}
            disabled={searching}
            onRejected={() => inform({ title: 'Arquivo inválido', message: 'Solte um arquivo PDF.' })}
          />
          <div className="attach-pdf__or">ou</div>
          <Button fill="block" onClick={findOpenAccess} disabled={searching}>
            <Download size={16} aria-hidden="true" /> {searching ? 'Procurando...' : 'Buscar em acesso aberto'}
          </Button>
          <Button variant="ghost" fill="block" onClick={() => setView('library')} disabled={searching}>
            <Link2 size={16} aria-hidden="true" /> Usar um PDF da biblioteca
          </Button>
        </div>
      )}
    </Modal>
  );
};
