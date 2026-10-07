import styled from '@emotion/styled';
import { glassSurface, Text as UIText, tkn } from '@repo/ui';

import type { ReturnHistoryActor } from '../returns.types';

import { OrderCard } from '@/features/orders/shared/OrderCard';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-height: 100%;
`;

/** One frosted pane per section — the same surface every drawer section uses. */
export const Pane = styled.section`
  ${({ theme }) => glassSurface(theme)}
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  min-width: 0;
`;

/** The status pane's headline: badge on top, then what is due and by when. */
export const StatusStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  align-items: flex-start;
`;

/** Transparent shell, like the product cell — no grey plate. */
/** Label / value rows, no icons (the card anatomy). */
export const Facts = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin: 0;
  min-width: 0;
`;

export const Fact = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const FactLabel = styled.dt`
  margin: 0;
  min-width: 0;
  flex-shrink: 0;
`;

export const FactValue = styled.dd`
  margin: 0;
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
`;

/** Label + id badge under the product title. */
export const Comment = styled(UIText)`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

/** The journey: marker rail + text per step, like the order timeline. */
export const History = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const HistoryRow = styled.li`
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.sm')};
  align-items: start;
  min-width: 0;
`;

export const Rail = styled.div`
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const Marker = styled.span<{ $actor: ReturnHistoryActor }>`
  display: block;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 0.75rem;
  height: 0.75rem;
  margin-top: 0.3125rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $actor, theme }) =>
    $actor === 'buyer'
      ? theme.colors.badge.sky
      : $actor === 'seller'
        ? theme.colors.brand.primary
        : theme.colors.text.tertiary};
`;

export const RailLine = styled.span`
  flex: 1 1 auto;
  width: 0.125rem;
  min-height: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.border.primary')};
`;

export const HistoryText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  padding-bottom: ${tkn('spacing.sm')};
`;

export const HistoryMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  min-width: 0;
`;

export const Shipment = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:first-of-type {
    padding-top: 0;
    border-top: 0;
  }
`;

export const EmptyWrap = styled.div`
  padding: ${tkn('spacing.lg')} 0;
`;

/** Status on the left, eBay's deadline pinned top-right. */
export const StatusHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const Deadline = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  flex-shrink: 0;
`;

/** The answer form under the request's facts, behind one hairline. */
export const AnswerForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px hairline */
`;

/** Accept / Decline side by side, as on eBay's own form (cancellations). */
export const RadioRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  /* Air above and below the choice, so the decline fields do not hug it. */
  padding: ${tkn('spacing.sm')} 0;
`;

export const SendRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

/** The orders list's card, content-high here — in a list it stretches to its row (height: 100%). */
export const OrderCardInDrawer = styled(OrderCard)`
  && {
    height: auto;
    flex-shrink: 0;
  }
`;

/** A return's choices, one per line like eBay's own option list. */
export const RadioList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} 0;
`;

/** The label fields under the "upload a label" choice. */
export const LabelFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;
