import styled from '@emotion/styled';
import { Card as RepoCard, Badge as UIBadge, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

/* Same geometry as the Listings / Orders / Jobs filter bars. */
export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 20rem;
  max-width: 100%;

  @media (max-width: ${tkn('breakpoints.md')}) {
    width: 100%;
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
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
