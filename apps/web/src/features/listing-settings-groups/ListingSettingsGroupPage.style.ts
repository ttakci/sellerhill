import styled from '@emotion/styled';
import { Badge, Button, Card, Text, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  box-sizing: border-box;
  padding-bottom: 40px;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0;

  @media (max-width: 767px) {
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px; /* mb-1 */
  text-transform: uppercase;
  letter-spacing: 0.05em; /* tracking-wider */
`;

export const BreadcrumbText = styled(Text)`
  font-size: 11px; /* text-xs approximate */
  font-weight: 500;
  color: ${tkn('colors.text.tertiary')}; /* text-slate-400 */
`;

export const ActiveBreadcrumbText = styled(Text)`
  font-size: 11px;
  font-weight: 500;
  color: ${tkn('colors.text.secondary')}; /* text-slate-500 */
`;

export const PageTitle = styled.h1`
  font-size: 1.875rem; /* text-3xl */
  font-weight: 800; /* font-extrabold */
  color: ${tkn('colors.text.primary')};
  margin: 0;
  letter-spacing: -0.025em; /* tracking-tight */
`;

export const PageSubtitle = styled(Text)`
  font-size: 0.875rem; /* text-sm */
  color: ${tkn('colors.text.secondary')}; /* text-slate-500 */
  margin-top: 8px; /* mt-2 */
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
`;

export const StyledCreateButton = styled(Button)`
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2); /* shadow-lg shadow-blue-500/20 */
  transition: all ${tkn('transitions.normal')};
  
  &:active {
    transform: scale(0.95);
  }
  
  &:hover {
    box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.2);
  }
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1280px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

/* refined and reordered below */
export const CardHeader = styled.div`
  padding: 20px; /* p-5 */
  display: flex;
  justify-content: space-between;
  align-items: flex-start; /* items-start */
  border-bottom: 1px solid ${tkn('colors.border.secondary')}; /* border-slate-50 */
`;

export const CardIconWrapper = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.brand.secondary')}; /* #EFF6FF */
  color: ${tkn('colors.brand.primary')}; /* #2563EB */
  
  & svg {
    width: 24px;
    height: 24px;
  }
`;

export const CardBodyContent = styled.div`
  padding: 20px; /* p-5 */
  min-height: 100px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const CardTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const CardTitleText = styled(Text)`
  font-size: 1.25rem;
  font-weight: 700;
  transition: color ${tkn('transitions.normal')};
`;

export const CardDescText = styled(Text)`
  font-size: 0.9rem;
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  background: #F8FAFC;
  border-top: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const Stats = styled.div`
  display: flex;
  gap: 12px;
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${tkn('colors.text.tertiary')};
  font-size: 13px;
  font-weight: 500;
`;

export const CardActions = styled.div`
  display: flex;
  gap: 4px;
`;

export const IconButton = styled.button<{ $type?: 'delete' | 'edit' }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${({ $type }) => ($type === 'delete' ? '#FEF2F2' : '#F1F5F9')};
    color: ${({ $type }) => ($type === 'delete' ? '#EF4444' : '#2563EB')};
  }
`;

/* refined and reordered below */
export const ActiveBadge = styled(Badge)`
  font-weight: 700;
  font-size: 10px;
  background-color: #F0FDF4 !important; /* bg-green-50 */
  color: #16A34A !important; /* text-green-600 */
  border: none;
`;

export const DashedCardIconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${tkn('colors.background.secondary')}; /* #F8FAFC */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  transition: background-color ${tkn('transitions.normal')};
`;

export const InteractiveCard = styled(Card)`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  border-radius: 16px !important;
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  border: 1px solid ${tkn('colors.border.primary')};
  
  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-2px);
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const DashedCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  background: transparent;
  border: 2px dashed ${tkn('colors.border.secondary')};
  border-radius: 16px;
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  gap: 12px;
  padding: ${tkn('spacing.xl')};
  color: ${tkn('colors.text.tertiary')};

  & svg {
    color: inherit;
    transition: color 0.15s;
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.brand.primary')};
  }

  &:hover .dashed-icon-wrapper {
    background: ${tkn('colors.brand.secondary')};
  }
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  background: #FFFFFF;
  border: 1px dashed ${tkn('colors.border.primary')};
  border-radius: 16px;
  gap: 24px;
  grid-column: 1 / -1;
`;

export const EmptyStateContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
`;

export const Copyright = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: ${tkn('colors.text.tertiary')};
`;
