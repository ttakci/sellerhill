import React from 'react';

import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Text } from '../../atoms/Text';

import * as S from './PageHeader.style';
import type { PageHeaderProps } from './PageHeader.types';

/**
 * Canonical page title for AppLayout screens.
 * Title: h1 / semibold · Subtitle: body-sm / secondary
 * Spacing under the block: parent `PageContainer` gap (do not add margin).
 */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  className,
  noMargin,
  onBack,
  backAriaLabel,
  backMobileOnly,
}: PageHeaderProps): React.ReactElement => {
  return (
    <S.HeaderWrapper className={className} $noMargin={noMargin}>
      <S.TitleRow>
        {onBack && (
          <S.BackButtonWrap $mobileOnly={!!backMobileOnly}>
            <IconButton variant="ghost" onClick={onBack} aria-label={backAriaLabel || 'Back'}>
              <Icon name="chevron-left" size={20} />
            </IconButton>
          </S.BackButtonWrap>
        )}
        <S.TitleArea>
          <Text variant="h1" weight="semibold" color="text.primary">
            {title}
          </Text>
          {subtitle && (
            <Text variant="body-sm" color="text.secondary">
              {subtitle}
            </Text>
          )}
        </S.TitleArea>
      </S.TitleRow>
      {actions && <S.ActionsArea>{actions}</S.ActionsArea>}
    </S.HeaderWrapper>
  );
};

PageHeader.displayName = 'PageHeader';
