import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, CheckCircle2, Circle, Clock, ExternalLink, Edit2, Trash2, Tag, ChevronRight } from 'lucide-react';
import { ScientificVenue, ScientificMilestone, VenueCategory, MilestoneStatus } from '../../types';
import { DashboardCalendar } from './DashboardCalendar';

interface ScientificAgendaViewProps {
  venues: ScientificVenue[];
  diarySet: Set<string>;
  onAddVenue: (dateStr?: string) => void;
  onEditVenue: (venue: ScientificVenue) => void;
  onDeleteVenue: (id: number) => void;
  onToggleMilestoneStatus: (milestoneId: number, status: MilestoneStatus) => Promise<boolean>;
}

const CATEGORY_LABELS: Record<VenueCategory, string> = {
  conference: 'Congresso',
  journal: 'Periódico',
  workshop: 'Workshop',
  symposium: 'Simpósio',
  other: 'Outros',
};

export const ScientificAgendaView: React.FC<ScientificAgendaViewProps> = ({
  venues,
  diarySet,
  onAddVenue,
  onEditVenue,
  onDeleteVenue,
  onToggleMilestoneStatus,
}) => {
  const [viewMode, setViewMode] = useState<'venue_cards' | 'milestone_list'>('venue_cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Local state for optimistic updates to prevent full-page redraws on status toggle
  const [localVenues, setLocalVenues] = useState<ScientificVenue[]>(venues);

  useEffect(() => {
    setLocalVenues(venues);
  }, [venues]);

  const handleToggleStatus = async (milestoneId: number, currentStatus: MilestoneStatus) => {
    const newStatus: MilestoneStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    // Optimistic local update
    setLocalVenues((prevVenues) =>
      prevVenues.map((v) => ({
        ...v,
        milestones: (v.milestones || []).map((m) =>
          m.id === milestoneId ? { ...m, status: newStatus } : m,
        ),
      })),
    );

    try {
      await onToggleMilestoneStatus(milestoneId, newStatus);
    } catch (err) {
      // Rollback on failure
      setLocalVenues(venues);
    }
  };

  const filteredVenues = localVenues.filter((v) => {
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = v.title.toLowerCase().includes(q) || (v.acronym && v.acronym.toLowerCase().includes(q));
      const matchMilestone = (v.milestones || []).some((m) => m.label.toLowerCase().includes(q));
      if (!matchTitle && !matchMilestone) return false;
    }
    return true;
  });

  const allMilestonesWithVenue = filteredVenues.flatMap((v) =>
    (v.milestones || [])
      .filter((m) => selectedStatus === 'all' || m.status === selectedStatus)
      .map((m) => ({ milestone: m, venue: v })),
  ).sort((a, b) => a.milestone.target_date.localeCompare(b.milestone.target_date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CalendarIcon size={24} color="var(--color-primary)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              Agenda
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Gerencie seus eventos, prazos e chamadas de periódicos.
            </p>
          </div>
        </div>

        {/* Action Controls: Unified Pill + Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Unified Pill Segmented Control (Height: 38px, single container) */}
          <div
            style={{
              height: '38px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '2px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('venue_cards')}
              style={{
                height: '100%',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                padding: '0 0.85rem',
                fontSize: '0.85rem',
                fontWeight: viewMode === 'venue_cards' ? 600 : 500,
                backgroundColor: viewMode === 'venue_cards' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'venue_cards' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Por Evento/Revista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('milestone_list')}
              style={{
                height: '100%',
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                padding: '0 0.85rem',
                fontSize: '0.85rem',
                fontWeight: viewMode === 'milestone_list' ? 600 : 500,
                backgroundColor: viewMode === 'milestone_list' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'milestone_list' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Lista de Prazos
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAddVenue()}
            className="btn-primary"
            style={{
              height: '38px',
              padding: '0 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> Novo Evento
          </button>
        </div>
      </div>

      {/* Grid: Main Content + Side Calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Search & Filters Bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              backgroundColor: 'var(--bg-surface)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '200px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por evento, sigla ou prazo..."
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">Todas as Categorias</option>
              <option value="conference">Congresso</option>
              <option value="journal">Periódico</option>
              <option value="workshop">Workshop</option>
              <option value="symposium">Simpósio</option>
              <option value="other">Outros</option>
            </select>

            {viewMode === 'milestone_list' && (
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Prazos Pendentes</option>
                <option value="completed">Concluídos</option>
              </select>
            )}
          </div>

          {/* Cards View */}
          {viewMode === 'venue_cards' ? (
            filteredVenues.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Nenhum evento ou periódico encontrado.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                {filteredVenues.map((v) => (
                  <div
                    key={v.id}
                    className="glass-panel"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-color)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: v.color || '#3b82f6',
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {CATEGORY_LABELS[v.category]}
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {v.acronym ? `${v.acronym} — ${v.title}` : v.title}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {v.url && (
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', padding: '0.2rem' }}
                            title="Abrir URL do Evento"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditVenue(v)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                          title="Editar Evento"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteVenue(v.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                          title="Excluir Evento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(v.milestones || []).map((m) => {
                        const isDone = m.status === 'completed';
                        return (
                          <div
                            key={m.id || m.label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.6rem',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--bg-main)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => m.id && handleToggleStatus(m.id, m.status)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 500,
                                  textDecoration: isDone ? 'line-through' : 'none',
                                  color: isDone ? 'var(--text-muted)' : 'var(--text-main)',
                                }}
                              >
                                {m.label}
                              </span>
                            </div>

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {m.field_type === 'range' && m.end_date
                                ? `${m.target_date} a ${m.end_date}`
                                : `${m.target_date}${m.has_time && m.target_time ? ` ${m.target_time}` : ''}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Milestone List View */
            allMilestonesWithVenue.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Nenhum prazo cadastrado.
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                {allMilestonesWithVenue.map(({ milestone: m, venue: v }) => {
                  const isDone = m.status === 'completed';
                  return (
                    <div
                      key={m.id || `${v.id}-${m.label}`}
                      style={{
                        padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDone ? 'rgba(0,0,0,0.02)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => m.id && handleToggleStatus(m.id, m.status)}
                          style={{ cursor: 'pointer' }}
                        />

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isDone ? 'var(--text-muted)' : 'var(--text-heading)' }}>
                              {m.label}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: v.color ? `${v.color}22` : 'rgba(59, 130, 246, 0.15)',
                                color: v.color || '#3b82f6',
                                fontWeight: 600,
                              }}
                            >
                              {v.acronym || v.title}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {v.title}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace', color: isDone ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        {m.field_type === 'range' && m.end_date
                          ? `${m.target_date} a ${m.end_date}`
                          : `${m.target_date}${m.has_time && m.target_time ? ` às ${m.target_time}` : ''}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Side Monthly Calendar Widget */}
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <DashboardCalendar
            diarySet={diarySet}
            venues={localVenues}
            onAddVenue={onAddVenue}
            onOpenAgenda={() => {}}
            onSelectDate={(dStr) => onAddVenue(dStr)}
          />
        </div>
      </div>
    </div>
  );
};
