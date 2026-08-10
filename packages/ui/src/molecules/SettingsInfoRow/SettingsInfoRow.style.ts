import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-child {
    border-bottom: none;
  }
`;

export const Left = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  min-width: 0;
`;

export const RowIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const Right = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
  max-width: 60%;
`;

export const Value = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
`;
