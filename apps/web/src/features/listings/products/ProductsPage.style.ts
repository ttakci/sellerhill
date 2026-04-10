import styled from '@emotion/styled';
import { AppTheme, Badge as UIBadge, Button, Card as RepoCard, IconButton as UIIconButton, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

export const IconButton = styled(UIIconButton)`
  display: flex;
  align-items: center;
  justify-content: center;

  & svg {
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
  }
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: 0.75rem; /* 12px */
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
  padding: 1rem 1.5rem; /* 16px 24px */
  font-size: 0.6875rem; /* 11px */
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: 1.25rem 1.5rem; /* 20px 24px */
  vertical-align: middle;
  color: ${tkn('colors.text.primary')};
`;

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem; /* 16px */
`;

export const ProductImageWrapper = styled.div`
  width: 3rem; /* 48px */
  height: 3rem; /* 48px */
  border-radius: 0.5rem; /* 8px */
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.background.secondary')};
  flex-shrink: 0;

  svg,
  .material-symbols-outlined {
    font-size: 1.25rem; /* 20px */
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

export const ProductTitle = styled.div`
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  max-width: 25rem; /* 400px */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ProductBrand = styled.div`
  font-size: 0.75rem; /* 12px */
  color: ${tkn('colors.text.secondary')};
  margin-top: 0.125rem; /* 2px */
`;

export const ASINBadge = styled(UIBadge)``;

export const CategoryText = styled(UIText)``;

export const PriceText = styled(UIText)``;

export const DateText = styled(UIText)``;

export const PaginationFooter = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  background: ${tkn('colors.background.tertiary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const PaginationInfo = styled(UIText)`
  margin: 0;
`;

export const PaginationActions = styled.div`
  display: flex;
  gap: 0.5rem; /* 8px */
`;

export const PageNumberButton = styled(Button)<{ $active?: boolean }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border: 0.0625rem solid ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.border.primary'))}; /* 1px */
  background: ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.surface.primary'))};
  color: ${({ $active }) => ($active ? tkn('colors.surface.primary') : tkn('colors.text.primary'))};

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    color: ${({ $active }) => ($active ? tkn('colors.surface.primary') : tkn('colors.brand.primary'))};
  }
`;

export const PageNavButton = styled(Button)`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    font-size: 1.125rem; /* 18px */
  }
`;

export const EmptyState = styled.div`
  padding: 5rem; /* 80px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem; /* 16px */
  color: ${tkn('colors.text.tertiary')};
`;

// --- Grid View Styles ---

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
`;

export const ViewToggleGroup = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  padding: 0.25rem; /* 4px */
  border-radius: ${tkn('radius.md')};
  gap: 0.25rem;
`;

export const ToggleButton = styled(Button)<{ $active?: boolean }>`
  background: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.secondary : 'transparent'};
  color: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.primary : theme.colors.text.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const ViewLabel = styled(UIText)`
  margin-left: ${tkn('spacing.sm')};

  strong {
    font-weight: 600;
  }
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    /* 1024px */
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 80rem) {
    /* 1280px */
    grid-template-columns: repeat(4, 1fr);
  }
`;

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
  background: ${tkn('colors.background.tertiary')};
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
  font-size: 0.9375rem;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  line-height: 1.4;
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
  margin-top: 0.5rem;
`;

export const AmazonLink = styled.a`
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const GridPagination = styled.div`
  margin-top: 2rem;
`;
