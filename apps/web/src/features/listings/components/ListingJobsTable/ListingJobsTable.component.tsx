import type { ListingJobDto } from '@repo/shared';
import { Badge, Icon, Text } from '@repo/ui';
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

  return (
    <S.TableContainer>
      <S.Table>
        <thead>
          <tr>
            <S.Th>{t('listings.jobs.table.id')}</S.Th>
            <S.Th>{t('listings.jobs.table.date')}</S.Th>
            <S.Th>{t('listings.jobs.table.progress')}</S.Th>
            <S.Th>{t('listings.jobs.table.results')}</S.Th>
            <S.Th>{t('listings.jobs.table.status')}</S.Th>
            <S.Th>{t('listings.jobs.table.actions')}</S.Th>
          </tr>
        </thead>
        <tbody>
          {jobs.length > 0 ? (
            jobs.map((job) => {
              const progress = Math.round((job.processedCount / job.totalAsins) * 100) || 0;
              return (
                <tr key={job.id}>
                  <S.Td>
                    <Text variant="caption" style={{ fontFamily: 'monospace' }}>
                      {job.id.substring(0, 8)}...
                    </Text>
                  </S.Td>
                  <S.Td>
                    <Text variant="body">
                      {new Date(job.createdAt).toLocaleString()}
                    </Text>
                  </S.Td>
                  <S.Td>
                    <JS.ProgressContainer>
                      <JS.ProgressBarWrapper>
                        <JS.ProgressBar $progress={progress} $status={job.status} />
                      </JS.ProgressBarWrapper>
                      <Text variant="caption" color="text.tertiary">
                        {progress}% ({job.processedCount} / {job.totalAsins})
                      </Text>
                    </JS.ProgressContainer>
                  </S.Td>
                  <S.Td>
                    <JS.JobStats>
                      <JS.StatItem $type="success">{job.successCount} {t('translation:common.success')}</JS.StatItem>
                      <JS.StatItem $type="failed">{job.failedCount} {t('translation:common.failed')}</JS.StatItem>
                    </JS.JobStats>
                  </S.Td>
                  <S.Td>
                    <Badge variant={getJobStatusVariant(job.status)} size="sm">
                      {t(`listings.jobs.status.${job.status}`)}
                    </Badge>
                  </S.Td>
                  <S.Td>
                    <S.Actions>
                      <Icon name="eye" size={18} style={{ cursor: 'pointer', color: '#64748B' }} />
                    </S.Actions>
                  </S.Td>
                </tr>
              );
            })
          ) : !isLoading && (
            <tr>
              <td colSpan={6}>
                <S.EmptyState>
                  <Icon name="inbox" size={48} />
                  <Text variant="body">{t('listings.jobs.empty')}</Text>
                </S.EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </S.Table>
    </S.TableContainer>
  );
};
