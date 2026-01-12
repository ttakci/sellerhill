import styled, { keyframes } from 'styled-components';

import type { LoadingSize } from './GeneralLoading.types';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

export const Overlay = styled.div<{ $overlay: boolean }>`
  ${(props) =>
    props.$overlay &&
    `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9998;
  `}
`;

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const getSizePixels = (size: LoadingSize): number => {
  switch (size) {
    case 'small':
      return 24;
    case 'large':
      return 64;
    case 'medium':
    default:
      return 40;
  }
};

export const Spinner = styled.div<{ size: LoadingSize }>`
  width: ${(props) => getSizePixels(props.size)}px;
  height: ${(props) => getSizePixels(props.size)}px;
  border: 3px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;
