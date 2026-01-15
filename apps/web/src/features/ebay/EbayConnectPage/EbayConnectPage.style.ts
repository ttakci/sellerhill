/**
 * EbayConnectPage Styles
 */

import styled from '@emotion/styled';

export const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl};
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadows.md};
  padding: ${({ theme }) => theme.spacing.xxl};
`;

export const Header = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

export const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
`;

export const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const Info = styled.div`
  background: ${({ theme }) => theme.colors.background.secondary};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.spacing.md};
  width: 100%;
  text-align: center;
`;

export const InfoText = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
`;

export const ButtonContainer = styled.div`
  width: 100%;
  max-width: 320px;
`;
