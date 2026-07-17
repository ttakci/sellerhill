import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * Page title block — spacing below is owned by the parent page stack
 * (`PageContainer` gap), not margin here, so every screen aligns identically.
 */
export const HeaderWrapper = styled.div<{ $noMargin?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  width: 100%;
  margin: 0;
  /* $noMargin kept for API compat; margin is always 0 (parent gap) */
  margin-bottom: 0;

  @media (min-width: 48rem) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
`;

export const BackButtonWrap = styled.div<{ $mobileOnly?: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  /* Align with h1 cap height */
  margin-top: ${tkn('spacing.2xs')};

  ${({ $mobileOnly }) =>
    $mobileOnly &&
    `
    @media (min-width: 48rem) {
      display: none;
    }
  `}
`;

export const TitleArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
`;

export const ActionsArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
  /* Align actions to title baseline row on desktop */
  @media (min-width: 48rem) {
    padding-top: ${tkn('spacing.2xs')};
  }
`;
