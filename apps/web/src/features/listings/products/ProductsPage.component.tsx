import { Icon, Table } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ProductsPage.style';
import type { ProductsPageComponentProps } from './ProductsPage.types';

export const ProductsPageComponent: React.FC<ProductsPageComponentProps> = ({
  products,
  isLoading,
  onRefresh,
  pagination,
  columns,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <S.Header>
        <S.TitleSection>
          <h1>{t('translation:menu.products')}</h1>
          <p>{t('listings.products.subtitle')}</p>
        </S.TitleSection>
        <S.Actions>
          <S.RefreshButton onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" size={18} />
            {t('translation:common.actions.refresh')}
          </S.RefreshButton>
        </S.Actions>
      </S.Header>

      <Table
        columns={columns}
        data={products}
        emptyMessage={t('listings.overview.emptyTitle')}
        pagination={pagination}
      />
    </S.Container>
  );
};
