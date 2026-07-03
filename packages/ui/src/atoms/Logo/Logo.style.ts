import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const LogoImage = styled.img<{ $height: number }>`
  height: ${(props) => props.$height / 16}rem;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  display: block;
`;

export const DefaultWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StackedWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const StackedText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;
