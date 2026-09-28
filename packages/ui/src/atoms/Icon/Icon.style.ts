import styled from '@emotion/styled';

export const IconWrapper = styled.div<{ $size: number; $mirrorInRtl?: boolean }>`
  width: ${({ $size }) => $size / 16}rem;
  height: ${({ $size }) => $size / 16}rem;
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

  /* A glyph that points along the reading direction (chevrons, back/forward
     arrows, the collapse-sidebar panel) has to point the other way in a
     right-to-left language. stylis-plugin-rtl mirrors the layout, not artwork. */
  ${({ $mirrorInRtl }) =>
    $mirrorInRtl
      ? `[dir='rtl'] & svg {
    transform: scaleX(-1);
  }`
      : ''}
`;
