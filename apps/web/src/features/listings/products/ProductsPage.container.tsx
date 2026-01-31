import { Icon, useLoading } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetUserProductsQuery } from '../api/listings.api';
import { ProductsPageComponent } from './ProductsPage.component';
import * as S from './ProductsPage.style';

export const ProductsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const { data: products = [], isLoading, refetch } = useGetUserProductsQuery();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useLoading(isLoading);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return products.slice(start, start + rowsPerPage);
  }, [products, page, rowsPerPage]);

  const columns = useMemo(
    () => [
      {
        key: 'product',
        header: t('listings.table.product'),
        render: (_: any, product: any) => (
          <S.ProductCell>
            <S.ProductImageWrapper>
              {product.imageUrls?.[0] ? (
                <S.ProductImage src={product.imageUrls[0]} alt={product.title} />
              ) : (
                <Icon name="image" />
              )}
            </S.ProductImageWrapper>
            <S.ProductMainInfo>
              <S.ProductTitle title={product.title}>
                {product.title || t('translation:common.unknownProduct')}
              </S.ProductTitle>
              <S.ProductBrand>{product.brand || t('translation:common.notProvided')}</S.ProductBrand>
            </S.ProductMainInfo>
          </S.ProductCell>
        ),
      },
      {
        key: 'asin',
        header: t('listings.table.asin'),
        render: (asin: string) => <S.ASINBadge>{asin}</S.ASINBadge>,
      },
      {
        key: 'category',
        header: t('listings.table.category'),
        render: (category: string) => <S.CategoryText>{category || t('translation:common.noCategory')}</S.CategoryText>,
      },
      {
        key: 'price',
        header: t('listings.table.price'),
        align: 'right' as const,
        render: (price: any) => (
          <S.PriceText>
            {price.currency === 'USD' ? '$' : price.currency}
            {price.current.toFixed(2)}
          </S.PriceText>
        ),
      },
      {
        key: 'updatedAt',
        header: t('listings.table.updatedAt'),
        align: 'right' as const,
        render: (updatedAt: string) => (
          <S.DateText>
            {updatedAt ? new Date(updatedAt).toLocaleString(t('translation:common.languageCode') || 'en-US') : '—'}
          </S.DateText>
        ),
      },
      {
        key: 'actions',
        header: t('listings.table.actions'),
        align: 'right' as const,
        render: (_: any, product: any) => (
          <a
            href={`https://www.amazon.com/dp/${product.asin}`}
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              justifyContent: 'flex-end',
            }}
          >
            Amazon <Icon name="open-in-new" size={14} />
          </a>
        ),
      },
    ],
    [t]
  );

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <ProductsPageComponent
      products={paginatedProducts}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      columns={columns}
      pagination={{
        count: products.length,
        page,
        rowsPerPage,
        onPageChange: setPage,
        onRowsPerPageChange: (val) => {
          setRowsPerPage(val);
          setPage(1);
        },
        labelRowsPerPage: t('translation:common.rowsPerPage'),
        labelInfo: t('translation:common.showing_info'),
      }}
    />
  );
};
