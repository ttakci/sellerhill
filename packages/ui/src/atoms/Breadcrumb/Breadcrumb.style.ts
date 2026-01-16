import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.xl')};
  width: 100%;
`;

export const Title = styled.h2`
  font-size: ${tkn('typography.fontSize.xxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const List = styled.ol`
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0;
  margin: 0;
  gap: ${tkn('spacing.xs')};
`;

export const ListItem = styled.li<{ $active?: boolean }>`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.secondary)};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};

  &::after {
    content: '/';
    color: ${tkn('colors.text.tertiary')};
    display: ${({ $active }) => ($active ? 'none' : 'block')};
  }

  &:last-child::after {
    display: none;
  }
`;

export const Link = styled.a`
  text-decoration: none;
  color: inherit;
  transition: color 0.2s;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;
