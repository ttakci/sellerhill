import styled from '@emotion/styled';

/**
 * The height is measured from the frame's own rendered content (an eBay
 * email body can be a few lines or a full HTML table), so it is a plain
 * pixel value from the container rather than a spacing token.
 */
export const Frame = styled.iframe<{ $height: number }>`
  display: block;
  width: 100%;
  height: ${({ $height }) => $height}px;
  border: 0;
  background: transparent;
  color-scheme: light;
`;
