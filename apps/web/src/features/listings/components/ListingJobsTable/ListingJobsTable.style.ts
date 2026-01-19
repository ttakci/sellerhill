import styled from '@emotion/styled';

export const ProgressContainer = styled.div`
  width: 100%;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const ProgressBarWrapper = styled.div`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.colors.background.tertiary};
  border-radius: ${({ theme }) => theme.radius.full};
  overflow: hidden;
`;

export const ProgressBar = styled.div<{ $progress: number; $status: string }>`
  width: ${({ $progress }) => `${$progress}%`};
  height: 100%;
  background: ${({ theme, $status }) => {
    if ($status === 'completed') return theme.colors.semantic.success;
    if ($status === 'failed') return theme.colors.semantic.error;
    return theme.colors.brand.primary;
  }};
  transition: width 0.3s ease;
`;

export const JobStats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: 0.75rem;
`;

export const StatItem = styled.span<{ $type: 'success' | 'failed' | 'total' }>`
  color: ${({ theme, $type }) => {
    if ($type === 'success') return theme.colors.semantic.success;
    if ($type === 'failed') return theme.colors.semantic.error;
    return theme.colors.text.secondary;
  }};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;
