import styled from '@emotion/styled';
import { Card as RepoCard, Badge as UIBadge, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.xl')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const THead = styled.thead`
  background: ${tkn('colors.background.tertiary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
`;

export const TH = styled.th`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  font-size: ${tkn('typography.fontSize.2xs')}; /* 0.6875rem (11px) → 2xs (10px) closest */
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
    transition: background ${tkn('transitions.fast')};

    &:hover {
      background: ${tkn('colors.background.tertiary')};
    }
  }
`;

export const TD = styled.td`
  padding: ${tkn('spacing.md+')} ${tkn('spacing.lg')}; /* 20px */
  vertical-align: middle;
  color: ${tkn('colors.text.primary')};
`;

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const ProductImageWrapper = styled.div`
  width: 4rem; /* 64px */
  height: 4rem; /* 64px */
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.background.tertiary')};
  flex-shrink: 0;
  padding: ${tkn('spacing.xs+')}; /* 6px */

  svg,
  .material-symbols-outlined {
    font-size: ${tkn('typography.fontSize.xxl')};
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const ProductTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
`;

export const ProductBrand = styled.div`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
  margin-top: ${tkn('spacing.2xs')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ASINBadge = styled(UIBadge)``;

export const CategoryText = styled(UIText)``;

export const CategoryCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
`;

export const CategoryChevron = styled.span`
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.md')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const PriceText = styled(UIText)``;

export const DateText = styled(UIText)``;

// --- Grid Card Styles ---

export const GridCard = styled(RepoCard)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: relative;
`;

export const CardImageSection = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const CardTitleText = styled.div`
  font-size: ${tkn('typography.fontSize.sm')}; /* 0.9375rem (15px) → sm (14px) closest */
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
  height: 2.625rem; /* 2 lines */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const ASINContainer = styled.div`
  margin-top: ${tkn('spacing.sm')};
`;

export const AmazonLink = styled.a`
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
