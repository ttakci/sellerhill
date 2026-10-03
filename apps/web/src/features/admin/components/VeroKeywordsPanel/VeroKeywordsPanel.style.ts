import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { ListPane, Row, RowActions, Section } from '../../AdminPage/AdminPage.style';

/** The add form: textarea above its button, the button never stretched. */
export const AddForm = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
`;

export const AddField = styled.div`
  width: 100%;
`;

/** Previous / next under the list, with the page position between them. */
export const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;
