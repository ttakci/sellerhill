import styled from '@emotion/styled';
import { glassSurface, Text as UIText, tkn } from '@repo/ui';

import type { ReturnHistoryActor } from '../returns.types';

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

export const PaneHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** The status pane's headline: badge on top, then what is due and by when. */
export const StatusStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  align-items: flex-start;
`;

export const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

export const Product = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** Transparent shell, like the product cell — no grey plate. */
export const Image = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  width: 4.5rem;
  height: 4.5rem;
  background: transparent;
  border-radius: ${tkn('radius.md')};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

export const ProductText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  flex: 1 1 auto;
`;

export const Title = styled(UIText)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`;

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
export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

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
