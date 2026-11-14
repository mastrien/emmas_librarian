import React from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '../../common/Button';
import { ModalFooter } from '../../common/ModalFooter';

interface MassCitationFooterProps {
  copied: boolean;
  canCopy: boolean;
  onCopy: () => void;
  /** Offered with BibTeX only: the references as a .bib file to import in a reference manager. */
  onDownloadBib?: () => void;
}

/**
 * The bottom bar of the mass citation window (board 177): "Baixar .bib" while BibTeX is chosen, and "Copiar tudo",
 * which turns green for two seconds after copying.
 *
 * @example <MassCitationFooter copied={false} canCopy onCopy={copyAll} onDownloadBib={saveBib} />
 */
export const MassCitationFooter: React.FC<MassCitationFooterProps> = ({ copied, canCopy, onCopy, onDownloadBib }) => (
  <ModalFooter>
    {onDownloadBib && (
      <Button onClick={onDownloadBib} disabled={!canCopy}>
        <Download size={16} aria-hidden="true" /> Baixar .bib
      </Button>
    )}
    <Button variant="primary" className={copied ? 'app-modal-copied' : undefined} onClick={onCopy} disabled={!canCopy}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {copied ? 'Copiado!' : 'Copiar tudo'}
    </Button>
  </ModalFooter>
);
