import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Stack = styled.div`display:flex;flex-direction:column;gap:${tkn('spacing.lg')};`;
export const Panel = styled(Card)`display:flex;flex-direction:column;gap:${tkn('spacing.md')};`;
export const Grid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${tkn('spacing.md')};@media(max-width:${tkn('breakpoints.mdBelow')}){grid-template-columns:1fr;}`;
export const Actions = styled.div`display:flex;justify-content:flex-start;`;
