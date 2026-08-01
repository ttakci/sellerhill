import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './FilePicker.style';
import type { FilePickerProps } from './FilePicker.types';

export const FilePicker = ({ accept, disabled, fileName, label, hint, onChange }: FilePickerProps) => (
  <S.Label>
    <S.Input type="file" accept={accept} disabled={disabled} onChange={onChange} />
    <Icon name="upload" size="md" color="brand.primary" />
    <S.Copy>
      <Text variant="body-sm" weight="semibold">{fileName || label}</Text>
      {hint ? <Text variant="caption" color="text.secondary">{hint}</Text> : null}
    </S.Copy>
  </S.Label>
);
