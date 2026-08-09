import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.semanticTint.infoStrong')};
  color: ${tkn('colors.text.primary')};
`;

export const IconWell = styled.span`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.full')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${tkn('colors.semantic.info')};
  color: ${tkn('colors.text.inverse')};
`;

export const Content = styled.div`
  min-width: 0;
  flex: 1;
`;
