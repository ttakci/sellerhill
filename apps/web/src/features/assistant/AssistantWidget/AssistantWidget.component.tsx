import { AssistantConnectionStatus, AssistantMessageAuthorType } from '@repo/shared';
import { Button, EmptyState, Icon, IconButton, MessageComposer, SafeMarkdown, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AssistantWidget.style';
import type { AssistantWidgetComponentProps } from './AssistantWidget.types';

export const AssistantWidgetComponent = ({
  activeConversationId,
  connectionStatus,
  conversations,
  draft,
  isLoading,
  isMinimized,
  isOpen,
  isSending,
  messages,
  onBack,
  onClose,
  onConversationSelect,
  onDraftChange,
  onNewConversation,
  onOpen,
  onSend,
  onStop,
  onToggleMinimize,
  sidebarCollapsed,
  streamingContent,
}: AssistantWidgetComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);

  return (
    <>
      {sidebarCollapsed ? (
        <IconButton onClick={onOpen} aria-label={t('translation:chatbot.openAria')} variant="ghost">
          <Icon name="sparkles" size={20} />
        </IconButton>
      ) : (
        <S.PromoCard>
          <Text variant="body" weight="semibold" color="sidebar.text">{t('translation:chatbot.sidebarTitle')}</Text>
          <Text variant="body-sm" color="sidebar.textMuted">{t('translation:chatbot.sidebarSubtitle')}</Text>
          <Button variant="primary" size="small" fullWidth onClick={onOpen}>
            <Icon name="sparkles" size={16} />
            <Text variant="body-sm" weight="semibold" color="text.inverse">{t('translation:chatbot.ctaLabel')}</Text>
          </Button>
        </S.PromoCard>
      )}

      {isOpen ? (
        <S.PanelRoot $minimized={isMinimized} role="dialog" aria-label={t('translation:chatbot.panelTitle')}>
          <S.PanelHeader>
            <S.PanelHeaderLeft>
              {activeConversationId ? (
                <IconButton onClick={onBack} aria-label={t('translation:chatbot.conversations')} variant="ghost">
                  <Icon name="arrow-left" size={16} />
                </IconButton>
              ) : (
                <S.PanelAvatar><Icon name="sparkles" size={16} /></S.PanelAvatar>
              )}
              <S.HeaderText>
                <Text variant="body" weight="semibold" color="text.inverse">{t('translation:chatbot.panelTitle')}</Text>
                <Text variant="caption" color="text.inverse">
                  {connectionStatus === AssistantConnectionStatus.CONNECTED ? t('translation:chatbot.connected') : t('translation:chatbot.disconnected')}
                </Text>
              </S.HeaderText>
            </S.PanelHeaderLeft>
            <S.PanelHeaderActions>
              <IconButton onClick={onNewConversation} aria-label={t('translation:chatbot.newConversation')} variant="ghost"><Icon name="plus" size={16} /></IconButton>
              <IconButton onClick={onToggleMinimize} aria-label={isMinimized ? t('translation:chatbot.expand') : t('translation:chatbot.minimize')} variant="ghost"><Icon name="minus" size={16} /></IconButton>
              <IconButton onClick={onClose} aria-label={t('translation:chatbot.close')} variant="ghost"><Icon name="x" size={16} /></IconButton>
            </S.PanelHeaderActions>
          </S.PanelHeader>

          {!isMinimized ? activeConversationId ? (
            <>
              <S.PanelBody>
                {messages.map((message) => {
                  const fromUser = message.authorType === AssistantMessageAuthorType.CUSTOMER;
                  return (
                    <S.MessageRow key={message.id} $fromUser={fromUser}>
                      <S.MessageBubble $fromUser={fromUser}>
                        {fromUser ? <Text variant="body-sm" color="text.inverse">{message.content}</Text> : <SafeMarkdown source={message.content} />}
                      </S.MessageBubble>
                    </S.MessageRow>
                  );
                })}
                {streamingContent ? (
                  <S.MessageRow $fromUser={false}><S.MessageBubble $fromUser={false}><SafeMarkdown source={streamingContent} /></S.MessageBubble></S.MessageRow>
                ) : null}
              </S.PanelBody>
              <S.PanelFooter>
                <MessageComposer
                  value={draft}
                  onChange={onDraftChange}
                  onSend={onSend}
                  placeholder={t('translation:chatbot.placeholder')}
                  sendLabel={t('translation:chatbot.send')}
                  aria-label={t('translation:chatbot.placeholder')}
                  disabled={isLoading}
                  sending={isSending}
                  cancelAction={isSending ? { label: t('translation:chatbot.cancel'), onCancel: onStop } : undefined}
                  maxLength={8000}
                  fullWidth
                />
              </S.PanelFooter>
            </>
          ) : (
            <S.PanelBody>
              {isLoading ? <Text variant="body-sm" color="text.secondary">{t('translation:chatbot.loading')}</Text> : null}
              {!isLoading && conversations.length === 0 ? (
                <EmptyState icon="sparkles" title={t('translation:chatbot.emptyTitle')} description={t('translation:chatbot.emptyDescription')} action={t('translation:chatbot.newConversation')} onAction={onNewConversation} />
              ) : null}
              {conversations.map((conversation) => (
                <S.ConversationButton key={conversation.id} onClick={() => onConversationSelect(conversation.id)}>
                  <S.ConversationText>
                    <Text variant="body" weight="semibold">{conversation.title}</Text>
                    <Text variant="body-sm" color="text.secondary">{conversation.unreadCount}</Text>
                  </S.ConversationText>
                  <Icon name="arrow-right" size={16} color="text.tertiary" />
                </S.ConversationButton>
              ))}
            </S.PanelBody>
          ) : null}
        </S.PanelRoot>
      ) : null}
    </>
  );
};

AssistantWidgetComponent.displayName = 'AssistantWidgetComponent';
