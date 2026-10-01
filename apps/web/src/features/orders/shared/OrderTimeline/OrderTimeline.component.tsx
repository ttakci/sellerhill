import { OrderTimelineStepState } from '@repo/shared';
import { Icon, Text } from '@repo/ui';
import React from 'react';

import * as S from './OrderTimeline.style';
import type { OrderTimelineProps } from './OrderTimeline.types';

/** Ink per state: what happened reads normally, the step the order is on is
 *  the loudest row, and what has not happened recedes. */
const LABEL_COLOR: Record<OrderTimelineStepState, string> = {
  [OrderTimelineStepState.DONE]: 'text.primary',
  [OrderTimelineStepState.CURRENT]: 'text.primary',
  [OrderTimelineStepState.ATTENTION]: 'semantic.error',
  [OrderTimelineStepState.UPCOMING]: 'text.tertiary',
  [OrderTimelineStepState.SKIPPED]: 'text.tertiary',
};

const BODY_COLOR: Record<OrderTimelineStepState, string> = {
  [OrderTimelineStepState.DONE]: 'text.secondary',
  [OrderTimelineStepState.CURRENT]: 'text.primary',
  [OrderTimelineStepState.ATTENTION]: 'text.primary',
  [OrderTimelineStepState.UPCOMING]: 'text.tertiary',
  [OrderTimelineStepState.SKIPPED]: 'text.tertiary',
};

/**
 * The order's steps, top to bottom, with a marker rail. Presentation only —
 * every string arrives resolved (`toOrderTimelineRows`).
 */
export const OrderTimeline: React.FC<OrderTimelineProps> = ({ rows }) => (
  <S.List role="list">
    {rows.map((row, index) => {
      const inFocus = row.state === OrderTimelineStepState.CURRENT || row.state === OrderTimelineStepState.ATTENTION;
      const isLast = index === rows.length - 1;
      return (
        <S.Row key={row.id} role="listitem">
          <S.Rail>
            <S.Marker $state={row.state} $small={row.isMessage}>
              <Icon name={row.icon} size={row.isMessage ? 12 : 16} />
            </S.Marker>
            {!isLast && <S.Connector />}
          </S.Rail>
          <S.Head $message={row.isMessage}>
            <Text
              variant={row.isMessage ? 'body-sm' : 'body'}
              weight={inFocus || (!row.isMessage && row.state === OrderTimelineStepState.DONE) ? 'semibold' : undefined}
              color={row.isMessage ? 'text.secondary' : LABEL_COLOR[row.state]}
            >
              {row.label}
            </Text>
            {row.reference && (
              <Text variant="mono" color="text.secondary">
                {row.reference}
              </Text>
            )}
          </S.Head>
          <S.When $message={row.isMessage} $empty={!row.dateLabel}>
            <Text variant="body-sm" numeric color={row.dateLabel ? 'text.secondary' : 'text.tertiary'}>
              {row.dateLabel ?? '—'}
            </Text>
          </S.When>
          <S.Body $last={isLast} $message={row.isMessage}>
            <Text variant="body-sm" color={BODY_COLOR[row.state]}>
              {row.description}
            </Text>
            {row.action && (
              <Text variant="body-sm" weight="semibold">
                {row.action}
              </Text>
            )}
            {row.reason && (
              <Text variant="caption" color="text.secondary">
                {row.reason}
              </Text>
            )}
          </S.Body>
        </S.Row>
      );
    })}
  </S.List>
);
