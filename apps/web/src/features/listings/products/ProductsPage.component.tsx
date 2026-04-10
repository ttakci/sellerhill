import { Icon, PageHeader, Table, TablePagination } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ProductsPage.style';
import type { ProductsPageComponentProps } from './ProductsPage.types';

export const ProductsPageComponent: React.FC<ProductsPageComponentProps> = ({
  products,
  isLoading,
  pagination,
  columns,
  viewMode,
  onViewModeChange,
  onDownload,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const viewToggle = (
    <S.ToolbarGroup>
      <S.ViewToggleGroup>
        <S.ToggleButton
          $active={viewMode === 'grid'}
          onClick={() => onViewModeChange('grid')}
          title={t('translation:common.views.grid')}
        >
          <Icon name="grid-view" size={20} />
        </S.ToggleButton>
        <S.ToggleButton
          $active={viewMode === 'table'}
          onClick={() => onViewModeChange('table')}
          title={t('translation:common.views.table')}
        >
          <Icon name="format-list-bulleted" size={20} />
        </S.ToggleButton>
      </S.ViewToggleGroup>
      <S.ViewLabel variant="body-sm" color="text.secondary">
        {t('translation:common.views.label')}: <strong>{t(`translation:common.views.${viewMode}`)}</strong>
      </S.ViewLabel>
    </S.ToolbarGroup>
  );

  const toolbarActions = (
    <S.ToolbarGroup>
      <S.IconButton variant="outlined" title={t('translation:common.actions.filter')}>
        <Icon name="filter-list" size={20} />
      </S.IconButton>
      <S.IconButton variant="outlined" onClick={onDownload} title={t('translation:common.actions.export')}>
        <Icon name="download" size={20} />
      </S.IconButton>
    </S.ToolbarGroup>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('translation:menu.products')}
        subtitle={t('translation:products.subtitle')}
      />

      <S.Toolbar>
        {viewToggle}
        {toolbarActions}
      </S.Toolbar>

      {viewMode === 'table' ? (
        <Table
          columns={columns}
          data={products}
          emptyMessage={t('listings.overview.emptyTitle')}
          pagination={pagination}
        />
      ) : (
        <>
          <S.GridContainer>
            {products.map((product) => (
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
                    <S.ASINBadge variant="neutral" size="xs">{product.asin}</S.ASINBadge>
                  </S.ASINContainer>
                </S.CardContent>
                <S.CardFooter>
                  <S.PriceText variant="body" weight="bold" color="semantic.success">
                    {product.price.currency === 'USD' ? '$' : product.price.currency}
                    {product.price.current.toFixed(2)}
                  </S.PriceText>
                  <S.AmazonLink
                    href={`https://www.amazon.com/dp/${product.asin}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('translation:common.amazonLink')} <Icon name="open-in-new" size={14} />
                  </S.AmazonLink>
                </S.CardFooter>
              </S.GridCard>
            ))}
          </S.GridContainer>
          {pagination && (
            <S.GridPagination>
              <TablePagination {...pagination} />
            </S.GridPagination>
          )}
        </>
      )}
    </S.Container>
  );
};
