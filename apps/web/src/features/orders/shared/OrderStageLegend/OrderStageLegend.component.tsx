import { Icon, IconButton, Popover, Text } from '@repo/ui';
import React from 'react';

import { OrderStageBadge } from '../OrderStageBadge';

import * as S from './OrderStageLegend.style';
import type { OrderStageLegendViewProps } from './OrderStageLegend.types';

export const OrderStageLegendComponent: React.FC<OrderStageLegendViewProps> = ({
  rows,
  title,
  openLabel,
  columnStage,
  columnMeaning,
  columnAction,
}) => (
  <Popover
    trigger={
      <IconButton variant="ghost" aria-label={openLabel} title={openLabel}>
        <Icon name="info" size={16} />
      </IconButton>
    }
    content={
      <S.Panel role="dialog" aria-label={title}>
        <Text variant="h5">{title}</Text>
        <S.Grid>
          <Text variant="caption" color="text.tertiary">
            {columnStage}
          </Text>
          <Text variant="caption" color="text.tertiary">
            {columnMeaning}
          </Text>
          <Text variant="caption" color="text.tertiary">
            {columnAction}
          </Text>
          {rows.map((row) => (
            <React.Fragment key={row.stage}>
              <OrderStageBadge stage={row.stage} size="sm" withTooltip={false} />
              <Text variant="body-sm">{row.meaning}</Text>
              <Text variant="body-sm" color="text.secondary">
                {row.action ?? '—'}
              </Text>
            </React.Fragment>
          ))}
        </S.Grid>
      </S.Panel>
    }
  />
);
