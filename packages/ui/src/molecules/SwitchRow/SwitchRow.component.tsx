import React from 'react';

import { Text } from '../../atoms/Text';
import { Toggle } from '../../atoms/Toggle';

import * as S from './SwitchRow.style';
import type { SwitchRowProps } from './SwitchRow.types';

export const SwitchRow = ({
  title,
  description,
  checked,
  onChange,
  disabled,
  className,
}: SwitchRowProps): React.ReactElement => {
  return (
    <S.Container className={className}>
      <S.TextContent>
        <Text variant="body" weight="medium">
          {title}
        </Text>
        {description && (
          <Text variant="caption" muted>
            {description}
          </Text>
        )}
      </S.TextContent>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </S.Container>
  );
};
