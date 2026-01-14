/**
 * CheckEmailPage Styles
 */

import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background.secondary};
  padding: ${({ theme }) => theme.spacing.md};
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  padding: ${({ theme }) => theme.spacing.xxl};
  width: 100%;
  max-width: 480px;
  text-align: center;
`;

export const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  background: ${({ theme }) => theme.colors.brand.primary}15;
  color: ${({ theme }) => theme.colors.brand.primary};
  border-radius: ${({ theme }) => theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }) => theme.spacing.xl} auto;
`;

export const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xxxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
`;

export const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};

  strong {
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

export const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ResendText = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

export const TextButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.brand.primary};
  cursor: pointer;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-decoration: none;
  padding: 0;
  
  &:hover {
    text-decoration: underline;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
