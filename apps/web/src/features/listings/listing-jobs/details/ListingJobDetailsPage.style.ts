import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-sizing: border-box;
`;

export const SummaryTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const SummaryTitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const SummaryTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const SummaryActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

export const ProgressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const ProgressMeta = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const MetricsInline = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.md')};
`;

export const MetricInline = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const DotSep = styled.span`
  color: ${tkn('colors.text.tertiary')};
  user-select: none;
`;

export const ItemsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/** Dense item row — ASIN + status + ebay on one strip */
export const ItemCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const ItemCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ItemIds = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const ErrorBox = styled.div`
  font-family: ${tkn('typography.fontFamily.mono')};
  font-size: ${tkn('typography.fontSize.xs')};
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.semantic.error')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 4.5rem;
  overflow-y: auto;
`;

export const EmptyWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
`;

export const MonoId = styled(UIText)`
  font-family: ${tkn('typography.fontFamily.mono')};
`;

/** Reason + optional technical disclosure inside one table cell. */
export const FailureCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** Raw provider text is diagnostic, so it is collapsed by default. */
export const TechnicalDetails = styled.details`
  summary {
    cursor: pointer;
    list-style: none;
  }
`;
