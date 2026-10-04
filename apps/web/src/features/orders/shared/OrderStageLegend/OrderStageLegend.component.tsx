import { Button, Icon, Text } from '@repo/ui';
import React from 'react';

import { OrderStageBadge } from '../OrderStageBadge';

import * as S from './OrderStageLegend.style';
import type { OrderStageLegendViewProps } from './OrderStageLegend.types';

/**
 * An in-page disclosure, like the listings' advanced filters: the toggle sits at
 * the end of the tab row and the panel opens right under it, full width, so the
 * eleven rows of prose read in place instead of behind a modal.
 */
export const OrderStageLegendComponent: React.FC<OrderStageLegendViewProps> = ({
  rows,
  title,
  openLabel,
  columnStage,
  columnMeaning,
  columnAction,
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
            {columnStage}
          </Text>
          <S.HeaderCell variant="caption" color="text.tertiary">
            {columnMeaning}
          </S.HeaderCell>
          <S.HeaderCell variant="caption" color="text.tertiary">
            {columnAction}
          </S.HeaderCell>
          {rows.map((row) => (
            <React.Fragment key={row.stage}>
              <S.BadgeCell>
                <OrderStageBadge stage={row.stage} size="sm" withTooltip={false} />
              </S.BadgeCell>
              <Text variant="body-sm">{row.meaning}</Text>
              <Text variant="body-sm" color="text.secondary">
                {row.action ?? '—'}
              </Text>
            </React.Fragment>
          ))}
        </S.Grid>
      </S.Panel>
    )}
  </>
);
