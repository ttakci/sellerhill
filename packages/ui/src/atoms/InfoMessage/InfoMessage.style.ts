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

/**
 * White circular well behind the outlined triangle glyph — the same shape
 * Dialog/Toast/ValidationMessage use, so a note reads the same wherever it surfaces.
 */
export const IconWell = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: ${tkn('colors.surface.primary')};
`;

export const Content = styled.div`
  min-width: 0;
  flex: 1;
`;
