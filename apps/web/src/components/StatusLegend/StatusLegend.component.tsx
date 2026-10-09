import { Badge, Button, Icon, Text } from '@repo/ui';
import React from 'react';

import * as S from './StatusLegend.style';
import type { StatusLegendViewProps } from './StatusLegend.types';

/**
 * The returns / cancellations twin of the orders' status legend: a toggle at the
 * end of the tab row that opens a full-width pane listing each status badge with
 * what it means.
 */
export const StatusLegendComponent: React.FC<StatusLegendViewProps> = ({
  rows,
  title,
  openLabel,
  columnStatus,
  columnMeaning,
  isOpen,
  onToggle,
}) => (
  <>
    <Button variant="text" size="small" onClick={onToggle} aria-expanded={isOpen} aria-label={openLabel}>
      <Icon name="info" size={16} color="brand.primary" />
      <Text variant="body-sm" weight="semibold" color="brand.primary">
        {title}
      </Text>
      <S.Chevron $isOpen={isOpen}>
        <Icon name="chevron-down" size={16} color="brand.primary" />
      </S.Chevron>
    </Button>
    {isOpen && (
      <S.Panel>
        <S.Grid>
          <Text variant="caption" color="text.tertiary">
            {columnStatus}
          </Text>
          <S.HeaderCell>
            <Text variant="caption" color="text.tertiary">
              {columnMeaning}
            </Text>
          </S.HeaderCell>
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <S.BadgeCell>
                <Badge variant={row.variant} size="sm" solid>
                  <S.BadgeInner>
                    <Icon name={row.icon} size={12} />
                    {row.label}
                  </S.BadgeInner>
                </Badge>
              </S.BadgeCell>
              <Text variant="body-sm">{row.meaning}</Text>
            </React.Fragment>
          ))}
        </S.Grid>
      </S.Panel>
    )}
  </>
);
