import { DataTable, Icon, IdBadge, PageHeader } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ProductsPage.style';
import type { ProductsPageComponentProps } from './ProductsPage.types';

export const ProductsPageComponent: React.FC<ProductsPageComponentProps> = ({
  products,
  isLoading,
  pagination,
  columns,
  onDownload,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (product: any) => (
    <S.GridCard key={product.asin} variant="interactive">
      <S.CardImageSection>
        {product.imageUrls?.[0] ? (
          <S.ProductImage src={product.imageUrls[0]} alt={product.title} />
        ) : (
          <Icon name="image" size={48} />
        )}
      </S.CardImageSection>
      <S.CardContent>
        <S.CardTitleText title={product.title}>{product.title}</S.CardTitleText>
        <S.ProductBrand>{product.brand || t('translation:common.notProvided')}</S.ProductBrand>
        <S.ASINContainer>
          <IdBadge id={product.asin} storeType="amazon" size="sm" />
        </S.ASINContainer>
      </S.CardContent>
      <S.CardFooter>
        <S.PriceText variant="body" weight="bold" color="semantic.success">
          {product.price.currency === 'USD' ? '$' : product.price.currency}
          {product.price.current.toFixed(2)}
        </S.PriceText>
      </S.CardFooter>
    </S.GridCard>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('translation:menu.products')}
        subtitle={t('translation:products.subtitle')}
      />

      <DataTable
        columns={columns}
        data={products}
        renderGridCard={renderGridCard}
        emptyMessage={t('listings.overview.emptyTitle')}
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.Container>
  );
};
