import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

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

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;

  h1 {
    font-size: 1.5rem; /* 24px */
    font-weight: 700;
    color: ${tkn('colors.text.primary')};
    letter-spacing: -0.025em;
    margin: 0;
  }

  p {
    font-size: 0.875rem; /* 14px */
    color: ${tkn('colors.text.secondary')};
    margin-top: 0.25rem; /* 4px */
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 0.75rem; /* 12px */
`;

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
  padding: 0.5rem 1rem; /* 8px 16px */
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: 0.5rem; /* 8px */
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  color: ${tkn('colors.text.primary')};
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: ${tkn('shadows.sm')};

  &:hover {
    background: #f8fafc;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
    &:hover {
      background: #334155;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  .dark & {
    color: #64748b;
  }
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
    transition: background 0.2s;

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
    color: #94a3b8;
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
  color: #0f172a;
  max-width: 25rem; /* 400px */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .dark & {
    color: white;
  }
`;

export const ProductBrand = styled.div`
  font-size: 0.75rem; /* 12px */
  color: #64748b;
  margin-top: 0.125rem; /* 2px */
`;

export const ASINBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem; /* 4px 8px */
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: 0.25rem; /* 4px */
  font-size: 0.75rem; /* 12px */
  font-weight: 500;
  color: ${tkn('colors.text.secondary')};
  font-family: 'JetBrains Mono', monospace;
`;

export const CategoryText = styled.span`
  font-size: 0.875rem; /* 14px */
  color: #475569;
  .dark & {
    color: #94a3b8;
  }
`;

export const PriceText = styled.span`
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  color: #10b981;
`;

export const DateText = styled.span`
  font-size: 0.875rem; /* 14px */
  color: #64748b;
`;

export const PaginationFooter = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  background: ${tkn('colors.background.tertiary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const PaginationInfo = styled.p`
  font-size: 0.75rem; /* 12px */
  color: #64748b;
  margin: 0;
`;

export const PaginationActions = styled.div`
  display: flex;
  gap: 0.5rem; /* 8px */
`;

export const PageNumberButton = styled.button<{ $active?: boolean }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 0.375rem; /* 6px */
  border: 0.0625rem solid ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.border.primary'))}; /* 1px */
  background: ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.surface.primary'))};
  color: ${({ $active }) => ($active ? '#FFFFFF' : tkn('colors.text.primary'))};
  font-size: 0.75rem; /* 12px */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #2563eb;
    color: ${({ $active }) => ($active ? 'white' : '#2563eb')};
  }

  .dark & {
    background: ${({ $active }) => ($active ? '#2563eb' : '#1e293b')};
    border-color: ${({ $active }) => ($active ? '#2563eb' : '#334155')};
    color: ${({ $active }) => ($active ? 'white' : '#94a3b8')};
  }
`;

export const PageNavButton = styled.button`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 0.375rem; /* 6px */
  border: 0.0625rem solid #e2e8f0; /* 1px */
  background: white;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #334155;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #64748b;
  }

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
  color: #94a3b8;
`;
