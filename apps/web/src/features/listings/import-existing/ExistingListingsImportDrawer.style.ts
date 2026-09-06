import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Stack = styled.div`display:flex;flex-direction:column;gap:${tkn('spacing.lg')};`;
export const Panel = styled(Card)`display:flex;flex-direction:column;gap:${tkn('spacing.md')};`;
export const Grid = styled.div`display:flex;flex-direction:column;gap:${tkn('spacing.md')};`;
export const Actions = styled.div`display:flex;justify-content:flex-start;`;
