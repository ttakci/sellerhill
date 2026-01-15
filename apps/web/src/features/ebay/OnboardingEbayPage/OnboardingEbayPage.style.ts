import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px); /* Subtract header height */
  background: ${({ theme }) => theme.colors.background.primary};
  padding: ${({ theme }) => theme.spacing.md};
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  padding: ${({ theme }) => theme.spacing.xxxl};
  width: 100%;
  max-width: 600px;
`;

export const Header = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

export const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xxxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
`;

export const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
`;

export const MarketplaceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

export const MarketplaceItem = styled.div<{ $selected: boolean }>`
  padding: ${({ theme }) => theme.spacing.md};
  border: 2px solid ${({ theme, $selected }) => $selected ? theme.colors.brand.primary : theme.colors.border.primary};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  background: ${({ theme, $selected }) => $selected ? theme.colors.brand.primary + '10' : theme.colors.surface.primary};

  &:hover {
    border-color: ${({ theme, $selected }) => $selected ? theme.colors.brand.primary : theme.colors.brand.primary + '80'};
  }
`;

export const FlagIcon = styled.div`
  font-size: 24px;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

export const MarketplaceName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const SkipButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.secondary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-decoration: underline;
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;
