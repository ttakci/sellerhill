import type React from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './SettingsActionRow.style';
import type { SettingsActionRowProps } from './SettingsActionRow.types';

/**
 * A full-width settings list row: icon + label on the left, a chevron on the
 * right, a divider between rows. Used inside `SettingsCard` to build consistent
 * navigable settings sections across the app.
 */
export const SettingsActionRow = ({
  icon,
  label,
  onClick,
  variant = 'default',
  ariaLabel,
}: SettingsActionRowProps): React.ReactElement => {
  const isDanger = variant === 'danger';
  return (
    <S.Row type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      <S.Info>
        <Icon name={icon} size={18} color={isDanger ? 'semantic.error' : 'text.secondary'} />
        <Text variant="body-sm" weight="medium" color={isDanger ? 'semantic.error' : undefined}>
          {label}
        </Text>
      </S.Info>
      <Icon name="chevron-right" size={18} color={isDanger ? 'semantic.error' : 'brand.primary'} />
    </S.Row>
  );
};

SettingsActionRow.displayName = 'SettingsActionRow';
