import type { AssistantConnectionStatus, AssistantConversationSummaryDto, AssistantMessageDto } from '@repo/shared';

export interface AssistantWidgetProps {
  sidebarCollapsed: boolean;
}

export interface AssistantWidgetComponentProps {
  activeConversationId: string | null;
  connectionStatus: AssistantConnectionStatus;
  conversations: AssistantConversationSummaryDto[];
  draft: string;
  isLoading: boolean;
  isMinimized: boolean;
  isOpen: boolean;
  isSending: boolean;
  messages: AssistantMessageDto[];
  onBack: () => void;
  onClose: () => void;
  onConversationSelect: (id: string) => void;
  onDraftChange: (value: string) => void;
  onNewConversation: () => void;
  onOpen: () => void;
  onSend: () => void;
  onStop: () => void;
  onToggleMinimize: () => void;
  sidebarCollapsed: boolean;
  streamingContent: string;
}
