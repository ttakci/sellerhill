import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
    gap: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
  
  position: sticky;
  top: calc(-1 * ${tkn('spacing.md')});
  margin-top: calc(-1 * ${tkn('spacing.md')}); 
  
  z-index: 99;
  background-color: ${tkn('colors.background.secondary')};
  
  margin-left: calc(-1 * ${tkn('spacing.md')});
  margin-right: calc(-1 * ${tkn('spacing.md')});
  padding: ${tkn('spacing.md')};
  
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    
    top: calc(-1 * ${tkn('spacing.xl')});
    margin-top: calc(-1 * ${tkn('spacing.xl')});
    
    margin-left: calc(-1 * ${tkn('spacing.xl')});
    margin-right: calc(-1 * ${tkn('spacing.xl')});
    padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
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
  
  button {
    flex: 1;
    @media (min-width: 768px) {
      flex: none;
    }
  }
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.md')};

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: ${tkn('spacing.lg')};
  }

  @media (min-width: 1280px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.xl')} * 3;
  text-align: center;
  background: ${tkn('colors.background.secondary')};
  border: 1px dashed ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  gap: ${tkn('spacing.lg')};
  margin-top: ${tkn('spacing.xl')};
`;

export const GroupCard = styled.div`
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  transition: all ${tkn('transitions.normal')};
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-4px);
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
`;

export const CardIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${tkn('radius.lg')};
  background-color: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.brand.primary')};
  flex-shrink: 0;
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const Stats = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
`;

export const CardActions = styled.div`
  display: flex;
  gap: ${tkn('spacing.xs')};
`;

export const IconButton = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.sm')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
    background: ${tkn('colors.background.tertiary')};
  }

  &.delete:hover {
    color: ${tkn('colors.semantic.error')};
  }
`;
