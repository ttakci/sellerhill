import styled from '@emotion/styled';

import { Modal } from '../../atoms/Modal';
import { Text as UIText } from '../../atoms/Text';
import { tkn } from '../../theme/tkn';

/**
 * Horizontal rectangle (wider than tall) — not square.
 * Overrides Modal size max-width so the dialog can sit ~28rem wide.
 */
export const Shell = styled(Modal)`
  width: min(28rem, calc(100vw - ${tkn('spacing.xl')}));
  max-width: min(28rem, calc(100vw - ${tkn('spacing.xl')})) !important;
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
  padding: ${tkn('spacing.xl')} ${tkn('spacing.xl')} ${tkn('spacing.lg')};
  gap: 0;
  box-sizing: border-box;
  min-width: 0;
`;

/** Solid filled circle; icon is white on top */
export const IconCircle = styled.div<{ $type: string }>`
  width: 3.5rem;
  height: 3.5rem;
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
`;

export const Title = styled(UIText)`
  margin: 0 0 ${tkn('spacing.sm')};
  max-width: 100%;
  line-height: ${tkn('typography.lineHeight.tight')};
  /* Larger than body/card titles — dialog headline (h1 scale) */
  font-size: ${tkn('typography.fontSize.xxl')};
`;

export const Description = styled.div`
  margin: 0 0 ${tkn('spacing.lg')};
  max-width: 100%;
  width: 100%;
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.md')};
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
    min-height: 2.75rem;
    border-radius: ${tkn('radius.md')};
  }
`;
