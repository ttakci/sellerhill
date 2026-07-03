import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const FooterWrapper = styled.footer`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.background.primary')};
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: center;
  justify-content: space-between;

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
  }
`;


export const Links = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
`;

export const LinkItem = styled.a`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
  text-decoration: none;
  cursor: pointer;
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;
