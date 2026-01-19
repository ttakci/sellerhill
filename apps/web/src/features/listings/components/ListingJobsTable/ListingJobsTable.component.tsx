import type { ListingJobDto } from '@repo/shared';
import { Badge, Icon, Table, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from '../../ListingsPage.style';
import * as JS from './ListingJobsTable.style';

interface ListingJobsTableProps {
  jobs: ListingJobDto[];
  isLoading: boolean;
}

export const ListingJobsTable: React.FC<ListingJobsTableProps> = ({ jobs, isLoading }) => {
  const { t } = useTranslation(['listings', 'translation']);

  const getJobStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'primary';
      default: return 'secondary';
    }
  };

  const columns = [
    {
      key: 'id',
      header: t('listings.jobs.table.id'),
      render: (id: string) => (
        <Text variant="caption" style={{ fontFamily: 'monospace' }}>
          {id.substring(0, 8)}...
        </Text>
      )
    },
    {
      key: 'createdAt',
      header: t('listings.jobs.table.date'),
      render: (date: string) => (
        <Text variant="body">
          {new Date(date).toLocaleString()}
        </Text>
      )
    },
    {
      key: 'progress',
      header: t('listings.jobs.table.progress'),
      render: (_: any, job: ListingJobDto) => {
        const progress = Math.round((job.processedCount / job.totalAsins) * 100) || 0;
        return (
          <JS.ProgressContainer>
            <JS.ProgressBarWrapper>
              <JS.ProgressBar $progress={progress} $status={job.status} />
            </JS.ProgressBarWrapper>
            <Text variant="caption" color="text.tertiary">
              {progress}% ({job.processedCount} / {job.totalAsins})
            </Text>
          </JS.ProgressContainer>
        );
      }
    },
    {
      key: 'results',
      header: t('listings.jobs.table.results'),
      render: (_: any, job: ListingJobDto) => (
        <JS.JobStats>
          <JS.StatItem $type="success">{job.successCount} {t('translation:common.success')}</JS.StatItem>
          <JS.StatItem $type="failed">{job.failedCount} {t('translation:common.failed')}</JS.StatItem>
        </JS.JobStats>
      )
    },
    {
      key: 'status',
      header: t('listings.jobs.table.status'),
      render: (status: string) => (
        <Badge variant={getJobStatusVariant(status)} size="sm">
          {t(`listings.jobs.status.${status}`)}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: t('listings.jobs.table.actions'),
      render: () => (
        <S.Actions>
          <Icon name="eye" size={18} style={{ cursor: 'pointer', color: '#64748B' }} />
        </S.Actions>
      )
    }
  ];

  return (
    <Table<ListingJobDto>
      columns={columns}
      data={jobs}
      emptyMessage={t('listings.jobs.empty')}
    />
  );
};
