export type AssistantMessageRole = 'user' | 'assistant';

export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  text: string;
}

export interface AssistantWidgetProps {
  /** When sidebar is collapsed, show compact open control only */
  sidebarCollapsed: boolean;
}

export interface AssistantWidgetComponentProps {
  sidebarCollapsed: boolean;
  isOpen: boolean;
  isMinimized: boolean;
  inputValue: string;
  messages: AssistantMessage[];
  onOpen: () => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onRefresh: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
}
