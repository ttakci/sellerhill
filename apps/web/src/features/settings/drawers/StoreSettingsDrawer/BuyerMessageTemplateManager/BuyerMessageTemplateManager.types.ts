import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';

export const TEMPLATE_EVENT_OPTIONS: BuyerMessageEventType[] = [
  BuyerMessageEventType.ORDER_RECEIVED,
  BuyerMessageEventType.SHIPPED,
  BuyerMessageEventType.DELIVERED,
  BuyerMessageEventType.FEEDBACK_REQUEST,
];

export const PLACEHOLDER_TOKENS = [
  '{{buyer_username}}',
  '{{item_title}}',
  '{{order_id}}',
  '{{tracking_number}}',
  '{{carrier}}',
  '{{store_name}}',
  '{{estimated_delivery}}',
] as const;

export interface BuyerMessageTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface TemplateEditorState {
  id: string | null;
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
}

export interface BuyerMessageTemplateManagerComponentProps extends BuyerMessageTemplateManagerProps {
  templates: BuyerMessageTemplate[];
  editor: TemplateEditorState;
  preview: string;
  onNew: () => void;
  onSelect: (tpl: BuyerMessageTemplate) => void;
  onNameChange: (name: string) => void;
  onBodyChange: (body: string) => void;
  onEventTypeChange: (ev: BuyerMessageEventType) => void;
  onInsertPlaceholder: (token: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}
