import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Cell = styled.div`
  display: flex;
  /* Image centred against the copy block — the two-line title + id rows are
     usually taller than the 4.5rem thumb, so flex-start left it hugging the top. */
  align-items: center;
  /* Image ↔ copy separation (was tight at spacing.sm on the orders table) */
  gap: ${tkn('spacing.md')};
  /* A little more room than the shared Td padding gives the densest column. */
  padding: ${tkn('spacing.sm')} 0;
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
  gap: ${tkn('spacing.sm+')};
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
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: 5.75rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.xs')};
  align-items: center;
  min-width: 0;

  /* The id value (an \`IdBadge plain\`, an <a>) sits one step below the title and
     the numeric columns — small enough to read as secondary, still body font. */
  & > a {
    font-size: ${tkn('typography.fontSize.xs')};
  }
`;

/** Leading icon + label — mirrors the listing card's meta rows. */
export const MetaLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** Body font like the rest of the table, one size down (fontSize.xs) so the
 *  ASIN / eBay ID pair reads as secondary detail under the title — matched to
 *  its `IdBadge plain` value beside it. */
export const MetaLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.tight')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
