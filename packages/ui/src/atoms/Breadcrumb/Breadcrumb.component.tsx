import React from 'react';
import * as S from './Breadcrumb.style';
import type { BreadcrumbProps } from './Breadcrumb.types';

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle, items, className }) => {
  return (
    <S.Container className={className}>
      <S.Title>{pageTitle}</S.Title>
      <S.List>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <S.ListItem key={item.label} $active={isLast}>
              {item.path && !isLast ? (
                <S.Link href={item.path}>{item.label}</S.Link>
              ) : (
                item.label
              )}
            </S.ListItem>
          );
        })}
      </S.List>
    </S.Container>
  );
};
