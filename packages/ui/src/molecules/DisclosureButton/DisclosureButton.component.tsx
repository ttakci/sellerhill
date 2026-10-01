import type React from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './DisclosureButton.style';
import type { DisclosureButtonProps } from './DisclosureButton.types';

/**
 * Header row of a section that expands in place (an accordion group). The
 * title stays in the page's own ink — it is a heading that happens to be
 * clickable, not a link — and the chevron is the only thing that says so.
 * Avoid Emotion component selectors (no babel plugin in this monorepo).
 */
export const DisclosureButton = ({
  label,
  meta,
  isOpen,
  onToggle,
  controlsId,
}: DisclosureButtonProps): React.ReactElement => (
  <S.Row type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={controlsId}>
    <S.Info>
      <Text variant="h4" weight="semibold">
        {label}
      </Text>
      {meta}
    </S.Info>
    <S.Chevron $isOpen={isOpen}>
      <Icon name="chevron-down" size={18} />
    </S.Chevron>
  </S.Row>
);

DisclosureButton.displayName = 'DisclosureButton';
