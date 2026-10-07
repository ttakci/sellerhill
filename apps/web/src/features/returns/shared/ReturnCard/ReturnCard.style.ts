import { css, type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/** The card surface itself comes from `Card`; only layout and the click affordance are added here. */
export const Wrapper = styled(Card)<{ $clickable: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;

  ${({ $clickable, theme }: { theme: Theme; $clickable: boolean }) =>
    $clickable &&
    css`
      cursor: pointer;

      &:hover {
        box-shadow: ${theme.shadows.glassHover};
        transform: translateY(-0.125rem);
      }

      &:focus-visible {
        outline: 0.125rem solid ${theme.colors.brand.primary};
        outline-offset: 0.125rem;
      }
    `}
`;

/** Top pane — same anatomy as ListingCard / OrderCard: badge -> title -> photo + facts. */
export const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

/** Badge row — left-aligned, wrapping (solid koyu zemin / beyaz font). */
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -2;
  }
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Block host for the tooltip so the title can shrink and truncate. */
export const TitleSlot = styled.div`
  display: flex;
  flex: 1 1 12rem;
  min-width: 0;

  & > * {
    min-width: 0;
    max-width: 100%;
  }
`;

/** Two lines, ellipsis — the full title is on the tooltip. */
export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  min-width: 0;
`;

export const Body = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
  flex: 1;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: contents;
  }
`;

/** Transparent shell — same treatment as the product cell and the order card (no grey plate). */
export const Image = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  border-radius: ${tkn('radius.sm')};
  width: 9rem;
  height: 9rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -1;
    width: 100%;
    height: 10rem;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
  padding-inline-start: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding-inline-start: 0;
  }
`;

/** Label / value pairs, no icons — the label column is the only ornament. */
export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: ${tkn('spacing.2xs')} 0 0;
  min-width: 0;
`;

export const MetaLabel = styled.dt`
  margin: 0;
  white-space: nowrap;
`;

export const MetaValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  a {
    max-width: 100%;
    overflow: hidden;
  }

  /* Every value reads bold, including badges. */
  && * {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

/** The buyer's own words — two lines, the full text on the tooltip. */
export const Comment = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  margin-top: ${tkn('spacing.xs')};
`;

/** Due · refund · opened, under one hairline at the foot of the card. */
export const Facts = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  margin-top: auto;
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
`;

export const Fact = styled.div<{ $wide?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  grid-column: ${({ $wide }) => ($wide ? '1 / -1' : 'auto')};
`;

export const FactLabel = styled(Text)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;
