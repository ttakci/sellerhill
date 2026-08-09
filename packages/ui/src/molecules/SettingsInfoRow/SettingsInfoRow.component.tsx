import type React from 'react';

import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Text } from '../../atoms/Text';

import * as S from './SettingsInfoRow.style';
import type { SettingsInfoRowProps } from './SettingsInfoRow.types';

/**
 * Read-only label/value row with an inline edit action — the "Contact Info"
 * card pattern (icon, label, value, pencil), distinct from SettingsActionRow
 * which navigates into a whole drawer via a full-row click.
 */
export const SettingsInfoRow = ({
  icon,
  label,
  value,
  onEdit,
  editAriaLabel,
}: SettingsInfoRowProps): React.ReactElement => {
  return (
    <S.Row>
      <S.Left>
        <S.RowIcon>
          <Icon name={icon} size={18} color="brand.primary" />
        </S.RowIcon>
        <Text variant="body-sm" color="text.secondary">
          {label}
        </Text>
      </S.Left>
      <S.Right>
        <S.Value>
          <Text variant="body" weight="semibold" color="text.primary">
            {value}
          </Text>
        </S.Value>
        {onEdit && (
          <IconButton variant="ghost" onClick={onEdit} aria-label={editAriaLabel ?? label}>
            <Icon name="edit" size={16} color="brand.primary" />
          </IconButton>
        )}
      </S.Right>
    </S.Row>
  );
};

SettingsInfoRow.displayName = 'SettingsInfoRow';
