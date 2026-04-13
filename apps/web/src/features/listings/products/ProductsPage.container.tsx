import { IdBadge, Icon, useLoading } from '@repo/ui';
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
        render: (asin: string) => <IdBadge id={asin} storeType="amazon" size="sm" />,
      },
      {
        key: 'category',
        header: t('listings.table.category'),
        render: (category: string) => <S.CategoryText variant="body-sm" color="text.secondary">{category || t('translation:common.noCategory')}</S.CategoryText>,
      },
      {
        key: 'price',
        header: t('listings.table.price'),
        align: 'right' as const,
        render: (price: any) => (
          <S.PriceText variant="body" weight="bold" color="semantic.success">
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
          <S.DateText variant="body-sm" color="text.secondary">
            {updatedAt ? new Date(updatedAt).toLocaleString(t('translation:common.languageCode') || 'en-US') : '—'}
          </S.DateText>
        ),
      },
      {
        key: 'actions',
        header: t('listings.table.actions'),
        align: 'right' as const,
        render: (_: any, product: any) => <IdBadge id={product.asin} storeType="amazon" size="sm" />,
      },
    ],
    [t]
  );

  const handleDownload = () => {
    const headers = [
      t('listings.table.asin'),
      t('listings.table.product'),
      t('listings.table.brand'),
      t('listings.table.category'),
      t('listings.table.price'),
    ];
    const rows = products.map((p) =>
      [p.asin, p.title, p.brand, p.category, p.price.current].map((v) => `"${v}"`).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `zonds_products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProductsPageComponent
      products={paginatedProducts}
      isLoading={isLoading}
      onDownload={handleDownload}
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
