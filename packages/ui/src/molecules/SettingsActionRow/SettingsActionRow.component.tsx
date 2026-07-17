import type React from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './SettingsActionRow.style';
import type { SettingsActionRowProps } from './SettingsActionRow.types';

/**
 * Settings list row — clear type hierarchy (readable, not washed out).
 * Avoid Emotion component selectors (`${Arrow}`) — no babel plugin in this monorepo.
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
    <S.Row type="button" onClick={onClick} aria-label={ariaLabel ?? label} $danger={isDanger}>
      <S.Info>
        {icon && (
          <S.RowIcon $danger={isDanger}>
            <Icon name={icon} size={18} color={tone} />
          </S.RowIcon>
        )}
        <S.TextStack>
          <Text variant="body" weight="semibold" color={isDanger ? 'semantic.error' : 'text.primary'}>
            {label}
          </Text>
          {subtitle && (
            <Text variant="body-sm" color="text.secondary">
              {subtitle}
            </Text>
          )}
        </S.TextStack>
      </S.Info>
      <S.Arrow $danger={isDanger}>
        <Icon name="arrow-right" size={18} color={tone} />
      </S.Arrow>
    </S.Row>
  );
};

SettingsActionRow.displayName = 'SettingsActionRow';
