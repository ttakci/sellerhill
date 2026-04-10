import styled from '@emotion/styled';
import { Badge as UIBadge, Button, Card, IconButton as UIIconButton, Text as UIText, tkn } from '@repo/ui';

// --- Layout ---

export const Container = styled.div`
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

// --- Toolbar ---

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const BulkSelectWrapper = styled.div`
  min-width: 10rem;
`;

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

// --- Icon Buttons ---

export const IconButton = styled(UIIconButton)`
  display: flex;
  align-items: center;
  justify-content: center;

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

// --- View Toggle ---

export const ViewToggleGroup = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  padding: 0.125rem;
  border-radius: ${tkn('radius.md')};
  gap: 0.0625rem;
`;

export const ToggleButton = styled(Button)<{ $active?: boolean }>`
  padding: 0.375rem;
  border-radius: ${tkn('radius.sm')};
  border: none;
  background: ${({ $active, theme }) =>
    $active ? (theme as any).colors.brand.primary : 'transparent'};
  color: ${({ $active, theme }) =>
    $active ? (theme as any).colors.text.inverse : (theme as any).colors.text.tertiary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${({ $active, theme }) =>
      !$active ? (theme as any).colors.text.primary : (theme as any).colors.text.inverse};
  }
`;

export const ViewLabel = styled(UIText)`
  margin-left: ${tkn('spacing.sm')};
`;

// --- Filter Popover ---

// --- Table Cell Styles (used by container column renders) ---

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

export const ProductImageWrapper = styled.div`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.1875rem;
  flex-shrink: 0;
  overflow: hidden;

  svg {
    color: ${tkn('colors.text.disabled')};
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const ProductTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 14rem;
  line-height: 1.4;
`;

export const ProductMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const IDLink = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  span {
    font-family: ${tkn('typography.fontFamily.mono')};
    font-size: ${tkn('typography.fontSize.2xs')};
    color: ${tkn('colors.text.tertiary')};
    letter-spacing: 0.01em;
    transition: color ${tkn('transitions.fast')};
  }

  a {
    color: ${tkn('colors.text.tertiary')};
    transition: color ${tkn('transitions.fast')};
    display: flex;
    align-items: center;

    svg {
      width: 0.75rem;
      height: 0.75rem;
    }
  }

  &:hover span {
    color: ${tkn('colors.brand.primary')};
  }

  &:hover a {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const MonoText = styled(UIText)``;

export const MetricValue = styled(UIText)<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  color: ${({ $positive, $negative, theme }) => {
    const t = theme as any;
    if ($positive) return t.colors.semantic?.success;
    if ($negative) return t.colors.semantic?.error;
    return t.colors.text?.primary;
  }};
`;

export const StatBadge = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`;

export const StatMain = styled(UIText)`
  line-height: 1;
`;

export const StatSub = styled.span`
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1;
`;

export const StockBadge = styled(UIBadge)<{ $outOfStock?: boolean }>`
  color: ${({ $outOfStock, theme }) =>
    $outOfStock ? (theme as any).colors.text?.tertiary : (theme as any).colors.text?.primary};
  background: ${({ $outOfStock, theme }) =>
    $outOfStock
      ? (theme as any).colors.background?.tertiary
      : (theme as any).colors.surface?.secondary};
  min-width: 1.75rem;
  text-align: center;
`;

export const CompactText = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  max-width: 9.375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// --- Filter Popover ---

export const FilterWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

export const PopoverContainer = styled.div`
  position: absolute;
  top: calc(100% + 0.375rem);
  right: 0;
  width: 15rem;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.lg')};
  z-index: 50;
  overflow: hidden;
  animation: popoverFadeIn 0.12s ease-out;

  @keyframes popoverFadeIn {
    from {
      opacity: 0;
      transform: translateY(-0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const PopoverHeader = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.xs')};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const PopoverContent = styled.div`
  padding: 0.5rem 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 22rem;
  overflow-y: auto;
`;

// --- Grid View ---

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: 48rem) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 80rem) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

export const ListingCard = styled(Card)`
  border-radius: ${tkn('radius.lg')} !important;
  overflow: hidden;
  transition: box-shadow ${tkn('transitions.fast')}, border-color ${tkn('transitions.fast')};
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    border-color: ${tkn('colors.text.tertiary')} !important;
  }
`;

export const CardTopRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem 0.75rem 0;
`;

export const CardThumb = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
    width: 1rem;
    height: 1rem;
  }
`;

export const CardHeaderInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
`;

export const CardTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const CardIdLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.0625rem;
`;

export const CardIdLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  font-family: ${tkn('typography.fontFamily.mono')};
  font-size: ${tkn('typography.fontSize.2xs')};
  color: ${tkn('colors.text.tertiary')};
  text-decoration: none;
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }

  svg {
    width: 0.625rem;
    height: 0.625rem;
    opacity: 0;
    transition: opacity ${tkn('transitions.fast')};
  }

  &:hover svg {
    opacity: 1;
  }
`;

export const CardIdDivider = styled.span`
  color: ${tkn('colors.border.primary')};
  font-size: ${tkn('typography.fontSize.2xs')};
`;

export const CardStatusBadge = styled.div`
  margin-left: auto;
  flex-shrink: 0;
`;

export const CardBody = styled.div`
  padding: 0.5rem 0.75rem 0.625rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.375rem;
`;

export const CardStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: 0.375rem;
`;

export const StatItem = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.125rem 0.25rem;

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled(UIText)`
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
`;

export const StatValue = styled(UIText)<{ $type?: 'price' | 'profit' | 'roi' }>`
  color: ${({ $type, theme }) => {
    if ($type === 'profit') return (theme as any).colors.semantic.success;
    if ($type === 'roi') return (theme as any).colors.semantic.info;
    return (theme as any).colors.text.primary;
  }};
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.375rem 0.75rem 0.5rem;
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  gap: ${tkn('spacing.xs')};
`;

export const StockInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  span.count {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
  }
`;

export const StatusBadge = styled(UIBadge)<{ $status: string }>`
  white-space: nowrap;

  ${({ $status, theme }) => {
    const t = theme as any;
    const s = $status.toLowerCase();
    if (s === 'active') {
      return `
        background: ${t.colors.semanticTint?.success || '#ECFDF5'};
        color: ${t.colors.semantic?.success || '#059669'};
        border-color: ${t.colors.semanticTintBorder?.success || '#A7F3D0'};
      `;
    }
    return `
      background: ${t.colors.semanticTint?.neutral || '#F3F4F6'};
      color: ${t.colors.text?.secondary || '#6B7280'};
      border-color: ${t.colors.semanticTintBorder?.neutral || '#E5E7EB'};
    `;
  }}
`;
