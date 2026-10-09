import { Icon, Tooltip } from '@repo/ui';
import type React from 'react';

import * as S from './CancelJobButton.style';
import type { CancelJobButtonProps } from './CancelJobButton.types';

/** Its name is on the tooltip; a tap on a phone goes to the confirm dialog, which names it. */
export const CancelJobButton: React.FC<CancelJobButtonProps> = ({ label, onClick, disabled }) => (
  <Tooltip content={label} position="top" variant="dark">
    <S.CancelX variant="ghost" aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name="x" size={16} />
    </S.CancelX>
  </Tooltip>
);

CancelJobButton.displayName = 'CancelJobButton';
