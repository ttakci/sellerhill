/**
 * ConversationThread (Presentation)
 * Header (title, other party, listing chip, actions), message bubbles with
 * attachments, and the reply composer pinned to the bottom. FROM_EBAY
 * conversations show a caption instead of the composer — eBay does not
 * accept replies to them.
 */

import { EmptyState, Icon, IconButton, IdBadge, MessageComposer, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ConversationThread.style';
import type { ConversationThreadProps } from './ConversationThread.types';

import { SafeHtmlFrame } from '@/domain-ui';

export const ConversationThread = ({
  hasConversation,
  isLoading,
  title,
  otherParty,
  avatarLabel,
  referenceId,
  messages,
  actions,
  canReply,
  draft,
  onDraftChange,
  onSend,
  isSending,
  maxLength,
  scrollRef,
}: ConversationThreadProps): React.ReactElement => {
  const { t } = useTranslation(['messages', 'translation']);

  if (!hasConversation) {
    return (
      <S.StateSlot>
        <EmptyState size="sm" icon="mail-open" title={t('messages.thread.empty')} description="" />
      </S.StateSlot>
    );
  }

  return (
    <S.Wrapper>
      <S.Header>
        <S.HeaderAvatar aria-hidden>
          <Text variant="body-sm" weight="semibold" color="brand.primary">
            {avatarLabel}
          </Text>
        </S.HeaderAvatar>
        <S.HeaderText>
          <Text variant="h4" weight="semibold" truncate>
            {title}
          </Text>
          <S.HeaderMeta>
            {otherParty && (
              <Text variant="body-sm" color="text.secondary" truncate>
                {otherParty}
              </Text>
            )}
            {referenceId && <IdBadge id={referenceId} storeType="ebay" size="sm" />}
          </S.HeaderMeta>
        </S.HeaderText>
        {actions.length > 0 && (
          <S.HeaderActions>
            {actions.map((action) => (
              <IconButton
                key={action.id}
                type="button"
                variant="outlined"
                onClick={action.onClick}
                aria-label={action.label}
                title={action.label}
              >
                <Icon name={action.icon} size={16} />
              </IconButton>
            ))}
          </S.HeaderActions>
        )}
      </S.Header>

      <S.Messages ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <S.StateSlot>
            <EmptyState size="sm" icon="mail" title={t('messages.thread.loading')} description="" />
          </S.StateSlot>
        ) : (
          messages.map((message) => (
            <S.Bubble key={message.id} $mine={message.isMine} $wide={message.bodyIsHtml}>
              <S.BubbleMeta>
                <Text variant="caption" weight="semibold" color={message.isMine ? 'brand.primary' : 'text.primary'}>
                  {message.senderLabel}
                </Text>
                <Text variant="caption" color="text.tertiary" numeric>
                  {message.date}
                </Text>
              </S.BubbleMeta>
              {message.body && (
                <S.BubbleBody dir="auto">
                  {message.bodyIsHtml ? (
                    <SafeHtmlFrame html={message.body} title={t('messages.thread.systemMessage')} />
                  ) : (
                    <Text variant="body">{message.body}</Text>
                  )}
                </S.BubbleBody>
              )}
              {message.media.length > 0 && (
                <S.MediaList>
                  {message.media.map((media) => (
                    <S.MediaLink key={media.key} href={media.url} target="_blank" rel="noreferrer">
                      {media.isImage ? (
                        <S.MediaImage src={media.url} alt={media.name} loading="lazy" />
                      ) : (
                        <>
                          <Icon name="paperclip" size={14} />
                          <Text variant="body-sm" color="inherit" truncate>
                            {media.name || t('messages.thread.attachment')}
                          </Text>
                        </>
                      )}
                    </S.MediaLink>
                  ))}
                </S.MediaList>
              )}
            </S.Bubble>
          ))
        )}
      </S.Messages>

      <S.Composer>
        {canReply ? (
          <MessageComposer
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            placeholder={t('messages.thread.replyPlaceholder')}
            aria-label={t('messages.thread.reply')}
            maxLength={maxLength}
            submitMode="explicit"
            sendAction={{ label: t('messages.thread.send'), isLoading: isSending }}
            sending={isSending}
            fullWidth
          />
        ) : (
          <Text variant="body-sm" color="text.secondary">
            {t('messages.thread.noReply')}
          </Text>
        )}
      </S.Composer>
    </S.Wrapper>
  );
};

ConversationThread.displayName = 'ConversationThread';
