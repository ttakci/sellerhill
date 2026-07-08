import styled from '@emotion/styled';

export const Cursor = styled.span`
  display: inline-block;
  width: 0.125rem; /* 2px */
  height: 1em;
  background-color: currentColor;
  margin-left: 0.125rem; /* 2px */
  vertical-align: middle;
  animation: blink 1s infinite step-end;

  @keyframes blink {
    from,
    to {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
`;

export const Container = styled.div`
  display: flex;
  align-items: center;
`;
