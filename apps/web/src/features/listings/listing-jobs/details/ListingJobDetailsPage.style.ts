import styled from '@emotion/styled';

export const Container = styled.div`
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
`;

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
  transition: color 0.2s;

  &:hover {
    color: #2563eb;
  }

  .dark & {
    color: #94a3b8;
    &:hover {
      color: #60a5fa;
    }
  }
`;

export const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;

  .dark & {
    color: white;
  }

  small {
    font-size: 14px;
    font-weight: 500;
    color: #64748b;
    margin-left: 8px;
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
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

export const AsinText = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  color: #2563eb;
`;

export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 400px;
`;

export const ErrorText = styled.div`
  font-size: 12px;
  color: #dc2626;
  font-weight: 500;

  .dark & {
    color: #f87171;
  }
`;

export const ExceptionBadge = styled.div`
  font-size: 10px;
  font-family: ui-monospace, monospace;
  background: #fef2f2;
  color: #991b1b;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #fee2e2;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;

  .dark & {
    background: rgba(220, 38, 38, 0.1);
    color: #fca5a5;
    border-color: rgba(220, 38, 38, 0.2);
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
      case 'active':
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
      case 'error':
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
