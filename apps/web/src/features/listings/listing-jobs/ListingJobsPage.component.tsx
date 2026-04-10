import { Icon, PageHeader, StatusBadge, Table, TablePagination } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingJobsPage.style';
import type { ListingJobsPageComponentProps } from './ListingJobsPage.types';

export const ListingJobsPageComponent: React.FC<ListingJobsPageComponentProps> = ({
  jobs,
  isLoading,
  onViewDetails,
  pagination,
  columns,
  viewMode,
  onViewModeChange,
  onDownload,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const viewToggle = (
    <S.ToolbarGroup>
      <S.ViewToggleGroup>
        <S.ToggleButton
          $active={viewMode === 'grid'}
          onClick={() => onViewModeChange('grid')}
          title={t('translation:common.views.grid')}
        >
          <Icon name="grid-view" size={20} />
        </S.ToggleButton>
        <S.ToggleButton
          $active={viewMode === 'table'}
          onClick={() => onViewModeChange('table')}
          title={t('translation:common.views.table')}
        >
          <Icon name="format-list-bulleted" size={20} />
        </S.ToggleButton>
      </S.ViewToggleGroup>
      <S.ViewLabel variant="caption" color="text.secondary">
        {t('translation:common.views.label')}: <strong>{t(`translation:common.views.${viewMode}`)}</strong>
      </S.ViewLabel>
    </S.ToolbarGroup>
  );

  const toolbarActions = (
    <S.ToolbarGroup>
      <S.IconButton variant="ghost" title={t('translation:common.actions.filter')}>
        <Icon name="filter-list" size={20} />
      </S.IconButton>
      <S.IconButton variant="ghost" onClick={onDownload} title={t('translation:common.actions.export')}>
        <Icon name="download" size={20} />
      </S.IconButton>
    </S.ToolbarGroup>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('listings.jobs.title')}
        subtitle={t('listings.jobs.subtitle')}
      />

      <S.Toolbar>
        {viewToggle}
        {toolbarActions}
      </S.Toolbar>

      {viewMode === 'table' ? (
        <Table columns={columns} data={jobs} emptyMessage={t('listings.jobs.empty')} pagination={pagination} />
      ) : (
        <>
          <S.GridContainer>
            {jobs.map((job) => {
              const percent = job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;
              return (
                <S.GridCard key={job.id} variant="interactive" onClick={() => onViewDetails(job.id)}>
                  <S.GridCardHeader>
                    <S.JobIdBadge variant="neutral" size="sm">{job.id.substring(0, 8)}...</S.JobIdBadge>
                    <StatusBadge status={job.status.toLowerCase()}>
                      {t(`listings.jobs.status.${job.status.toLowerCase()}`)}
                    </StatusBadge>
                  </S.GridCardHeader>
                  <S.CardContent>
                    <S.ProgressContainer>
                      <S.ProgressInfo>
                        <span>{t('listings.jobs.table.progress')}</span>
                        <span>{percent}%</span>
                      </S.ProgressInfo>
                      <S.ProgressBar>
                        <S.ProgressFill $percent={percent} />
                      </S.ProgressBar>
                    </S.ProgressContainer>
                    <S.StatsContainer>
                      <S.SuccessText variant="body-sm" weight="bold" color="semantic.success">
                        {job.successCount} {t('listings.jobs.stats.success')}
                      </S.SuccessText>
                      <S.FailedText variant="body-sm" weight="bold" color="semantic.error">
                        {job.failedCount} {t('listings.jobs.stats.failed')}
                      </S.FailedText>
                      <S.TotalText variant="body-sm" weight="medium" color="text.tertiary">/ {job.totalAsins}</S.TotalText>
                    </S.StatsContainer>
                  </S.CardContent>
                  <S.CardFooter>
                    <S.DateText variant="body-sm" weight="medium" color="text.secondary">{new Date(job.createdAt).toLocaleDateString()}</S.DateText>
                    <S.ActionButton variant="secondary"
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
            })}
          </S.GridContainer>
          {pagination && (
            <S.GridPagination>
              <TablePagination {...pagination} />
            </S.GridPagination>
          )}
        </>
      )}
    </S.Container>
  );
};
