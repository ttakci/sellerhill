import { formatCurrency, getLocaleConfig, IdBadge, useLoading } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetUserProductsQuery } from '../api/listings.api';

import { ProductsPageComponent } from './ProductsPage.component';
import * as S from './ProductsPage.style';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { ProductTableCell } from '@/domain-ui';

/* Amazon has no sandbox and no non-US site (see CLAUDE.md "Marketplace links
   are environment-scoped") — every product price here is sourced from
   amazon.com in USD, regardless of the seller's eBay store or UI language. */
const PRODUCT_SOURCE_CURRENCY = 'USD';

export const ProductsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);
  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, PRODUCT_SOURCE_CURRENCY),
    [localeCfg]
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  /*
   * Server-paginated. This used to fetch the user's entire distinct-product
   * catalog on every page load and slice ten rows out of it in the browser.
   */
  const { data, isLoading, isFetching } = useGetUserProductsQuery({
    page,
    limit: rowsPerPage,
    search: search.trim() || undefined,
  });

  const products = data?.items ?? [];
  const totalCount = data?.total ?? 0;

  /* A search narrows the result set — staying on a later page would show an
     empty page. */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    setPage(1);
  }, []);

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(false);

  const columns = useMemo(
    () => [
      {
        key: 'product',
        header: t('listings.table.product'),
        // Same cell as the listings and orders tables. It used to slice the title
        // at 40 chars in JS and only tooltip past that — so it printed "…" even
        // when the column had room, and cut mid-word. The shared cell clamps in
        // CSS and always carries the full title on the tooltip.
        render: (_: any, product: any) => (
          <ProductTableCell
            title={product.title || t('translation:common.unknownProduct')}
            imageUrl={product.imageUrls?.[0]}
            subtitle={
              <S.ProductBrand>{product.brand || t('translation:common.notProvided')}</S.ProductBrand>
            }
          />
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
        render: (category: string) => {
          if (!category) {
            return (
              <S.CategoryText variant="body-sm" color="text.secondary">
                {t('translation:common.noCategory')}
              </S.CategoryText>
            );
          }
          const parts = category.split(' > ');
          return (
            <S.CategoryCell>
              {parts.map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <S.CategoryChevron>›</S.CategoryChevron>}
                  <S.CategoryText variant="body-sm" color="text.secondary">
                    {part}
                  </S.CategoryText>
                </React.Fragment>
              ))}
            </S.CategoryCell>
          );
        },
      },
      {
        key: 'price',
        header: t('listings.table.price'),
        align: 'right' as const,
        render: (price: any) => (
          <S.PriceText variant="body-sm" weight="semibold" color="semantic.success" numeric>
            {fmtCurrency(price.current)}
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
    ],
    [t, fmtCurrency]
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
    link.setAttribute('download', `sellerhill_products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <EbayAccountGuard>
      <ProductsPageComponent
      products={products}
      isLoading={isLoading || isFetching}
      onDownload={handleDownload}
      search={search}
      onSearchChange={handleSearchChange}
      onClearSearch={handleClearSearch}
      formatCurrency={fmtCurrency}
      columns={columns}
      pagination={{
        count: totalCount,
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
    </EbayAccountGuard>
  );
};
