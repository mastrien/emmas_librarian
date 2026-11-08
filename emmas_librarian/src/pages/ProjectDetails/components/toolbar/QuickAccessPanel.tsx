import React from 'react';
import { ExternalLink, FileIcon, Link as LinkIcon, Settings, Tag } from 'lucide-react';
import type { ProjectDocument } from '../../../../types';
import { groupByCategory } from './quickAccessGroups';

interface QuickAccessPanelProps {
  documents: ProjectDocument[];
  onManage: () => void;
  onOpen: (doc: ProjectDocument) => void;
}

const DocumentButton: React.FC<{ doc: ProjectDocument; onOpen: () => void }> = ({ doc, onOpen }) => (
  <button onClick={onOpen} className="btn-secondary quick-access-doc" title={doc.url || doc.local_file_path}>
    {doc.url ? <ExternalLink size={14} /> : <FileIcon size={14} />}
    {doc.title}
  </button>
);

const DocumentGroups: React.FC<Pick<QuickAccessPanelProps, 'documents' | 'onOpen'>> = ({ documents, onOpen }) => (
  <div className="quick-access-groups">
    {groupByCategory(documents).map(([category, docs]) => (
      <div key={category || 'uncategorized'} className="quick-access-group">
        {category && (
          <div className="quick-access-category">
            <Tag size={12} /> {category}
          </div>
        )}
        <div className="quick-access-docs">
          {docs.map((doc) => (
            <DocumentButton key={doc.id} doc={doc} onOpen={() => onOpen(doc)} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/**
 * The project's quick links and documents, grouped by category, with the gear that manages them.
 *
 * @example <QuickAccessPanel documents={docs} onManage={() => setOpen(true)} onOpen={(d) => open(d)} />
 */
export const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({ documents, onManage, onOpen }) => (
  <div className="quick-access">
    <div className="quick-access-head">
      <h3>
        <LinkIcon size={16} /> Acesso rápido
      </h3>
      <button onClick={onManage} className="quick-access-settings" title="Gerenciar acessos rápidos">
        <Settings size={16} />
      </button>
    </div>
    <div className="quick-access-body">
      {documents.length === 0 ? (
        <div className="quick-access-empty">
          Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.
        </div>
      ) : (
        <DocumentGroups documents={documents} onOpen={onOpen} />
      )}
    </div>
  </div>
);
