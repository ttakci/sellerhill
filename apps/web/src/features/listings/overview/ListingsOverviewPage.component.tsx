import { PageHeader, QuickActionCard, SettingsActionRow, SettingsCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListingCarousel } from '../carousel';

import * as S from './ListingsOverviewPage.style';
import type { ListingsOverviewPageProps } from './ListingsOverviewPage.types';

export const ListingsOverviewPageComponent: React.FC<ListingsOverviewPageProps> = ({
  listings,
  totalCount,
  draftCount,
  onAddListing,
  onViewAll,
  onViewJobs,
  onImportExisting,
  onViewDrafts,
  onListingClick,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const draftsSubtitle =
    draftCount > 0
      ? t('listings.draftMode.pageSubtitle', { count: draftCount })
      : t('listings.otherActions.draftsSubtitle');

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: totalCount })}
      />

      <S.TwoColumnLayout>
        <S.SliderColumn>
          <S.SliderContent>
            <ListingCarousel
              listings={listings}
              onViewAll={onViewAll}
              viewAllLabel={t('listings.actions.viewAll')}
              showViewAll={totalCount > 3}
              onListingClick={onListingClick}
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
              header={{
                title: t('listings.otherActions.title'),
              }}
            >
              <SettingsActionRow
                label={t('listings.otherActions.draftsTitle')}
                subtitle={draftsSubtitle}
                onClick={onViewDrafts}
              />
              <SettingsActionRow
                label={t('listings.existingImport.actionTitle')}
                subtitle={t('listings.existingImport.actionSubtitle')}
                onClick={onImportExisting}
              />
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
