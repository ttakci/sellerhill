/**
 * CardsPanel (Presentation)
 * Period KPI cards + the period-filtered listings/orders sections.
 */

import { Card, CardHeader, Icon, Text } from '@repo/ui';
import React from 'react';

import { PeriodCard } from '../PeriodCard';

import * as S from './CardsPanel.style';
import type { CardsPanelProps } from './CardsPanel.types';

import { ListingCarousel } from '@/features/listings/carousel';
import { OrderCarousel } from '@/features/orders/carousel';

const SKELETON_KEYS = ['a', 'b', 'c', 'd'];

export const CardsPanelComponent = ({
  periods,
  selectedPeriod,
  onPeriodSelect,
  formatters,
  cardLabels,
  isLoading,
  listings,
  orders,
  onListingOpen,
  onListingsViewAll,
  onOrderOpen,
  onOrdersViewAll,
  listingsTitle,
  listingsCountLabel,
  listingsViewAllLabel,
  listingsEmptyTitle,
  listingsEmptySubtitle,
  ordersTitle,
  ordersCountLabel,
  ordersViewAllLabel,
  ordersEmptyTitle,
  ordersEmptySubtitle,
}: CardsPanelProps): React.ReactElement => (
  <S.Root>
    <S.Grid>
      {isLoading && periods.length === 0
        ? SKELETON_KEYS.map((key) => <S.SkeletonCard key={key} />)
        : periods.map((entry) => (
            <PeriodCard
              key={entry.key}
              title={entry.title}
              dateRange={entry.dates.dateRange}
              metrics={entry.metrics}
              headerGradient={entry.gradient}
              isActive={selectedPeriod === entry.key}
              onSelect={() => onPeriodSelect(entry.key)}
              formatters={formatters}
              labels={cardLabels}
            />
          ))}
    </S.Grid>

    <S.SectionsRow>
      <Card variant="bordered">
        <CardHeader
          icon={
            <S.SectionIcon>
              <Icon name="inventory-2" size={16} />
            </S.SectionIcon>
          }
          description={
            <Text variant="caption" color="text.tertiary">
              {listingsCountLabel}
            </Text>
          }
          actions={
            listings.length > 0 ? (
              <S.SectionAction type="button" onClick={onListingsViewAll}>
                <Text variant="caption" weight="semibold" color="inherit">
                  {listingsViewAllLabel}
                </Text>
                <Icon name="arrow-right" size={14} />
              </S.SectionAction>
            ) : undefined
          }
        >
          <Text variant="h4" weight="semibold">
            {listingsTitle}
          </Text>
        </CardHeader>
        <S.SectionBody>
          <ListingCarousel
            listings={listings}
            onViewAll={onListingsViewAll}
            viewAllLabel={listingsViewAllLabel}
            showViewAll={false}
            onListingClick={onListingOpen}
            emptyTitle={listingsEmptyTitle}
            emptySubtitle={listingsEmptySubtitle}
          />
        </S.SectionBody>
      </Card>

      <Card variant="bordered">
        <CardHeader
          icon={
            <S.SectionIcon>
              <Icon name="shopping-bag" size={16} />
            </S.SectionIcon>
          }
          description={
            <Text variant="caption" color="text.tertiary">
              {ordersCountLabel}
            </Text>
          }
          actions={
            orders.length > 0 ? (
              <S.SectionAction type="button" onClick={onOrdersViewAll}>
                <Text variant="caption" weight="semibold" color="inherit">
                  {ordersViewAllLabel}
                </Text>
                <Icon name="arrow-right" size={14} />
              </S.SectionAction>
            ) : undefined
          }
        >
          <Text variant="h4" weight="semibold">
            {ordersTitle}
          </Text>
        </CardHeader>
        <S.SectionBody>
          <OrderCarousel
            orders={orders}
            onViewAll={onOrdersViewAll}
            viewAllLabel={ordersViewAllLabel}
            showViewAll={false}
            onOrderClick={onOrderOpen}
            formatCurrency={formatters.currency}
            formatDate={formatters.date}
            emptyTitle={ordersEmptyTitle}
            emptySubtitle={ordersEmptySubtitle}
          />
        </S.SectionBody>
      </Card>
    </S.SectionsRow>
  </S.Root>
);
