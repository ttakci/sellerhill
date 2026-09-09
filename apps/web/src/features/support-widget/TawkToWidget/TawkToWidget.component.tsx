import { Icon, Text, Tooltip } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './TawkToWidget.style';
import type { TawkToWidgetComponentProps } from './TawkToWidget.types';

export const TawkToWidgetComponent = ({
  isSidebarLauncher,
  sidebarCollapsed,
  unreadCount,
  onOpen,
}: TawkToWidgetComponentProps): React.ReactElement | null => {
  const { t } = useTranslation(['translation']);

  if (!isSidebarLauncher) {
    return null;
  }

  const unreadLabel = unreadCount > 99 ? t('translation:chatbot.unreadOverflow') : String(unreadCount);

  if (sidebarCollapsed) {
    return (
      <S.CollapsedLauncherAnchor>
        <Tooltip content={t('translation:chatbot.openAria')} position="right">
          <S.CollapsedLauncher onClick={onOpen} aria-label={t('translation:chatbot.openAria')} variant="ghost">
            <Icon name="headset" size={20} />
            {unreadCount > 0 ? (
              <S.UnreadBadge aria-label={t('translation:chatbot.unreadAria', { count: unreadCount })}>
                <Text variant="body-xs" weight="semibold" color="text.inverse" numeric>
                  {unreadLabel}
                </Text>
              </S.UnreadBadge>
            ) : null}
          </S.CollapsedLauncher>
        </Tooltip>
      </S.CollapsedLauncherAnchor>
    );
  }

  return (
    <S.LauncherCard>
      <Text variant="body" weight="semibold" color="sidebar.text">
        {t('translation:chatbot.sidebarTitle')}
      </Text>
      <S.LauncherButtonAnchor>
        {/*
          `S.LauncherButton` overrides the atom's variant colors with the
          sidebar's own tokens (see TawkToWidget.style.ts) — `primary`'s fill
          is the exact hex of `colors.sidebar.accent`, the SELECTED nav-item
          color, so a filled-blue CTA here read as if this card were an
          active menu item. `Text` never inherits `currentColor`, so its
          color must be named explicitly, same as the title/subtitle above.
        */}
        <S.LauncherButton variant="secondary" size="small" fullWidth onClick={onOpen}>
          <Icon name="headset" size={16} />
          <Text variant="body-sm" weight="semibold" color="sidebar.text">
            {t('translation:chatbot.ctaLabel')}
          </Text>
        </S.LauncherButton>
        {unreadCount > 0 ? (
          <S.UnreadBadge aria-label={t('translation:chatbot.unreadAria', { count: unreadCount })}>
            <Text variant="body-xs" weight="semibold" color="text.inverse" numeric>
              {unreadLabel}
            </Text>
          </S.UnreadBadge>
        ) : null}
      </S.LauncherButtonAnchor>
    </S.LauncherCard>
  );
};

TawkToWidgetComponent.displayName = 'TawkToWidgetComponent';
