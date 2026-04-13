import React from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './SettingsCard.style';
import { SettingsCardProps } from './SettingsCard.types';

export const SettingsCard: React.FC<SettingsCardProps> = ({
  variant = 'section',
  header,
  headerLeft,
  headerRight,
  children,
  className,
}) => {
  const showHeader = header || headerLeft || headerRight;

  return (
    <S.CardContainer $variant={variant} className={className}>
      {showHeader && (
        <S.CardHeader $variant={variant}>
          <S.HeaderLeft $variant={variant}>
            {headerLeft ? (
              headerLeft
            ) : (
              <>
                {header?.icon && (
                  <S.IconWrapper
                    $type={
                      header.icon === 'map-pin'
                        ? 'location'
                        : header.icon === 'check-list'
                          ? 'validation'
                          : header.icon === 'block'
                            ? 'blacklist'
                            : undefined
                    }
                  >
                    <Icon name={header.icon} size={20} />
                  </S.IconWrapper>
                )}
                {header && (
                  <S.TitleContent>
                    <S.Title>{header.title}</S.Title>
                    {header.subtitle && (
                      <Text variant="caption" color="text.secondary">
                        {header.subtitle}
                      </Text>
                    )}
                  </S.TitleContent>
                )}
              </>
            )}
          </S.HeaderLeft>
          {variant === 'panel' && headerRight && <S.HeaderRight $variant={variant}>{headerRight}</S.HeaderRight>}
        </S.CardHeader>
      )}
      {children && <S.CardBody>{children}</S.CardBody>}
    </S.CardContainer>
  );
};

SettingsCard.displayName = 'SettingsCard';
