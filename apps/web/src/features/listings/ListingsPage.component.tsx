import { Badge, Button, Icon, Tabs, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingsPage.style';
import { ListingsPageProps } from './ListingsPage.types';
import { ListingJobsTable } from './components/ListingJobsTable';

export const ListingsPageComponent: React.FC<ListingsPageProps> = ({
  listings,
  isLoading,
  jobs,
  isJobsLoading,
  onRefresh,
  onAddListing,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'error':
        return 'error';
      case 'draft':
        return 'secondary';
      default:
        return 'info';
    }
  };

  const tabItems = [
    {
      id: 'active',
      label: t('listings.tabs.active'),
      icon: 'grid' as const,
      content: (
        <S.TableCard>
          <S.TableContainer>
            <S.Table>
              <thead>
                <tr>
                  <S.Th>{t('listings.table.product')}</S.Th>
                  <S.Th>{t('listings.table.asin')}</S.Th>
                  <S.Th>{t('listings.table.ebayId')}</S.Th>
                  <S.Th>{t('listings.table.price')}</S.Th>
                  <S.Th>{t('listings.table.stock')}</S.Th>
                  <S.Th>{t('listings.table.status')}</S.Th>
                  <S.Th>{t('listings.table.actions')}</S.Th>
                </tr>
              </thead>
              <tbody>
                {listings.length > 0 ? (
                  listings.map((listing) => (
                    <tr key={listing.id}>
                      <S.Td>
                        <S.ProductInfo>
                          <S.ProductImage src={listing.imageUrls?.[0]} alt={listing.title} />
                          <div>
                            <Text variant="body" weight="semibold" style={{ display: 'block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {listing.title}
                            </Text>
                            <Text variant="caption" color="text.tertiary">
                              {t('listings.table.addedAt', { date: new Date(listing.createdAt).toLocaleDateString() })}
                            </Text>
                          </div>
                        </S.ProductInfo>
                      </S.Td>
                      <S.Td>
                        <Text variant="body" weight="medium" style={{ fontFamily: 'monospace' }}>
                          {listing.asin}
                        </Text>
                      </S.Td>
                      <S.Td>
                        {listing.ebayListingId ? (
                          <a 
                            href={`https://www.ebay.com/itm/${listing.ebayListingId}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ color: '#3C50E0', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {listing.ebayListingId}
                          </a>
                        ) : (
                          <Text variant="caption" color="text.tertiary">N/A</Text>
                        )}
                      </S.Td>
                      <S.Td>
                        <Text variant="body" weight="bold">
                          ${listing.price.toFixed(2)}
                        </Text>
                      </S.Td>
                      <S.Td>
                        <Text variant="body">{listing.quantity}</Text>
                      </S.Td>
                      <S.Td>
                        <Badge variant={getStatusVariant(listing.status)} size="sm">
                          {t(`listings.status.${listing.status}`)}
                        </Badge>
                      </S.Td>
                      <S.Td>
                        <S.Actions>
                          <Button variant="secondary" size="sm">
                            <Icon name="edit" size={14} />
                          </Button>
                          <Button variant="danger" size="sm">
                            <Icon name="trash" size={14} />
                          </Button>
                        </S.Actions>
                      </S.Td>
                    </tr>
                  ))
                ) : !isLoading && (
                  <tr>
                    <td colSpan={7}>
                      <S.EmptyState>
                        <Icon name="grid" size={48} />
                        <S.EmptyStateText>
                          <Text variant="h4" weight="bold">{t('listings.overview.emptyTitle')}</Text>
                          <Text variant="body" color="text.secondary">{t('listings.overview.emptySubtitle')}</Text>
                        </S.EmptyStateText>
                        <Button variant="primary" onClick={onAddListing} style={{ marginTop: '8px' }}>
                          {t('listings.actions.addListing')}
                        </Button>
                      </S.EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </S.Table>
          </S.TableContainer>
        </S.TableCard>
      ),
    },
    {
      id: 'jobs',
      label: t('listings.tabs.jobs'),
      icon: 'upload' as const,
      content: (
        <S.TableCard>
          <ListingJobsTable jobs={jobs} isLoading={isJobsLoading} />
        </S.TableCard>
      ),
    },
  ];

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <Text variant="h3" weight="bold">
            {t('listings.overview.title')}
          </Text>
          <Text variant="body" color="text.secondary">
            {t('listings.overview.subtitle', { count: listings.length })}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="secondary" onClick={onRefresh} disabled={isLoading || isJobsLoading}>
            <Icon name="loader" size={16} />
            {t('translation:common.actions.refresh')}
          </Button>
          <Button variant="primary" onClick={onAddListing}>
            <Icon name="plus" size={16} />
            {t('listings.actions.addListing')}
          </Button>
        </S.Actions>
      </S.Header>

      <Tabs items={tabItems} variant="underline" />
    </S.Container>
  );
};
