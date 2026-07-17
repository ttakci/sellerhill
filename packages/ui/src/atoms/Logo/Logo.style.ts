import styled from '@emotion/styled';

export const LogoImage = styled.img<{ $height: number }>`
  height: ${(props) => props.$height / 16}rem;
  width: auto;
  max-width: 100%;
  max-height: ${(props) => props.$height / 16}rem;
  object-fit: contain;
  object-position: center center;
  display: block;
  /* Never let the browser invent a solid plate behind the mark */
  background: transparent;
`;

export const DefaultWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  background: transparent;
`;

/* Kept so any stacked imports don't break — unused by Logo.component */
export const StackedWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0;
`;

export const StackedText = styled.div`
  display: none;
`;
