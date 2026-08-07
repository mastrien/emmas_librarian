import React from 'react';
import { Download } from 'lucide-react';

export const DashboardDragDropOverlay: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      border: '3px dashed var(--color-primary)',
      pointerEvents: 'none',
    }}
  >
    <Download size={64} color="var(--color-primary)" className="bounce-subtle" />
    <h2 style={{ marginTop: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>
      Solte o arquivo do projeto (.emmapcarc) aqui
    </h2>
    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>
      O projeto será importado automaticamente para a sua biblioteca.
    </p>
  </div>
);
