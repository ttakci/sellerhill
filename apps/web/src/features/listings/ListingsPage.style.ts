import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
  margin-bottom: ${tkn('spacing.sm')};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  @media (min-width: 768px) {
    width: auto;
  }
`;

export const TableCard = styled.div`
  background: white;
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: 8px;
  box-shadow: 0px 8px 13px -3px rgba(0, 0, 0, 0.07);
  overflow: hidden;
`;

export const ProductInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const ProductImageWrapper = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: ${tkn('colors.background.tertiary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const ProductImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

export const ExternalLink = styled.a`
  color: #3C50E0;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: #2a3bb7;
    text-decoration: underline;
  }
`;

export const ASINBadge = styled.span`
  font-family: ${tkn('typography.fontFamily.mono')};
  background: #EFF4FB;
  color: #3C50E0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  gap: 20px;
  color: ${tkn('colors.text.tertiary')};
  text-align: center;

  svg {
    color: ${tkn('colors.brand.primary')};
    opacity: 0.8;
  }
`;

export const EmptyStateText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
`;
