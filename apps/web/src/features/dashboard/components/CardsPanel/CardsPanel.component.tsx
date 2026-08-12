/**
 * CardsPanel (Presentation)
 * Period KPI cards + the period-filtered listings/orders sections.
 */

import { Button, Skeleton, Text } from '@repo/ui';
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
  listingsViewAllLabel,
  listingsEmptyTitle,
  listingsEmptySubtitle,
  ordersTitle,
  ordersViewAllLabel,
  ordersEmptyTitle,
  ordersEmptySubtitle,
}: CardsPanelProps): React.ReactElement => (
  <S.Root>
    <S.Grid>
      {isLoading && periods.length === 0
        ? SKELETON_KEYS.map((key) => <Skeleton key={key} height="19rem" radius="lg" />)
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
      <S.CarouselSection>
        <S.SectionHeading>
          <Text variant="h4" weight="semibold">
            {listingsTitle}
          </Text>
          <Button variant="text" size="small" onClick={onListingsViewAll}>
            <Text variant="body-sm" weight="semibold">
              {listingsViewAllLabel}
            </Text>
          </Button>
        </S.SectionHeading>
        <ListingCarousel
          listings={listings}
          onViewAll={onListingsViewAll}
          viewAllLabel={listingsViewAllLabel}
          showViewAll={false}
          onListingClick={onListingOpen}
          emptyTitle={listingsEmptyTitle}
          emptySubtitle={listingsEmptySubtitle}
        />
      </S.CarouselSection>

      <S.CarouselSection>
        <S.SectionHeading>
          <Text variant="h4" weight="semibold">
            {ordersTitle}
          </Text>
          <Button variant="text" size="small" onClick={onOrdersViewAll}>
            <Text variant="body-sm" weight="semibold">
              {ordersViewAllLabel}
            </Text>
          </Button>
        </S.SectionHeading>
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
      </S.CarouselSection>
    </S.SectionsRow>
  </S.Root>
);
