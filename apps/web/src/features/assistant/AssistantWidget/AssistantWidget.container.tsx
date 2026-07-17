/**
 * AssistantWidget container — local UI state only (no AI backend yet).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AssistantWidgetComponent } from './AssistantWidget.component';
import type { AssistantMessage, AssistantWidgetProps } from './AssistantWidget.types';

let msgSeq = 0;
const nextId = (): string => {
  msgSeq += 1;
  return `msg-${msgSeq}`;
};

export const AssistantWidget = ({ sidebarCollapsed }: AssistantWidgetProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const welcomeText = t('translation:chatbot.welcomeMessage');

  const initialMessages = useMemo<AssistantMessage[]>(
    () => [{ id: 'welcome', role: 'assistant', text: welcomeText }],
    [welcomeText],
  );

  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    setMessages([{ id: nextId(), role: 'assistant', text: welcomeText }]);
    setInputValue('');
    setIsMinimized(false);
  }, [welcomeText]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) {
      return;
    }
    const userMsg: AssistantMessage = { id: nextId(), role: 'user', text };
    const botMsg: AssistantMessage = {
      id: nextId(),
      role: 'assistant',
      text: t('translation:chatbot.placeholderReply'),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputValue('');
  }, [inputValue, t]);

  return (
    <AssistantWidgetComponent
      sidebarCollapsed={sidebarCollapsed}
      isOpen={isOpen}
      isMinimized={isMinimized}
      inputValue={inputValue}
      messages={messages}
      onOpen={handleOpen}
      onClose={handleClose}
      onToggleMinimize={handleToggleMinimize}
      onRefresh={handleRefresh}
      onInputChange={setInputValue}
      onSend={handleSend}
    />
  );
};

AssistantWidget.displayName = 'AssistantWidget';
