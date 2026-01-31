import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const FooterWrapper = styled.footer`
  padding: 1.5rem 2rem; /* 24px 32px */
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
  background: ${tkn('colors.background.primary')};
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 16px */
  align-items: center;
  justify-content: space-between;

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
  }
`;

export const Copyright = styled.p`
  font-size: 0.8125rem; /* 13px */
  color: ${tkn('colors.text.tertiary')};
  font-weight: 500;
`;

export const Links = styled.div`
  display: flex;
  gap: 1.5rem; /* 24px */
`;

export const LinkItem = styled.a`
  font-size: 0.8125rem; /* 13px */
  color: ${tkn('colors.text.secondary')};
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s ease-in-out;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;
