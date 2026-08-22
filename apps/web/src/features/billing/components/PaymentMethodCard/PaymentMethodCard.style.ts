import styled from '@emotion/styled';
import { SettingsCard, tkn } from '@repo/ui';

export const Card = styled(SettingsCard)`
  width: 100%;
  max-width: 40rem;
  align-self: flex-start;
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const CardIdentity = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
