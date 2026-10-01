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

/** Title row across the whole width, then ids on the left with the photo at rest on the right — the OrderCard anatomy. */
export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  padding: ${tkn('spacing.md+')} ${tkn('spacing.md+')} 0;
`;

export const HeaderBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** Transparent shell — same treatment as the product cell and the order card (no grey plate). */
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

  svg {
    color: ${tkn('colors.text.disabled')};
  }
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1;
  min-width: 0;
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

/** Muted label + value on one line (return id, order id, reason). */
export const IdRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Due · refund · opened, under one hairline at the foot of the card. */
export const Facts = styled.div`
  display: grid;
  /* Reflows to two rows before a value truncates — never a fixed repeat(3, 1fr). */
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
  /* "What is due" is a sentence, not a figure: it takes the whole first row. */
  grid-column: ${({ $wide }) => ($wide ? '1 / -1' : 'auto')};
`;

export const FactLabel = styled(Text)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const Reason = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')} ${tkn('spacing.md+')};
`;

/** The buyer's own words — two lines, the full text on the tooltip. */
export const Comment = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`;

