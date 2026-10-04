import React from 'react';

import { Checkbox } from '../../atoms/Checkbox';
import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Popover } from '../../molecules/Popover';

import { ColumnManagerContent, ColumnMoveButtons, ColumnRow } from './DataTable.style';
import type { ColumnOption } from './DataTable.types';

interface ColumnManagerProps {
  columnOptions: ColumnOption[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  onMoveColumn?: (key: string, direction: -1 | 1) => void;
  label?: string;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  onMoveColumn,
  label = 'Columns',
}) => {
  const trigger = (
    <IconButton variant="ghost" title={label}>
      <Icon name="view-list" size={20} />
    </IconButton>
  );

  const content = (
    <ColumnManagerContent>
      {columnOptions.map((opt, index) => (
        <ColumnRow key={opt.key}>
          <Checkbox
            label={opt.label}
            checked={visibleColumnKeys.includes(opt.key)}
            onChange={() => onToggleColumn(opt.key)}
            disabled={opt.alwaysVisible}
          />
          {onMoveColumn && !opt.alwaysVisible && (
            <ColumnMoveButtons>
              <IconButton
                variant="ghost"
                disabled={index <= 1}
                onClick={() => onMoveColumn(opt.key, -1)}
                aria-label={`${opt.label} ↑`}
              >
                <Icon name="chevron-up" size={16} />
              </IconButton>
              <IconButton
                variant="ghost"
                disabled={index === columnOptions.length - 1}
                onClick={() => onMoveColumn(opt.key, 1)}
                aria-label={`${opt.label} ↓`}
              >
                <Icon name="chevron-down" size={16} />
              </IconButton>
            </ColumnMoveButtons>
          )}
        </ColumnRow>
      ))}
    </ColumnManagerContent>
  );

  return <Popover trigger={trigger} content={content} />;
};

ColumnManager.displayName = 'ColumnManager';
