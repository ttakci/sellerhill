import styled from '@emotion/styled';
import { AppTheme, Card, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem; /* 24px */
  margin-bottom: 2rem; /* 32px */

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
`;

export const PageTitle = styled.h1`
  font-size: 1.5rem; /* 24px */
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin: 0;
`;

export const PageSubtitle = styled.p`
  font-size: 0.875rem; /* 14px */
  color: #64748b;
  margin-top: 0.25rem; /* 4px */

  span {
    font-weight: 600;
    color: #334155;
  }
`;

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
`;

export const StyledButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  padding: 0.625rem 1.25rem; /* 10px 20px */
  border-radius: 0.5rem; /* 8px */
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  line-height: 1.25rem;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */
  gap: 0.5rem; /* 8px */

  ${({ $variant }: { $variant?: 'primary' | 'secondary' | 'danger' }) =>
    $variant === 'primary'
      ? `
    background: #2563eb;
    color: white;
    border: none;
    box-shadow: 0 0.0625rem 0.125rem 0 rgba(37, 99, 235, 0.2); /* 1px 2px */
    &:hover { background: #1d4ed8; }
  `
      : $variant === 'danger'
        ? `
    background: #ef4444;
    color: white;
    border: none;
    &:hover { background: #dc2626; }
  `
        : `
    background: white;
    color: #334155;
    border: 0.0625rem solid #e2e8f0; /* 1px */
    &:hover { background: #f8fafc; }
  `}

  & svg {
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
  }
`;

export const TableWrapper = styled.div`
  background: white;
  border-radius: 0.75rem; /* 12px */
  border: 0.0625rem solid #e2e8f0; /* 1px */
  box-shadow:
    0 0.0625rem 0.1875rem 0 rgba(0, 0, 0, 0.1),
    /* 1px 3px */ 0 0.0625rem 0.125rem -0.0625rem rgba(0, 0, 0, 0.1); /* 1px 2px -1px */
  overflow: hidden;
`;

export const TableToolbar = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem; /* 16px */
  background: rgba(248, 250, 252, 0.3);
`;

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
`;
export const StyledSelect = styled.div`
  position: relative;

  select {
    appearance: none;
    background: white;
    border: 0.0625rem solid #e2e8f0; /* 1px */
    border-radius: 0.5rem; /* 8px */
    padding: 0.375rem 2rem 0.375rem 0.75rem; /* 6px 32px 6px 12px */
    font-size: 0.8125rem; /* 13px */
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    outline: none;

    &:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 0.0625rem #3b82f6; /* 1px */
    }
  }

  span {
    position: absolute;
    right: 0.5rem; /* 8px */
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #94a3b8;
    display: flex;
    align-items: center;
  }
`;

export const IconButton = styled.button`
  padding: 0.5rem; /* 8px */
  color: #64748b;
  background: transparent;
  border: 0.0625rem solid transparent; /* 1px */
  border-radius: 0.5rem; /* 8px */
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: white;
    box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */
    border-color: #e2e8f0;
  }

  & svg {
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
  }
`;

export const TableContainer = styled.div`
  overflow-x: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  text-align: left;
  border-collapse: collapse;
`;

export const THead = styled.thead`
  background: white;
  border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
`;

export const TH = styled.th`
  padding: 1rem 0.75rem; /* 16px 12px */
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:first-of-type {
    padding-left: 1.5rem; /* 24px */
    width: 3rem; /* 48px */
  }
  &:last-of-type {
    padding-right: 1.5rem; /* 24px */
    text-align: right;
  }
`;

export const TBody = styled.tbody`
  & tr {
    border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
    transition: background 0.2s;
    height: 4.5rem; /* 72px */

    &:hover {
      background: rgba(248, 250, 252, 0.5);
    }

    &:hover .more-btn {
      opacity: 1;
    }
  }
`;

export const TD = styled.td`
  padding: 0.75rem; /* 12px */

  &:first-of-type {
    padding-left: 1.5rem; /* 24px */
  }
  &:last-of-type {
    padding-right: 1.5rem; /* 24px */
    text-align: right;
  }
`;

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
`;

export const ProductImageWrapper = styled.div`
  width: 2.75rem; /* 44px */
  height: 2.75rem; /* 44px */
  border-radius: 0.5rem; /* 8px */
  background: #f8fafc;
  border: 0.0625rem solid #f1f5f9; /* 1px */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem; /* 6px */
  flex-shrink: 0;

  svg {
    color: #cbd5e1;
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  min-width: 0;
`;

export const ProductTitle = styled.div`
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 11.25rem; /* 180px */
`;

export const ProductSubtitle = styled.div`
  font-size: 0.75rem; /* 12px */
  color: #94a3b8;
`;

export const ProductMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
  margin-top: 0.25rem; /* 4px */
`;

export const IDLink = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem; /* 6px */

  span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem; /* 13px */
    color: #475569;
  }

  a {
    color: #93c5fd;
    transition: color 0.2s;
    &:hover {
      color: #2563eb;
    }
    display: flex;
    align-items: center;
  }
`;

export const MonoText = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem; /* 13px */
  color: #64748b;
`;

export const PriceText = styled.span`
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  color: #0f172a;
`;

export const StockBadge = styled.span<{ $outOfStock?: boolean }>`
  font-size: 0.8125rem; /* 13px */
  font-weight: 500;
  color: ${({ $outOfStock }: { $outOfStock?: boolean }) => ($outOfStock ? '#94a3b8' : '#334155')};
  background: ${({ $outOfStock }: { $outOfStock?: boolean }) => ($outOfStock ? '#f8fafc' : '#f1f5f9')};
  padding: 0.125rem 0.625rem; /* 2px 10px */
  border-radius: ${tkn('radius.full')};
  display: inline-block;
  min-width: 2rem; /* 32px */
  text-align: center;
`;

export const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem; /* 4px 8px */
  border-radius: 0.375rem; /* 6px */
  font-size: 0.6875rem; /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  border: 0.0625rem solid transparent; /* 1px */

  ${({ $status }: { $status: string }) =>
    $status === 'active' || $status === 'ACTIVE'
      ? `
    background: #ecfdf5;
    color: #059669;
    border-color: #d1fae5;
  `
      : `
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  `}

  .dark & {
    ${({ $status }: { $status: string }) =>
      $status === 'active' || $status === 'ACTIVE'
        ? `
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.2);
    `
        : `
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border-color: rgba(148, 163, 184, 0.2);
    `}
  }
`;

export const TablePagination = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  background: rgba(248, 250, 252, 0.3);
  border-top: 0.0625rem solid #f1f5f9; /* 1px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 1rem; /* 16px */

  @media (min-width: 40rem) {
    /* 640px */
    flex-direction: row;
  }
`;

export const PaginationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
  color: #64748b;
  font-size: 0.8125rem; /* 13px */

  span {
    font-weight: 600;
    color: #334155;
  }
`;

export const PaginationActions = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem; /* 24px */
`;

export const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem; /* 4px */
`;

export const PageButton = styled.button`
  padding: 0.375rem; /* 6px */
  border-radius: 0.5rem; /* 8px */
  border: 0.0625rem solid #e2e8f0; /* 1px */
  background: white;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;

  &:hover:not(:disabled) {
    background: #f8fafc;
    color: #334155;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  & svg {
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
  }
`;

export const MoreButton = styled.button`
  padding: 0.375rem; /* 6px */
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 0.375rem; /* 6px */
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #475569;
    background: #f1f5f9;
  }
`;

export const MetricValue = styled.span<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  font-size: 0.8125rem; /* 13px */
  font-weight: ${({ $bold }: { $bold?: boolean }) => ($bold ? '700' : '600')};
  color: ${({ $positive, $negative }: { $positive?: boolean; $negative?: boolean }) =>
    $positive ? '#059669' : $negative ? '#dc2626' : '#475569'};
`;

export const StatBadge = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
`;

export const StatMain = styled.span`
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
`;

export const StatSub = styled.span`
  font-size: 0.6875rem; /* 11px */
  font-weight: 500;
  color: #94a3b8;
  margin-top: 0.125rem; /* 2px */
`;

export const CompactText = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }: { theme: AppTheme }) => theme.colors.text.secondary};
  max-width: 9.375rem; /* 150px */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ColumnSettingsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* 12px */
  padding: 0.5rem 0; /* 8px */
`;

export const FilterWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

export const PopoverContainer = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem; /* 4px */
  width: 17.5rem; /* 280px */
  background: white;
  border-radius: 0.75rem; /* 12px */
  border: 0.0625rem solid #e2e8f0; /* 1px */
  box-shadow:
    0 0.625rem 0.9375rem -0.1875rem rgba(0, 0, 0, 0.1),
    0 0.25rem 0.375rem -0.125rem rgba(0, 0, 0, 0.05);
  z-index: 50;
  overflow: hidden;

  .dark & {
    background: #1e293b;
    border-color: #334155;
  }
`;

export const PopoverHeader = styled.div`
  padding: 0.75rem 1rem; /* 12px 16px */
  border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
  font-weight: 600;
  color: #0f172a;
  font-size: 0.875rem; /* 14px */
  background: #f8fafc;

  .dark & {
    border-color: #334155;
    background: #0f172a;
    color: #f1f5f9;
  }
`;

export const PopoverContent = styled.div`
  padding: 0.75rem 1rem; /* 12px 16px */
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* 12px */
  max-height: 25rem; /* 400px */
  overflow-y: auto;
`;

// --- Grid View Styles ---

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

export const ListingCard = styled(Card)`
  border-radius: ${tkn('radius.xl')} !important;
  overflow: hidden;
  box-shadow: ${tkn('shadows.sm')};
  background: ${tkn('colors.surface.primary')};
  transition: all ${tkn('transitions.normal')};
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-0.125rem); /* 2px */
    box-shadow: ${tkn('shadows.md')};
  }
`;

export const CardImageSection = styled.div`
  aspect-ratio: 1 / 1;
  background: ${tkn('colors.background.tertiary')};
  position: relative;
  padding: ${tkn('spacing.lg')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  svg {
    color: ${tkn('colors.text.tertiary')};
    opacity: 0.5;
  }
`;

export const CardStatusBadge = styled.div`
  position: absolute;
  top: ${tkn('spacing.sm')};
  right: ${tkn('spacing.sm')};
`;

export const CardBody = styled.div`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const CardTitle = styled.a`
  font-size: 0.9375rem; /* 15px */
  font-weight: 700;
  color: ${tkn('colors.brand.primary')};
  text-decoration: none;
  line-height: 1.4;
  margin-bottom: ${tkn('spacing.xs')};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  &:hover {
    text-decoration: underline;
  }
`;

export const CardMetaList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.md')};
`;

export const MetaBadge = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem; /* 11px */
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.text.secondary')};
  padding: 0.125rem 0.5rem; /* 2px 8px */
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const CardStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.md')} 0;
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  margin-bottom: ${tkn('spacing.md')};
`;

export const StatItem = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled.span`
  font-size: 0.625rem; /* 10px */
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const StatValue = styled.span<{ $type?: 'price' | 'profit' | 'roi' }>`
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  color: ${({ $type, theme }) => {
    if ($type === 'profit') return theme.colors.semantic.success;
    if ($type === 'roi') return theme.colors.brand.primary;
    return theme.colors.text.primary;
  }};
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const StockInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  font-size: 0.875rem;
  font-weight: 600;
  color: ${tkn('colors.text.secondary')};

  span.count {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const UpdateTime = styled.span`
  font-size: 0.6875rem;
  color: ${tkn('colors.text.tertiary')};
`;

export const CardActions = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.tertiary')}40;
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const QuickActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const ExternalLink = styled.a`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
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

export const ToggleButton = styled.button<{ $active?: boolean }>`
  padding: 0.375rem; /* 6px */
  border-radius: 0.375rem;
  border: none;
  background: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.secondary : 'transparent'};
  color: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.primary : theme.colors.text.tertiary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const ViewLabel = styled.span`
  font-size: 0.875rem;
  color: ${tkn('colors.text.secondary')};
  margin-left: ${tkn('spacing.sm')};

  strong {
    color: ${tkn('colors.text.primary')};
    font-weight: 600;
  }
`;
