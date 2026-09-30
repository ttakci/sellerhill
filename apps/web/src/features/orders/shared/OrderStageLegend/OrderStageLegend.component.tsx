import { Icon, IconButton, Modal, Text } from '@repo/ui';
import React from 'react';

import { OrderStageBadge } from '../OrderStageBadge';

import * as S from './OrderStageLegend.style';
import type { OrderStageLegendViewProps } from './OrderStageLegend.types';

/**
 * A Modal, not a Popover: the trigger sits at the far right of the tab row,
 * where a centred popover ran off the viewport, and the legend is a reading
 * surface (eleven rows of prose) that needs focus, a close control and the
 * design system's own phone layout.
 */
export const OrderStageLegendComponent: React.FC<OrderStageLegendViewProps> = ({
  rows,
  title,
  openLabel,
  columnStage,
  columnMeaning,
  columnAction,
  isOpen,
  onOpen,
  onClose,
}) => (
  <>
    <IconButton variant="ghost" aria-label={openLabel} title={openLabel} aria-expanded={isOpen} onClick={onOpen}>
      <Icon name="info" size={16} />
    </IconButton>
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
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
            <OrderStageBadge stage={row.stage} size="sm" withTooltip={false} />
            <Text variant="body-sm">{row.meaning}</Text>
            <Text variant="body-sm" color="text.secondary">
              {row.action ?? '—'}
            </Text>
          </React.Fragment>
        ))}
      </S.Grid>
    </Modal>
  </>
);
