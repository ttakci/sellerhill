import { DataTable, PageHeader, StatusBadge } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingJobsPage.style';
import type { ListingJobsPageComponentProps } from './ListingJobsPage.types';

export const ListingJobsPageComponent: React.FC<ListingJobsPageComponentProps> = ({
  jobs,
  onViewDetails,
  pagination,
  columns,
  onDownload,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (job: {
    id: string;
    totalAsins: number;
    processedCount: number;
    status: string;
    successCount: number;
    failedCount: number;
    createdAt: string | Date;
  }) => {
    const percent = job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;
    return (
      <S.GridCard key={job.id} variant="interactive" onClick={() => onViewDetails(job.id)}>
        <S.GridCardHeader>
          <S.JobIdBadge variant="neutral" size="sm">
            {job.id.substring(0, 8)}...
          </S.JobIdBadge>
          <StatusBadge status={job.status.toLowerCase()}>
            {t(`listings.jobs.status.${job.status.toLowerCase()}`)}
          </StatusBadge>
        </S.GridCardHeader>
        <S.CardContent>
          <S.ProgressSection>
            <S.ProgressHeader>
              <S.ProgressLabel variant="body-sm" weight="medium" color="text.secondary">
                {t('listings.jobs.table.progress')}
              </S.ProgressLabel>
              <S.ProgressValue variant="body-sm" weight="bold" color="brand.primary">
                {percent}%
              </S.ProgressValue>
            </S.ProgressHeader>
            <S.ProgressBar>
              <S.ProgressFill $percent={percent} />
            </S.ProgressBar>
          </S.ProgressSection>
          <S.StatsContainer>
            <S.StatItem>
              <S.SuccessText variant="body-sm" weight="bold" color="semantic.success">
                {job.successCount}
              </S.SuccessText>
              <S.StatLabel variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.success')}
              </S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.FailedText variant="body-sm" weight="bold" color="semantic.error">
                {job.failedCount}
              </S.FailedText>
              <S.StatLabel variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.failed')}
              </S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.TotalText variant="body-sm" weight="bold" color="text.primary">
                {job.totalAsins}
              </S.TotalText>
              <S.StatLabel variant="caption" color="text.tertiary">
                {t('listings.jobs.table.total')}
              </S.StatLabel>
            </S.StatItem>
          </S.StatsContainer>
        </S.CardContent>
        <S.CardFooter>
          <S.DateText variant="body-sm" weight="medium" color="text.secondary">
            {new Date(job.createdAt).toLocaleDateString()}
          </S.DateText>
          <S.ActionButton
            variant="secondary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(job.id);
            }}
          >
            {t('translation:common.details')}
          </S.ActionButton>
        </S.CardFooter>
      </S.GridCard>
    );
  };

  return (
    <S.Container>
      <PageHeader title={t('listings.jobs.title')} subtitle={t('listings.jobs.subtitle')} />

      <DataTable
        columns={columns}
        data={jobs}
        renderGridCard={renderGridCard}
        emptyMessage={t('listings.jobs.empty')}
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.Container>
  );
};
