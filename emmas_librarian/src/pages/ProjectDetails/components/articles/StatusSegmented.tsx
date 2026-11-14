import React from 'react';
import { SegmentedControl } from '../../../../components/common/SegmentedControl';
import { STATUS_LABELS, type StatusFilter } from '../../hooks/articleFilters';
import type { CountFor } from './filterGroups';

const ORDER = Object.keys(STATUS_LABELS) as StatusFilter[];

/**
 * Todos / Ativos / Lidos / Arquivados with their counts (board 153): one list where the read and archived
 * articles used to sit in collapsible sections below the table.
 *
 * @example <StatusSegmented value="new" onChange={(s) => apply({ statusFilter: s })} countFor={countFor} />
 */
export const StatusSegmented: React.FC<{
  value: StatusFilter;
  onChange: (status: StatusFilter) => void;
  countFor: CountFor;
}> = ({ value, onChange, countFor }) => (
  <SegmentedControl
    label="Status dos artigos"
    value={value}
    onChange={onChange}
    options={ORDER.map((status) => ({
      value: status,
      label: (
        <>
          {STATUS_LABELS[status]} <span className="segmented-option__count">{countFor({ statusFilter: status })}</span>
        </>
      ),
    }))}
  />
);
