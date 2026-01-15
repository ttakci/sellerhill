/**
 * CheckEmailPage Styles
 */

import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${({ theme }: { theme: Theme }) => theme.colors.background.secondary};
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;

export const Card = styled.div`
  background: ${({ theme }: { theme: Theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.lg};
  box-shadow: ${({ theme }: { theme: Theme }) => theme.shadows.lg};
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xxl};
  width: 100%;
  max-width: 480px;
  text-align: center;
`;

export const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  background: ${({ theme }: { theme: Theme }) => theme.colors.brand.primary}15;
  color: ${({ theme }: { theme: Theme }) => theme.colors.brand.primary};
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }: { theme: Theme }) => theme.spacing.xl} auto;
`;

export const Title = styled.h1`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.xxxl};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.md} 0;
`;

export const Description = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.md};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }: { theme: Theme }) => theme.typography.lineHeight.relaxed};
  margin-bottom: ${({ theme }: { theme: Theme }) => theme.spacing.xxl};

  strong {
    color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  }
`;

export const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;

export const ResendText = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
`;

export const TextButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }: { theme: Theme }) => theme.colors.brand.primary};
  cursor: pointer;
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.semibold};
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
