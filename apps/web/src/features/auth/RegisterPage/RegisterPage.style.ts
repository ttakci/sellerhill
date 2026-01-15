/**
 * RegisterPage Styles
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
`;

export const Header = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
`;

export const Title = styled.h1`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.xxxl};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.xs} 0;
`;

export const Subtitle = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.md};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  margin: 0;
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.lg};
`;

export const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;

export const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.xs};
`;

export const ButtonContainer = styled.div`
  margin-top: ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;

export const Footer = styled.div`
  text-align: center;
  margin-top: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }: { theme: Theme }) => theme.colors.brand.primary};
  cursor: pointer;
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.medium};
  text-decoration: underline;
  padding: 0;
  margin-left: ${({ theme }: { theme: Theme }) => theme.spacing.xs};
  
  &:hover {
    color: ${({ theme }: { theme: Theme }) => theme.colors.brand.primaryHover};
  }
`;

export const ErrorText = styled.span`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }: { theme: Theme }) => theme.colors.semantic.error};
`;
