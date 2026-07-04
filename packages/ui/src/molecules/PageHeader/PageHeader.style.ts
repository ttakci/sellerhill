import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const HeaderWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const TitleArea = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const Title = styled.div`
  font-size: ${tkn('typography.fontSize.xxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  letter-spacing: -0.025em;
  margin: 0;
  line-height: 1.2;
`;

export const Subtitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin-top: ${tkn('spacing.xs')};
  margin-bottom: 0;
  line-height: 1.5;

  strong, b {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
  }
`;

export const ActionsArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;
