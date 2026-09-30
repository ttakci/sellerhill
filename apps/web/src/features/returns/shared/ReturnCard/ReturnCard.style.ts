import { css, type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/** The card surface itself comes from `Card`; only layout and the click affordance are added here. */
export const Wrapper = styled(Card)<{ $clickable: boolean }>`
  gap: ${tkn('spacing.md')};
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;

  ${({ $clickable, theme }: { theme: Theme; $clickable: boolean }) =>
    $clickable &&
    css`
      cursor: pointer;

      &:hover {
        border-color: ${theme.colors.brand.primary};
        box-shadow: ${theme.shadows.md};
      }

      &:focus-visible {
        outline: 0.125rem solid ${theme.colors.brand.primary};
        outline-offset: 0.125rem;
      }
    `}
`;

export const Header = styled.div`
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
  margin-bottom: ${tkn('spacing.2xs')};

  /* Title and badge cannot share ~200px: the badge drops under the title. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
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

export const Facts = styled.div`
  display: grid;
  /* Reflows to two rows before a value truncates — never a fixed repeat(3, 1fr). */
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
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
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const Reason = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** The buyer's own words — two lines, the full text on the tooltip. */
export const Comment = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`;

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
`;

export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;
