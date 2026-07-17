/**
 * AssistantWidget — sidebar promo + floating chat panel (presentation).
 */

import { Icon, SearchField, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AssistantWidget.style';
import type { AssistantWidgetComponentProps } from './AssistantWidget.types';

export const AssistantWidgetComponent = ({
  sidebarCollapsed,
  isOpen,
  isMinimized,
  inputValue,
  messages,
  onOpen,
  onClose,
  onToggleMinimize,
  onRefresh,
  onInputChange,
  onSend,
}: AssistantWidgetComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);

  return (
    <>
      {sidebarCollapsed ? (
        <S.CollapsedOpenButton
          type="button"
          onClick={onOpen}
          title={t('translation:chatbot.ctaLabel')}
          aria-label={t('translation:chatbot.openAria')}
        >
          <Icon name="sparkles" size={20} />
        </S.CollapsedOpenButton>
      ) : (
        <S.PromoCard>
          <Text variant="body" weight="semibold" color="sidebar.text">
            {t('translation:chatbot.sidebarTitle')}
          </Text>
          <Text variant="body-sm" color="sidebar.textMuted">
            {t('translation:chatbot.sidebarSubtitle')}
          </Text>
          <S.PromoCta type="button" onClick={onOpen}>
            <Icon name="sparkles" size={16} />
            <Text variant="body-sm" weight="semibold" color="text.inverse">
              {t('translation:chatbot.ctaLabel')}
            </Text>
            <Icon name="arrow-right" size={16} />
          </S.PromoCta>
        </S.PromoCard>
      )}

      {isOpen && (
        <S.PanelRoot $minimized={isMinimized} role="dialog" aria-label={t('translation:chatbot.panelTitle')}>
          <S.PanelHeader>
            <S.PanelHeaderLeft>
              <S.PanelAvatar>
                <Icon name="sparkles" size={16} />
              </S.PanelAvatar>
              <Text variant="body" weight="semibold" color="text.inverse">
                {t('translation:chatbot.panelTitle')}
              </Text>
            </S.PanelHeaderLeft>
            <S.PanelHeaderActions>
              <S.HeaderIconButton
                type="button"
                onClick={onRefresh}
                title={t('translation:chatbot.refresh')}
                aria-label={t('translation:chatbot.refresh')}
              >
                <Icon name="refresh" size={16} />
              </S.HeaderIconButton>
              <S.HeaderIconButton
                type="button"
                onClick={onToggleMinimize}
                title={
                  isMinimized
                    ? t('translation:chatbot.expand')
                    : t('translation:chatbot.minimize')
                }
                aria-label={
                  isMinimized
                    ? t('translation:chatbot.expand')
                    : t('translation:chatbot.minimize')
                }
              >
                <Icon name="minus" size={16} />
              </S.HeaderIconButton>
              <S.HeaderIconButton
                type="button"
                onClick={onClose}
                title={t('translation:chatbot.close')}
                aria-label={t('translation:chatbot.close')}
              >
                <Icon name="x" size={16} />
              </S.HeaderIconButton>
            </S.PanelHeaderActions>
          </S.PanelHeader>

          {!isMinimized && (
            <>
              <S.PanelBody>
                {messages.map((msg) => (
                  <S.MessageRow key={msg.id} $fromUser={msg.role === 'user'}>
                    <S.MessageBubble $fromUser={msg.role === 'user'}>
                      <Text
                        variant="body-sm"
                        color={msg.role === 'user' ? 'text.inverse' : 'text.primary'}
                      >
                        {msg.text}
                      </Text>
                    </S.MessageBubble>
                  </S.MessageRow>
                ))}
              </S.PanelBody>
              <S.PanelFooter>
                <S.InputGrow>
                  <SearchField
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onSearch={onSend}
                    placeholder={t('translation:chatbot.placeholder')}
                    size="medium"
                    fullWidth
                    aria-label={t('translation:chatbot.placeholder')}
                  />
                </S.InputGrow>
                <S.SendButton
                  type="button"
                  onClick={onSend}
                  disabled={!inputValue.trim()}
                  aria-label={t('translation:chatbot.send')}
                >
                  <Icon name="send" size={18} />
                </S.SendButton>
              </S.PanelFooter>
            </>
          )}
        </S.PanelRoot>
      )}
    </>
  );
};

AssistantWidgetComponent.displayName = 'AssistantWidgetComponent';
