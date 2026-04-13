import React from 'react';

import { Checkbox } from '../../atoms/Checkbox';
import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Popover } from '../../molecules/Popover';

import type { ColumnOption } from './DataTable.types';

interface ColumnManagerProps {
  columnOptions: ColumnOption[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  label?: string;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  label = 'Columns',
}) => {
  const trigger = (
    <IconButton variant="ghost" title={label}>
      <Icon name="view-list" size={20} />
    </IconButton>
  );

  const content = (
    <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {columnOptions.map((opt) => (
        <Checkbox
          key={opt.key}
          label={opt.label}
          checked={visibleColumnKeys.includes(opt.key)}
          onChange={() => onToggleColumn(opt.key)}
          disabled={opt.alwaysVisible}
        />
      ))}
    </div>
  );

  return <Popover trigger={trigger} content={content} />;
};

ColumnManager.displayName = 'ColumnManager';
