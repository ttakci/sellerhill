import { Icon, Text } from '@repo/ui';
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
      <S.CollapsedLauncher
        onClick={onOpen}
        aria-label={t('translation:chatbot.openAria')}
        title={t('translation:chatbot.openAria')}
        variant="ghost"
      >
        <Icon name="headset" size={20} />
        {unreadCount > 0 ? (
          <S.UnreadBadge aria-label={t('translation:chatbot.unreadAria', { count: unreadCount })}>
            <Text variant="body-xs" weight="semibold" color="text.inverse" numeric>
              {unreadLabel}
            </Text>
          </S.UnreadBadge>
        ) : null}
      </S.CollapsedLauncher>
    );
  }

  return (
    <S.LauncherCard>
      <Text variant="body" weight="semibold" color="sidebar.text">
        {t('translation:chatbot.sidebarTitle')}
      </Text>
      <Text variant="body-sm" color="sidebar.textMuted">
        {t('translation:chatbot.sidebarSubtitle')}
      </Text>
      <S.LauncherButton variant="primary" size="small" fullWidth onClick={onOpen}>
        <Icon name="headset" size={16} />
        <Text variant="body-sm" weight="semibold" color="text.inverse">
          {t('translation:chatbot.ctaLabel')}
        </Text>
        {unreadCount > 0 ? (
          <S.UnreadBadge aria-label={t('translation:chatbot.unreadAria', { count: unreadCount })}>
            <Text variant="body-xs" weight="semibold" color="text.inverse" numeric>
              {unreadLabel}
            </Text>
          </S.UnreadBadge>
        ) : null}
      </S.LauncherButton>
    </S.LauncherCard>
  );
};

TawkToWidgetComponent.displayName = 'TawkToWidgetComponent';
