import styled from '@emotion/styled';

import { Modal } from '../../atoms/Modal';
import { tkn } from '../../theme/tkn';

/**
 * Override Modal's size prop — popup is always 390px (24.375rem).
 * 12px border-radius (radius.xl) distinct from Modal's default 8px (radius.lg).
 */
export const PopupModal = styled(Modal)`
  & > div {
    max-width: 24.375rem !important;
    border-radius: ${tkn('radius.xl')};
    min-height: 12.5rem;
    max-height: 80vh;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')};
  gap: ${tkn('spacing.sm-md')};
`;

export const IconCircle = styled.div<{ $type: string }>`
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${tkn('spacing.sm')};
  background-color: ${({ theme, $type }) => {
    switch ($type) {
      case 'success':
        return tkn('colors.semanticTint.success')({ theme });
      case 'error':
        return tkn('colors.semanticTint.error')({ theme });
      case 'warning':
        return tkn('colors.semanticTint.warning')({ theme });
      default:
        return tkn('colors.semanticTint.info')({ theme });
    }
  }};
`;

export const ButtonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  margin-top: ${tkn('spacing.sm')};

  & > button {
    width: 100%;
    height: ${tkn('spacing.xxl')};
  }
`;
