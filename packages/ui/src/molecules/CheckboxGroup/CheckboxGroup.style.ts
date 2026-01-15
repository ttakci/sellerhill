import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const OptionsContainer = styled.div<{ direction?: 'horizontal' | 'vertical' }>`
  display: flex;
  flex-direction: ${({ direction }) => (direction === 'vertical' ? 'column' : 'row')};
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
`;
