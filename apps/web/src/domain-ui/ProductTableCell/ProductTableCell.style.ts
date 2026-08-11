import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Cell = styled.div`
  display: flex;
  align-items: flex-start;
  /* Image ↔ copy separation (was tight at spacing.sm on the orders table) */
  gap: ${tkn('spacing.md')};
  min-width: 0;
  width: 100%;
`;

/** Transparent shell — matches the grid card image (no grey plate, no border). */
export const ImageWrapper = styled.div`
  width: 4.5rem;
  height: 4.5rem;
  border-radius: ${tkn('radius.sm')};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  svg {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const MainInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** Two-line clamp; the full string is on the tooltip. */
export const Title = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: ${tkn('typography.lineHeight.normal')};
  cursor: default;
  word-break: break-word;
  overflow-wrap: anywhere;
`;

export const Meta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.xs')};
  align-items: center;
  min-width: 0;
`;

export const MetaLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;
