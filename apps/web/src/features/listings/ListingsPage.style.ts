import styled from '@emotion/styled';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${({ theme }) => theme.spacing.xl};
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: flex-start;
  
  position: sticky;
  top: calc(-1 * ${({ theme }) => theme.spacing.md});
  margin-top: calc(-1 * ${({ theme }) => theme.spacing.md}); 
  
  z-index: 99;
  background-color: ${({ theme }) => theme.colors.background.secondary};
  
  margin-left: calc(-1 * ${({ theme }) => theme.spacing.md});
  margin-right: calc(-1 * ${({ theme }) => theme.spacing.md});
  padding: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.secondary};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    
    top: calc(-1 * ${({ theme }) => theme.spacing.xl});
    margin-top: calc(-1 * ${({ theme }) => theme.spacing.xl});
    
    margin-left: calc(-1 * ${({ theme }) => theme.spacing.xl});
    margin-right: calc(-1 * ${({ theme }) => theme.spacing.xl});
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;

  @media (min-width: 768px) {
    width: auto;
  }
  
  button {
    flex: 1;
    @media (min-width: 768px) {
      flex: none;
    }
  }
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border: 1px solid ${({ theme }) => theme.colors.border.secondary};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const TableCard = styled(Card)`
  padding: 0;
  overflow: hidden;
`;

export const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const Th = styled.th`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border-bottom: 2px solid ${({ theme }) => theme.colors.border.secondary};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: 0.875rem;
  white-space: nowrap;
`;

export const Td = styled.td`
  padding: ${({ theme }) => `${theme.spacing.lg} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.secondary};
  vertical-align: middle;
`;

export const ProductInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ProductImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radius.md};
  object-fit: contain;
  background: ${({ theme }) => theme.colors.background.tertiary};
  border: 1px solid ${({ theme }) => theme.colors.border.secondary};
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xxl} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.text.tertiary};
  text-align: center;

  svg {
    color: ${({ theme }) => theme.colors.brand.primary};
    opacity: 0.8;
  }
`;

export const EmptyStateText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: center;
`;
