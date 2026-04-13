import React from 'react';

import { Icon } from '../Icon';

import * as S from './Breadcrumb.style';
import type { BreadcrumbProps } from './Breadcrumb.types';

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate, className }) => {
  return (
    <S.Container aria-label="Breadcrumb" className={className}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <S.Item
              $active={isLast}
              $hoverable={!!item.path && !isLast}
              onClick={() => item.path && !isLast && onNavigate?.(item.path)}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              <span>{item.label}</span>
            </S.Item>
            {!isLast && (
              <S.Separator>
                <Icon name="chevron_right" size={14} />
              </S.Separator>
            )}
          </React.Fragment>
        );
      })}
    </S.Container>
  );
};
