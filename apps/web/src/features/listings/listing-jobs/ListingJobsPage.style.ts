import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem; /* 24px */
  margin-bottom: 2rem; /* 32px */

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;

  h1 {
    font-size: 1.5rem; /* 24px */
    font-weight: 700;
    color: ${tkn('colors.text.primary')};
    letter-spacing: -0.025em;
    margin: 0;
  }

  p {
    font-size: 0.875rem; /* 14px */
    color: ${tkn('colors.text.secondary')};
    margin-top: 0.25rem; /* 4px */
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 0.75rem; /* 12px */
`;

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem; /* 8px 16px */
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: 0.5rem; /* 8px */
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  color: ${tkn('colors.text.primary')};
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: ${tkn('shadows.sm')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }

  svg {
    margin-right: 0.5rem; /* 8px */
    font-size: 1.25rem; /* 20px */
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;

    &:hover {
      background: #334155;
    }
  }
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: 0.75rem; /* 12px */
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const THead = styled.thead`
  background: ${tkn('colors.background.tertiary')};
`;

export const TH = styled.th`
  padding: 1rem 1.5rem; /* 16px 24px */
  font-size: 0.6875rem; /* 11px */
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
    transition: background 0.2s;

    &:hover {
      background: rgba(248, 250, 252, 0.5);
    }

    &:last-child {
      border-bottom: none;
    }

    .dark & {
      border-bottom: 0.0625rem solid #1e293b; /* 1px */

      &:hover {
        background: rgba(30, 41, 59, 0.3);
      }
    }
  }
`;

export const TD = styled.td`
  padding: 1.25rem 1.5rem; /* 20px 24px */
  font-size: 0.875rem; /* 14px */
  color: #334155;
  vertical-align: middle;

  .dark & {
    color: #cbd5e1;
  }
`;

export const JobIdBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem; /* 2px 10px */
  background: #f1f5f9;
  border-radius: 0.375rem; /* 6px */
  font-size: 0.75rem; /* 12px */
  font-weight: 500;
  color: #475569;
  border: 0.0625rem solid #e2e8f0; /* 1px */

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }
`;

export const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem; /* 4px 10px */
  border-radius: 624.9375rem; /* 9999px */
  font-size: 0.75rem; /* 12px */
  font-weight: 600;

  ${({ $status }) => {
    switch ($status.toLowerCase()) {
      case 'completed':
        return `
          background: #ecfdf5;
          color: #059669;
          .dark & { background: rgba(16, 185, 129, 0.1); color: #34d399; }
        `;
      case 'processing':
        return `
          background: #eff6ff;
          color: #2563eb;
          .dark & { background: rgba(37, 99, 235, 0.1); color: #60a5fa; }
        `;
      case 'failed':
        return `
          background: #fef2f2;
          color: #dc2626;
          .dark & { background: rgba(220, 38, 38, 0.1); color: #f87171; }
        `;
      default:
        return `
          background: #f8fafc;
          color: #64748b;
          .dark & { background: #1e293b; color: #94a3b8; }
        `;
    }
  }}
`;

export const ProgressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem; /* 6px */
  min-width: 7.5rem; /* 120px */
`;

export const ProgressInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem; /* 10px */
  font-weight: 700;
  color: #64748b;
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 0.375rem; /* 6px */
  background: #f1f5f9;
  border-radius: 624.9375rem; /* 9999px */
  overflow: hidden;

  .dark & {
    background: #1e293b;
  }
`;

export const ProgressFill = styled.div<{ $percent: number }>`
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: #2563eb;
  border-radius: 624.9375rem; /* 9999px */
  transition: width 0.3s ease;
`;

export const StatsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem; /* 6px */
  font-size: 0.75rem; /* 12px */
`;

export const SuccessText = styled.span`
  color: #059669;
  font-weight: 700;

  .dark & {
    color: #34d399;
  }
`;

export const FailedText = styled.span`
  color: #dc2626;
  font-weight: 700;

  .dark & {
    color: #f87171;
  }
`;

export const TotalText = styled.span`
  color: #94a3b8;
  font-weight: 500;
`;

export const DateText = styled.span`
  font-size: 0.875rem; /* 14px */
  font-weight: 500;
  color: #64748b;

  .dark & {
    color: #94a3b8;
  }
`;

export const ActionButton = styled.button`
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
  color: #475569;
  padding: 0.375rem 0.75rem; /* 6px 12px */
  border: 0.0625rem solid #e2e8f0; /* 1px */
  border-radius: 0.5rem; /* 8px */
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05); /* 1px 2px */

  &:hover {
    color: #2563eb;
    background: white;
    border-color: #2563eb;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;

    &:hover {
      color: #60a5fa;
      border-color: #60a5fa;
    }
  }
`;

export const PaginationFooter = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  background: ${tkn('colors.background.tertiary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const PaginationInfo = styled.div`
  font-size: 0.875rem; /* 14px */
  font-weight: 500;
  color: #64748b;

  span {
    color: #0f172a;
    .dark & {
      color: white;
    }
  }
`;

export const PaginationActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
`;

export const PageNavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem; /* 8px */
  color: #94a3b8;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: #2563eb;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const PageNumberButton = styled.button<{ $active?: boolean }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 0.375rem; /* 6px */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem; /* 14px */
  font-weight: ${({ $active }) => ($active ? '700' : '500')};
  background: ${({ $active }) => ($active ? '#2563eb' : 'transparent')};
  color: ${({ $active }) => ($active ? 'white' : '#475569')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? '#2563eb' : '#f1f5f9')};
    .dark & {
      background: ${({ $active }) => ($active ? '#2563eb' : '#1e293b')};
      color: #e2e8f0;
    }
  }

  .dark & {
    color: ${({ $active }) => ($active ? 'white' : '#94a3b8')};
  }
`;

export const EmptyState = styled.div`
  padding: 5rem; /* 80px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem; /* 16px */
  color: #94a3b8;
`;

export const AsinText = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  color: #2563eb;
`;

export const ErrorText = styled.div`
  font-size: 0.75rem; /* 12px */
  color: #dc2626;
  max-width: 18.75rem; /* 300px */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .dark & {
    color: #f87171;
  }
`;
