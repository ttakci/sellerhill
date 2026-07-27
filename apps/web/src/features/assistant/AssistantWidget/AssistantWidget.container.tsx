import { AssistantConversationMode, AssistantStreamEventType, DEFAULT_LOCALE, type AssistantMessageDto } from '@repo/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';


import { useCreateAssistantConversationMutation, useGetAssistantConversationQuery, useGetAssistantMessagesQuery, useListAssistantConversationsQuery, usePostAssistantSupportMessageMutation } from '../api/assistant.api';
import { streamAssistantMessage } from '../api/assistantStreamClient';
import { useAssistantInbox } from '../hooks/useAssistantInbox';

import { AssistantWidgetComponent } from './AssistantWidget.component';
import type { AssistantWidgetProps } from './AssistantWidget.types';

import type { RootState } from '@/app/store';

export const AssistantWidget = ({ sidebarCollapsed }: AssistantWidgetProps): React.ReactElement => {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const connectionStatus = useAssistantInbox(accessToken);
  const conversationsQuery = useListAssistantConversationsQuery({ limit: 50 }, { skip: !isOpen });
  const conversationQuery = useGetAssistantConversationQuery(activeConversationId ?? '', { skip: !activeConversationId });
  const messagesQuery = useGetAssistantMessagesQuery(
    { conversationId: activeConversationId ?? '', limit: 100 },
    { skip: !activeConversationId }
  );
  const [createConversation] = useCreateAssistantConversationMutation();
  const [postSupportMessage] = usePostAssistantSupportMessageMutation();
  const [optimisticMessages, setOptimisticMessages] = useState<AssistantMessageDto[]>([]);

  useEffect(() => {
    setOptimisticMessages([]);
    setStreamingContent('');
  }, [activeConversationId]);

  const handleNewConversation = useCallback(async () => {
    const conversation = await createConversation({ clientConversationId: crypto.randomUUID(), locale: DEFAULT_LOCALE }).unwrap();
    setActiveConversationId(conversation.id);
    setIsOpen(true);
    setIsMinimized(false);
  }, [createConversation]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !activeConversationId || isSending) {return;}
    const clientMessageId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    setDraft('');
    setIsSending(true);
    setStreamingContent('');
    try {
      const mode = conversationQuery.data?.mode;
      if (mode === AssistantConversationMode.HUMAN || mode === AssistantConversationMode.WAITING_FOR_SUPPORT) {
        const message = await postSupportMessage({ conversationId: activeConversationId, request: { clientMessageId, content } }).unwrap();
        setOptimisticMessages((current) => [...current, message]);
        return;
      }
      await streamAssistantMessage({
        accessToken,
        conversationId: activeConversationId,
        request: { clientMessageId, content },
        signal: controller.signal,
        onEvent: (event) => {
          if (event.eventType === AssistantStreamEventType.USER_MESSAGE_ACCEPTED) {
            setOptimisticMessages((current) => [...current, event.message]);
          } else if (event.eventType === AssistantStreamEventType.ASSISTANT_MESSAGE_SNAPSHOT) {
            setStreamingContent(event.content);
          } else if (event.eventType === AssistantStreamEventType.ASSISTANT_MESSAGE_COMPLETED || event.eventType === AssistantStreamEventType.ASSISTANT_MESSAGE_INCOMPLETE) {
            setOptimisticMessages((current) => [...current, event.message]);
            setStreamingContent('');
          }
        },
      });
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }, [accessToken, activeConversationId, conversationQuery.data?.mode, draft, isSending, postSupportMessage]);

  const handleStop = useCallback(() => abortRef.current?.abort(), []);
  const messages = [...(messagesQuery.data?.items ?? []), ...optimisticMessages]
    .filter((message, index, all) => all.findIndex((candidate) => candidate.id === message.id) === index)
    .sort((left, right) => Number(BigInt(left.sequence) - BigInt(right.sequence)));

  return (
    <AssistantWidgetComponent
      sidebarCollapsed={sidebarCollapsed}
      isOpen={isOpen}
      isMinimized={isMinimized}
      isLoading={conversationsQuery.isLoading || messagesQuery.isLoading}
      isSending={isSending}
      activeConversationId={activeConversationId}
      connectionStatus={connectionStatus}
      conversations={conversationsQuery.data?.items ?? []}
      messages={messages}
      streamingContent={streamingContent}
      draft={draft}
      onOpen={() => { setIsOpen(true); setIsMinimized(false); }}
      onClose={() => { abortRef.current?.abort(); setIsOpen(false); }}
      onToggleMinimize={() => setIsMinimized((current) => !current)}
      onBack={() => setActiveConversationId(null)}
      onConversationSelect={setActiveConversationId}
      onNewConversation={() => { void handleNewConversation(); }}
      onDraftChange={setDraft}
      onSend={() => { void handleSend(); }}
      onStop={handleStop}
    />
  );
};

AssistantWidget.displayName = 'AssistantWidget';
