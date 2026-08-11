import { Icon, IdBadge, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './ProductTableCell.style';
import type { ProductTableCellProps } from './ProductTableCell.types';

export const ProductTableCell: React.FC<ProductTableCellProps> = ({
  title,
  imageUrl,
  meta,
  subtitle,
  className,
}) => (
  <S.Cell className={className}>
    <S.ImageWrapper>
      {imageUrl ? <S.Image src={imageUrl} alt={title} /> : <Icon name="image" size={28} />}
    </S.ImageWrapper>
    <S.MainInfo>
      <Tooltip content={title} position="top" variant="dark">
        <S.Title>{title}</S.Title>
      </Tooltip>
      {subtitle}
      {meta && meta.length > 0 && (
        <S.Meta>
          {meta.map((row) => (
            <S.MetaRow key={`${row.label}-${row.id}`}>
              <S.MetaLabel>{row.label}</S.MetaLabel>
              <IdBadge id={row.id} storeType={row.storeType} size="sm" />
            </S.MetaRow>
          ))}
        </S.Meta>
      )}
    </S.MainInfo>
  </S.Cell>
);

ProductTableCell.displayName = 'ProductTableCell';
