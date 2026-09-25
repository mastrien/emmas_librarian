import React from 'react';
import { ArrowLeft } from 'lucide-react';

const pulse = (height: string, width: string, radius = 'var(--radius-md)'): React.CSSProperties => ({
  height,
  width,
  backgroundColor: 'var(--bg-surface)',
  borderRadius: radius,
  animation: 'pulse 1.5s infinite ease-in-out',
});

/**
 * Placeholder layout (header, toolbar, tabs, content) shown while the project loads.
 *
 * Usage:
 *   if (loading) return <ProjectDetailsSkeleton />;
 */
export const ProjectDetailsSkeleton: React.FC = () => (
  <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '80vh' }}>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        color: 'var(--text-muted)',
      }}
    >
      <ArrowLeft size={18} /> Voltar para Projetos
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={pulse('38px', '40%')} />
        <div style={pulse('24px', '150px', 'var(--radius-sm)')} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={pulse('40px', '130px')} />
        ))}
      </div>
    </div>
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '0.5rem',
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={pulse('30px', '90px', 'var(--radius-sm)')} />
      ))}
    </div>
    <div style={{ ...pulse('400px', 'auto'), border: '1px solid var(--border-color)' }} />
  </div>
);
