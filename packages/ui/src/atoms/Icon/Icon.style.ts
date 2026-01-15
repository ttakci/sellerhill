import styled from '@emotion/styled';

export const IconWrapper = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
`;
