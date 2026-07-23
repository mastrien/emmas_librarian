import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { ScientificVenue, ScientificMilestone, VenueCategory, MilestoneFieldType } from '../../types';

interface VenueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (venueData: Omit<ScientificVenue, 'id' | 'created_at'>) => void;
  initialData?: ScientificVenue | null;
  initialDate?: string | null;
}

const CATEGORY_OPTIONS: { value: VenueCategory; label: string }[] = [
  { value: 'conference', label: 'Congresso / Conferência' },
  { value: 'journal', label: 'Periódico / Revista' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'symposium', label: 'Simpósio' },
  { value: 'other', label: 'Outro Evento' },
];

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const VenueFormModal: React.FC<VenueFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [acronym, setAcronym] = useState('');
  const [category, setCategory] = useState<VenueCategory>('conference');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form milestones
  const [milestones, setMilestones] = useState<ScientificMilestone[]>([]);

  // Inline custom field creation state (No prompt)
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState<MilestoneFieldType>('single');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setAcronym(initialData.acronym || '');
      setCategory(initialData.category || 'conference');
      setUrl(initialData.url || '');
      setColor(initialData.color || '#3b82f6');
      setMilestones(
        (initialData.milestones || []).map((m) => ({
          ...m,
          end_date: m.end_date || '',
          target_time: m.target_time || '',
        })),
      );
    } else {
      setTitle('');
      setAcronym('');
      setCategory('conference');
      setUrl('');
      setColor('#3b82f6');
      const defaultDate = initialDate || new Date().toISOString().split('T')[0];
      setMilestones([
        { label: 'Inscrição', field_type: 'single', target_date: defaultDate, has_time: false, status: 'pending' },
        { label: 'Submissão', field_type: 'range', target_date: defaultDate, end_date: '', has_time: false, status: 'pending' },
        { label: 'Apresentação', field_type: 'single', target_date: defaultDate, has_time: false, status: 'pending' },
      ]);
    }
    setShowAddCustom(false);
    setCustomLabel('');
    setCustomType('single');
    setErrorMsg(null);
  }, [initialData, initialDate, isOpen]);

  if (!isOpen) return null;

  const handleUpdateMilestone = (index: number, fields: Partial<ScientificMilestone>) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...fields };
      return copy;
    });
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmCustomField = () => {
    if (!customLabel.trim()) {
      setErrorMsg('Informe o nome do novo campo/prazo.');
      return;
    }
    const defaultDate = initialDate || new Date().toISOString().split('T')[0];
    setMilestones((prev) => [
      ...prev,
      {
        label: customLabel.trim(),
        field_type: customType,
        target_date: defaultDate,
        end_date: customType === 'range' ? defaultDate : '',
        has_time: false,
        status: 'pending',
      },
    ]);
    setCustomLabel('');
    setCustomType('single');
    setShowAddCustom(false);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('O título do evento/periódico é obrigatório.');
      return;
    }

    const validMilestones = milestones.filter((m) => m.label.trim() && m.target_date.trim());
    if (validMilestones.length === 0) {
      setErrorMsg('Adicione e preencha pelo menos um prazo válido para o evento.');
      return;
    }

    // Validate date ranges
    for (const m of validMilestones) {
      if (m.field_type === 'range' && m.end_date) {
        if (m.end_date < m.target_date) {
          setErrorMsg(`No prazo "${m.label}", a data final não pode ser anterior à data inicial.`);
          return;
        }
      }
    }

    onSave({
      title: title.trim(),
      acronym: acronym.trim() || undefined,
      category,
      url: url.trim() || undefined,
      color,
      milestones: validMilestones.map((m) => ({
        ...m,
        end_date: m.field_type === 'range' && m.end_date ? m.end_date : undefined,
        has_time: m.field_type === 'single' ? m.has_time : false,
        target_time: m.field_type === 'single' && m.has_time ? m.target_time : undefined,
      })),
    });
    onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        overflow: 'hidden',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={20} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              {initialData ? 'Editar Evento / Periódico' : 'Novo Evento / Periódico'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem',
            }}
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div
            className="modal-body"
            style={{
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              flex: 1,
            }}
          >
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--color-error)',
                  color: 'var(--color-error)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Informações Básicas do Evento */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Título / Nome do Evento *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Simpósio Brasileiro de BD"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Sigla
                </label>
                <input
                  type="text"
                  value={acronym}
                  onChange={(e) => setAcronym(e.target.value)}
                  placeholder="Ex: SBBD 2026"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VenueCategory)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Cor do Emblema
                </label>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', paddingTop: '0.25rem' }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: color === c ? '2px solid var(--text-heading)' : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Link / URL da Chamada
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                }}
              />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

            {/* Lista Dinâmica de Prazos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  Prazos e Datas Associadas
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={14} /> Criar Novo Campo
                </button>
              </div>

              {/* Form Inline para Adicionar Campo Customizado */}
              {showAddCustom && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                    Novo Campo Personalizado
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Ex: Avaliação de Pares / Câmera Ready"
                      style={{
                        padding: '0.4rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="fieldType"
                          checked={customType === 'single'}
                          onChange={() => setCustomType('single')}
                        />
                        Pontual
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="fieldType"
                          checked={customType === 'range'}
                          onChange={() => setCustomType('range')}
                        />
                        Intervalo
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddCustom(false)}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCustomField}
                      className="btn-primary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      Confirmar Campo
                    </button>
                  </div>
                </div>
              )}

              {/* Itens de Prazo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <input
                        type="text"
                        value={m.label}
                        onChange={(e) => handleUpdateMilestone(idx, { label: e.target.value })}
                        style={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed var(--border-color)',
                          color: 'var(--text-heading)',
                          padding: '0.1rem 0.2rem',
                          width: '65%',
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: m.field_type === 'range' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: m.field_type === 'range' ? '#8b5cf6' : '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {m.field_type === 'range' ? 'Intervalo' : 'Pontual'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          title="Remover campo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                      {m.field_type === 'range' ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>De:</span>
                            <input
                              type="date"
                              value={m.target_date}
                              onChange={(e) => handleUpdateMilestone(idx, { target_date: e.target.value })}
                              style={{
                                padding: '0.3rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Até:</span>
                            <input
                              type="date"
                              value={m.end_date || ''}
                              onChange={(e) => handleUpdateMilestone(idx, { end_date: e.target.value })}
                              style={{
                                padding: '0.3rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data:</span>
                            <input
                              type="date"
                              value={m.target_date}
                              onChange={(e) => handleUpdateMilestone(idx, { target_date: e.target.value })}
                              style={{
                                padding: '0.3rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                              }}
                            />
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', marginLeft: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={m.has_time}
                              onChange={(e) => handleUpdateMilestone(idx, { has_time: e.target.checked })}
                            />
                            <Clock size={13} /> Incluir horário
                          </label>

                          {m.has_time && (
                            <input
                              type="time"
                              value={m.target_time || ''}
                              onChange={(e) => handleUpdateMilestone(idx, { target_time: e.target.value })}
                              style={{
                                padding: '0.3rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar Evento
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
