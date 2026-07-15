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
  subtitle,
  onClick,
  variant = 'default',
  ariaLabel,
}: SettingsActionRowProps): React.ReactElement => {
  const isDanger = variant === 'danger';
  const tone = isDanger ? 'semantic.error' : 'brand.primary';
  return (
    <S.Row type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      <S.Info>
        {icon && <Icon name={icon} size={18} color={tone} />}
        <S.TextStack>
          <Text variant="body-sm" weight="medium" color={isDanger ? 'semantic.error' : undefined}>
            {label}
          </Text>
          {subtitle && (
            <Text variant="caption" color="text.tertiary">
              {subtitle}
            </Text>
          )}
        </S.TextStack>
      </S.Info>
      <S.Arrow>
        <Icon name="arrow-right" size={18} color={tone} />
      </S.Arrow>
    </S.Row>
  );
};

SettingsActionRow.displayName = 'SettingsActionRow';
