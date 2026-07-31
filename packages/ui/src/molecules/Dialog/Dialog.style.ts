import styled from '@emotion/styled';

import { Modal } from '../../atoms/Modal';
import { Text as UIText } from '../../atoms/Text';
import { tkn } from '../../theme/tkn';

/**
 * Horizontal rectangle (wider than tall) — not square.
 * Overrides Modal size max-width so the dialog can sit ~24rem wide.
 * Responsive: shrinks to viewport on small screens.
 */
export const Shell = styled(Modal)`
  width: min(24rem, calc(100vw - ${tkn('spacing.xl')}));
  max-width: min(24rem, calc(100vw - ${tkn('spacing.xl')})) !important;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('shadows.xl')};
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* Padding (xl/lg/xl = 32/24/32px). */
  padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  gap: 0;
  box-sizing: border-box;
  min-width: 0;

  @media (max-width: 30rem) {
    padding: ${tkn('spacing.lg')} ${tkn('spacing.md')} ${tkn('spacing.lg')};
  }
`;

/**
 * Solid filled circle; icon is white on top.
 * Color by dialog type:
 *   success → green, error → red, warning → red (cautionary = red per design),
 *   info → brand blue (primary)
 */
export const IconCircle = styled.div<{ $type: string }>`
  /* Icon disc (4rem = 64px). */
  width: 4rem;
  height: 4rem;
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: ${tkn('spacing.lg')};
  background-color: ${({ theme, $type }) => {
    switch ($type) {
      case 'success':
        return theme.colors.semantic.success;
      case 'error':
        return theme.colors.semantic.error;
      case 'warning':
        return theme.colors.semantic.error;
      case 'info':
      default:
        return theme.colors.brand.primary;
    }
  }};
  color: ${tkn('colors.text.inverse')};

  /* Ensure stroke icons read as solid white glyphs on the filled disc */
  svg {
    color: ${tkn('colors.text.inverse')};
    stroke: ${tkn('colors.text.inverse')};
  }

  @media (max-width: 30rem) {
    width: 3.25rem;
    height: 3.25rem;
  }
`;

export const Title = styled(UIText)`
  margin: 0 0 ${tkn('spacing.sm')};
  max-width: 100%;
  line-height: ${tkn('typography.lineHeight.tight')};
  /* Headline (xxl = 24px). */
  font-size: ${tkn('typography.fontSize.xxl')};

  @media (max-width: 30rem) {
    font-size: ${tkn('typography.fontSize.xl')};
  }
`;

export const Description = styled.div`
  margin: 0 0 ${tkn('spacing.lg')};
  max-width: 100%;
  width: 100%;
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.base')};
  font-family: ${tkn('typography.fontFamily.body')};
  text-align: center;
`;

export const BodySlot = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.xl')};
  text-align: left;
`;

export const ButtonStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  & > button {
    width: 100%;
    /* Buttons (controls.height.medium = 44px). */
    min-height: ${tkn('controls.height.medium')};
    border-radius: ${tkn('radius.md')};
  }

  @media (max-width: 30rem) {
    & > button {
      min-height: ${tkn('controls.height.medium')};
    }
  }
`;
