import styled from '@emotion/styled';

export const Container = styled.div`
  width: 100%;
  max-width: 1440px;
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
  gap: 24px;
  margin-bottom: 32px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    margin: 0;

    .dark & {
      color: white;
    }
  }

  p {
    font-size: 14px;
    color: #64748b;
    margin-top: 4px;

    .dark & {
      color: #94a3b8;
    }
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &:hover {
    background: #f8fafc;
  }

  svg {
    margin-right: 8px;
    font-size: 20px;
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
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const THead = styled.thead`
  background: #f8fafc;

  .dark & {
    background: rgba(30, 41, 59, 0.5);
  }
`;

export const TH = styled.th`
  padding: 16px 24px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #f1f5f9;

  .dark & {
    color: #64748b;
    border-bottom: 1px solid #1e293b;
  }
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.2s;

    &:hover {
      background: rgba(248, 250, 252, 0.5);
    }

    &:last-child {
      border-bottom: none;
    }

    .dark & {
      border-bottom: 1px solid #1e293b;

      &:hover {
        background: rgba(30, 41, 59, 0.3);
      }
    }
  }
`;

export const TD = styled.td`
  padding: 20px 24px;
  font-size: 14px;
  color: #334155;
  vertical-align: middle;

  .dark & {
    color: #cbd5e1;
  }
`;

export const JobIdBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  border: 1px solid #e2e8f0;

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }
`;

export const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
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
  gap: 6px;
  min-width: 120px;
`;

export const ProgressInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;

  .dark & {
    background: #1e293b;
  }
`;

export const ProgressFill = styled.div<{ $percent: number }>`
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: #2563eb;
  border-radius: 9999px;
  transition: width 0.3s ease;
`;

export const StatsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
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
  font-size: 14px;
  font-weight: 500;
  color: #64748b;

  .dark & {
    color: #94a3b8;
  }
`;

export const ActionButton = styled.button`
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

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
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.5);
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-top: 1px solid #1e293b;
  }
`;

export const PaginationInfo = styled.div`
  font-size: 14px;
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
  gap: 8px;
`;

export const PageNavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
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
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
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
  padding: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #94a3b8;
`;

export const AsinText = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  color: #2563eb;
`;

export const ErrorText = styled.div`
  font-size: 12px;
  color: #dc2626;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .dark & {
    color: #f87171;
  }
`;
