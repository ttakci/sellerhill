import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${tkn('spacing.xl')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const Card = styled.div`
  background-color: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.xl')};
  box-shadow: ${tkn('shadows.md')};
  transition: all ${tkn('transitions.normal')};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(135deg, #3C50E0 0%, #1c2b91 100%);
    opacity: 0;
    transition: opacity ${tkn('transitions.fast')};
  }

  &:hover {
    box-shadow: ${tkn('shadows.xl')};
    transform: translateY(-4px);

    &::before {
      opacity: 1;
    }
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const CardTitle = styled.h3`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
  word-break: break-word;
`;

export const StatusBadge = styled.span<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${(props) => props.$isActive ? css`
    background-color: rgba(16, 185, 129, 0.1);
    color: ${tkn('colors.semantic.success')(props)};
  ` : css`
    background-color: rgba(107, 114, 128, 0.1);
    color: ${tkn('colors.text.secondary')(props)};
  `}
`;

export const CardBody = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  margin-bottom: ${tkn('spacing.sm')};
`;

export const CardFooter = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.lg')};
  border-top: 1px solid ${tkn('colors.border.primary')};
`;

export const EmptyState = styled.div`
  grid-column: 1 / -1;
  text-align: center;
  padding: ${tkn('spacing.xxxl')};
  color: ${tkn('colors.text.secondary')};
`;

export const EmptyTitle = styled.h3`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.sm')} 0;
`;

export const EmptyText = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;
