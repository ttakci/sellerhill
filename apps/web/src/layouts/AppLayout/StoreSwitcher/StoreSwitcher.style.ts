import styled from '@emotion/styled';

import { LanguageSelectTrigger, LanguageText } from '../AppLayout.style';

/** Same trigger as the language menu beside it, capped so a long store name truncates. */
export const Trigger = styled(LanguageSelectTrigger)`
  max-width: 12rem;
  min-width: 0;
`;

/** The single-store label: the trigger's look without the hover affordance. */
export const StaticLabel = styled(LanguageSelectTrigger)`
  max-width: 12rem;
  min-width: 0;
  cursor: default;

  &:hover {
    background: transparent;
  }
`;

export const Label = styled(LanguageText)`
  overflow: hidden;
  text-overflow: ellipsis;
`;
