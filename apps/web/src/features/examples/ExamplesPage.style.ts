import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Page = styled.div`
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
`;

export const Header = styled.div`
  background: linear-gradient(135deg, #3C50E0 0%, #1c2b91 100%);
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')};
  box-shadow: ${tkn('shadows.lg')};
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

export const Title = styled.h1`
  color: #ffffff;
  font-size: ${tkn('typography.fontSize.xxxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  margin: 0 0 ${tkn('spacing.sm')} 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

export const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: ${tkn('typography.fontSize.lg')};
  margin: 0;
  font-weight: ${tkn('typography.fontWeight.normal')};
`;

export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.xl')} ${tkn('spacing.xxxl')};
`;

export const Section = styled.div`
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const Card = styled.div`
  background-color: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.xl')};
  box-shadow: ${tkn('shadows.md')};
  transition: all ${tkn('transitions.normal')};

  &:hover {
    box-shadow: ${tkn('shadows.lg')};
    transform: translateY(-2px);
  }
`;

export const SectionTitle = styled.h2`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.xl')} 0;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};

  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 28px;
    background: linear-gradient(135deg, #3C50E0 0%, #1c2b91 100%);
    border-radius: ${tkn('radius.sm')};
  }
`;
