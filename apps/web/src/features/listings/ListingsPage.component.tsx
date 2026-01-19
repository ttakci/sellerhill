import { ListingDto } from '@repo/shared';
import { Badge, Button, Icon, Table, Tabs, Text, useUI } from '@repo/ui';
import React, { useState } from 'react';
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
  onEndListings,
}) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage } = useUI();
  const [selectedListings, setSelectedListings] = useState<ListingDto[]>([]);

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

  const handleEndSelected = () => {
    if (selectedListings.length === 0) return;

    showMessage({
      type: 'warning',
      headerKey: 'listings:listings.modals.endTitle',
      descriptionKey: 'listings:listings.modals.endDescription',
      descriptionParams: { count: selectedListings.length },
      primaryButton: {
        labelKey: 'listings:listings.actions.endListing',
        variant: 'danger',
        onClick: async () => {
          const ids = selectedListings.map(l => l.id);
          await onEndListings(ids);
          setSelectedListings([]);
        }
      },
      secondaryButton: {
        labelKey: 'translation:common.cancel',
        onClick: () => {} // Handled by closeMessage inside showMessage's internal logic usually
      }
    }, t);
  };

  const activeColumns = [
    {
      key: 'product',
      header: t('listings.table.product'),
      render: (_: any, listing: ListingDto) => (
        <S.ProductInfo>
          <S.ProductImageWrapper>
            {listing.imageUrls?.[0] ? (
              <S.ProductImage src={listing.imageUrls[0]} alt={listing.title} />
            ) : (
              <Icon name="box" size={24} color="text.tertiary" />
            )}
          </S.ProductImageWrapper>
          <div>
            <Text variant="body" weight="semibold" style={{ display: 'block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listing.title === 'Unknown Product' ? listing.asin : listing.title}
            </Text>
            <Text variant="caption" color="text.tertiary">
              {t('listings.table.addedAt', { date: new Date(listing.createdAt).toLocaleDateString() })}
            </Text>
          </div>
        </S.ProductInfo>
      )
    },
    {
      key: 'asin',
      header: t('listings.table.asin'),
      render: (asin: string) => (
        <S.ExternalLink 
          href={`https://www.amazon.com/dp/${asin}`} 
          target="_blank" 
          rel="noreferrer"
        >
          <S.ASINBadge>{asin}</S.ASINBadge>
          <Icon name="external-link" size={12} />
        </S.ExternalLink>
      )
    },
    {
      key: 'ebayListingId',
      header: t('listings.table.ebayId'),
      render: (id: string) => id ? (
        <S.ExternalLink 
          href={`https://www.ebay.com/itm/${id}`} 
          target="_blank" 
          rel="noreferrer"
        >
          <Text variant="body" weight="medium">{id}</Text>
          <Icon name="external-link" size={12} />
        </S.ExternalLink>
      ) : (
        <Text variant="caption" color="text.tertiary">N/A</Text>
      )
    },
    {
      key: 'price',
      header: t('listings.table.price'),
      render: (price: number) => (
        <Text variant="body" weight="bold" color="brand.primary">
          ${price.toFixed(2)}
        </Text>
      )
    },
    {
      key: 'quantity',
      header: t('listings.table.stock'),
      render: (qty: number) => (
        <Text variant="body" weight="medium">{qty}</Text>
      )
    },
    {
      key: 'status',
      header: t('listings.table.status'),
      render: (status: string) => (
        <Badge variant={getStatusVariant(status)} size="sm">
          {t(`listings.status.${status}`)}
        </Badge>
      )
    }
  ];

  const tabItems = [
    {
      id: 'active',
      label: t('listings.tabs.active'),
      icon: 'grid' as const,
      content: (
        <S.TableCard>
          <Table<ListingDto>
            columns={activeColumns}
            data={listings}
            selectable
            selectedRows={selectedListings}
            onSelectionChange={setSelectedListings}
            emptyMessage={t('listings.overview.emptySubtitle')}
          />
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
          {selectedListings.length > 0 && (
            <Button variant="danger" onClick={handleEndSelected}>
              <Icon name="trash" size={16} />
              {t('listings:listings.actions.endListing')} ({selectedListings.length})
            </Button>
          )}
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
