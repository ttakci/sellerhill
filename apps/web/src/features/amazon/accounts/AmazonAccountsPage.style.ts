import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.md')};
  }
`;

export const AccountsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18.75rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.md')};
`;

export const IconWrapper = styled.div`
  width: 3rem;
  height: 3rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.semanticTint.success')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const CardActions = styled.div`
  display: flex;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.md')};
  padding-top: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const EmptyStateInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const EmptyIconWrapper = styled.div`
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: ${tkn('colors.semanticTint.info')};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const EmptyDesc = styled(Text)`
  margin: ${tkn('spacing.sm')} 0 ${tkn('spacing.lg')} 0;
  max-width: 26rem;
`;

export const FormFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 20rem;
`;

export const InfoText = styled(Text)`
  font-style: italic;
`;

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.md')};
`;
