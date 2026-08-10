import { BuyerMessageEventType } from '@repo/shared';

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

export interface BuyerMessageTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Returns to the templates carousel hub — both create and edit are opened from inside it. */
  onBack?: () => void;
  /** null/undefined = create mode; string = edit existing template */
  editingTemplateId?: string | null;
}

export interface TemplateEditorState {
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
}

export interface BuyerMessageTemplateDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  isEdit: boolean;
  isSaving: boolean;
  editor: TemplateEditorState;
  preview: string;
  onNameChange: (name: string) => void;
  onBodyChange: (body: string) => void;
  onEventTypeChange: (eventType: BuyerMessageEventType) => void;
  onInsertPlaceholder: (token: string) => void;
  onSave: () => void;
  canSave: boolean;
  titleLabel: string;
  subtitleLabel: string;
  /** True when editing one of the user's seeded per-event defaults — shows the "Reset to default" action. */
  showReset: boolean;
  resetLabel: string;
  isResetting: boolean;
  onResetRequest: () => void;
  isResetConfirmOpen: boolean;
  resetConfirmDescription: string;
  resetConfirmLabel: string;
  resetCancelLabel: string;
  onCloseResetConfirm: () => void;
  onConfirmReset: () => void;
}
