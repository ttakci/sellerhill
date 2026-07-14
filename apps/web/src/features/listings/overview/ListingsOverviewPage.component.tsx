import { Button, PageHeader, QuickActionCard, SettingsActionRow, SettingsCard, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListingCarousel } from '../carousel';

import * as S from './ListingsOverviewPage.style';
import type { ListingsOverviewPageProps } from './ListingsOverviewPage.types';

export const ListingsOverviewPageComponent: React.FC<ListingsOverviewPageProps> = ({
  listings,
  onAddListing,
  onViewAll,
  onViewJobs,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: listings.length })}
        actions={
          <Button variant="primary" onClick={onAddListing}>
            <Text>{t('listings.actions.addNewList')}</Text>
          </Button>
        }
      />

      <S.TwoColumnLayout>
        <S.SliderColumn>
          <S.SliderContent>
            <ListingCarousel
              listings={listings}
              onViewAll={onViewAll}
              viewAllLabel={t('listings.actions.viewAll')}
              showViewAll={listings.length > 3}
            />
          </S.SliderContent>
        </S.SliderColumn>

        <S.AddColumn>
          <S.AddCardStack>
            <QuickActionCard
              variant="brand"
              title={t('listings.addSection.title')}
              subtitle={t('listings.addSection.subtitle')}
              onClick={onAddListing}
            />
            <SettingsCard
              variant="section"
              className="other-actions-card"
              header={{
                title: t('listings.otherActions.title'),
              }}
            >
              <SettingsActionRow
                label={t('listings.otherActions.jobsTitle')}
                subtitle={t('listings.otherActions.jobsSubtitle')}
                onClick={onViewJobs}
              />
            </SettingsCard>
          </S.AddCardStack>
        </S.AddColumn>
      </S.TwoColumnLayout>
    </S.Container>
  );
};
