import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { ScientificVenue, ScientificMilestone, MilestoneStatus } from '../../types';

interface DeadlineBannerProps {
  venues: ScientificVenue[];
  onToggleMilestoneStatus: (milestoneId: number, status: MilestoneStatus) => void;
  onOpenAgenda: () => void;
}

interface DeadlineItem {
  venue: ScientificVenue;
  milestone: ScientificMilestone;
  effectiveDate: string;
  daysDiff: number;
}

export const DeadlineBanner: React.FC<DeadlineBannerProps> = ({
  venues,
  onToggleMilestoneStatus,
  onOpenAgenda,
}) => {
  const [localVenues, setLocalVenues] = useState<ScientificVenue[]>(venues);

  useEffect(() => {
    setLocalVenues(venues);
  }, [venues]);

  const handleToggle = (milestoneId: number, currentStatus: MilestoneStatus) => {
    const nextStatus: MilestoneStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    // Optimistic update
    setLocalVenues((prev) =>
      prev.map((v) => ({
        ...v,
        milestones: (v.milestones || []).map((m) =>
          m.id === milestoneId ? { ...m, status: nextStatus } : m,
        ),
      })),
    );

    onToggleMilestoneStatus(milestoneId, nextStatus);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();

  const deadlineItems: DeadlineItem[] = [];

  for (const v of localVenues) {
    for (const m of v.milestones || []) {
      if (m.status === 'completed') continue;

      // Rule: For range milestones, deadline calculations are based on end_date!
      const effectiveDate = m.field_type === 'range' && m.end_date ? m.end_date : m.target_date;
      if (!effectiveDate) continue;

      const targetMs = new Date(effectiveDate).getTime();
      const daysDiff = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));

      // Show upcoming/due milestones (up to 60 days out or overdue)
      deadlineItems.push({
        venue: v,
        milestone: m,
        effectiveDate,
        daysDiff,
      });
    }
  }

  deadlineItems.sort((a, b) => a.daysDiff - b.daysDiff);
  const displayItems = deadlineItems.slice(0, 4);

  if (displayItems.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="var(--color-primary)" />
          <span>Nenhum prazo pendente para os próximos dias.</span>
        </div>
        <button
          type="button"
          onClick={onOpenAgenda}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          Ver Agenda <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Próximos Prazos
        </span>
        <button
          type="button"
          onClick={onOpenAgenda}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          Ver Todos <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {displayItems.map(({ venue, milestone, daysDiff }) => {
          const isOverdue = daysDiff < 0;
          const isUrgent = daysDiff >= 0 && daysDiff <= 7;

          let badgeBg = 'rgba(59, 130, 246, 0.1)';
          let badgeColor = '#3b82f6';
          let badgeText = `Em ${daysDiff} dias`;

          if (daysDiff === 0) {
            badgeBg = 'rgba(245, 158, 11, 0.15)';
            badgeColor = '#f59e0b';
            badgeText = 'Hoje!';
          } else if (isOverdue) {
            badgeBg = 'rgba(239, 68, 68, 0.15)';
            badgeColor = '#ef4444';
            badgeText = `Venceu há ${Math.abs(daysDiff)} d`;
          } else if (isUrgent) {
            badgeBg = 'rgba(245, 158, 11, 0.15)';
            badgeColor = '#f59e0b';
            badgeText = `Em ${daysDiff} dias`;
          }

          return (
            <div
              key={milestone.id || `${venue.id}-${milestone.label}`}
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    backgroundColor: venue.color ? `${venue.color}22` : 'rgba(59, 130, 246, 0.15)',
                    color: venue.color || '#3b82f6',
                  }}
                >
                  {venue.acronym || venue.title}
                </span>

                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                  }}
                >
                  {badgeText}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={milestone.status === 'completed'}
                  onChange={() => milestone.id && handleToggle(milestone.id, milestone.status)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {milestone.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Calendar size={13} />
                <span>
                  {milestone.target_date}
                  {milestone.end_date ? ` a ${milestone.end_date}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
