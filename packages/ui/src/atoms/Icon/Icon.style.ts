import styled from 'styled-components';

export const IconWrapper = styled.svg<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
`;
