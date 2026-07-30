import { DataTable, EmptyState, Icon, IdBadge, PageHeader, SearchField } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ProductsPage.style';
import type { ProductsPageComponentProps } from './ProductsPage.types';

export const ProductsPageComponent: React.FC<ProductsPageComponentProps> = ({
  products,
  isLoading,
  search,
  onSearchChange,
  onClearSearch,
  formatCurrency,
  pagination,
  columns,
  onDownload,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (product: {
    asin: string;
    imageUrls?: string[];
    title: string;
    brand?: string;
    price: { currency: string; current: number };
  }) => (
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
        <S.PriceText variant="body" weight="semibold" color="semantic.success" numeric>
          {formatCurrency(product.price.current)}
        </S.PriceText>
      </S.CardFooter>
    </S.GridCard>
  );

  return (
    <S.Container>
      <PageHeader title={t('translation:menu.products')} subtitle={t('translation:products.subtitle')} />

      {/* Products was the only list page with no filter row while its siblings
          all had one — and the search is server-side now, so it is also the
          only way to reach a product that is not on the current page. */}
      <S.FilterBar>
        <S.SearchWrapper>
          <SearchField
            value={search}
            onChange={onSearchChange}
            placeholder={t('listings.products.searchPlaceholder')}
            size="medium"
            fullWidth
          />
        </S.SearchWrapper>
      </S.FilterBar>

      <DataTable
        gridMinItemWidth="19rem"
        columns={columns}
        data={products}
        renderGridCard={renderGridCard}
        emptyContent={
          isLoading ? (
            <EmptyState
              icon="loader"
              title={t('listings.empty.loadingTitle')}
              description={t('listings.empty.loadingSubtitle')}
              size="md"
            />
          ) : search.trim() ? (
            <EmptyState
              icon="search"
              title={t('listings.empty.filtersTitle')}
              description={t('listings.empty.filtersSubtitle')}
              action={t('listings.empty.filtersAction')}
              onAction={onClearSearch}
              size="lg"
            />
          ) : (
            <EmptyState
              icon="inventory"
              title={t('listings.overview.emptyTitle')}
              description={t('listings.overview.emptySubtitle')}
              size="lg"
            />
          )
        }
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.Container>
  );
};
