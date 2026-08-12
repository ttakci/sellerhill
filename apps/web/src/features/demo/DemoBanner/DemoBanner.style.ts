import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * Floats at the bottom centre rather than pushing a bar into the layout: the
 * demo renders the real app shell, and a banner that reflowed it would make
 * every screen slightly wrong compared with the product it is advertising.
 */
export const Bar = styled.div`
  position: fixed;
  left: 50%;
  bottom: ${tkn('spacing.lg')};
  transform: translateX(-50%);
  z-index: ${tkn('zIndex.toast')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  max-width: calc(100vw - 2rem);
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('shadows.xl')};

  @media (max-width: 48rem) {
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
  }
`;

export const Marker = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
`;

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;
