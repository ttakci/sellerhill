import {
  BuyerMessageEventType,
  type BuyerMessagingConfig,
  type BuyerMessageTemplate,
} from '@repo/shared';

export const BUYER_MESSAGE_EVENTS: BuyerMessageEventType[] = [
  BuyerMessageEventType.ORDER_RECEIVED,
  BuyerMessageEventType.SHIPPED,
  BuyerMessageEventType.DELIVERED,
  BuyerMessageEventType.FEEDBACK_REQUEST,
];

export interface BuyerMessagingSectionProps {
  config: BuyerMessagingConfig | null;
  templates: BuyerMessageTemplate[];
  saving: boolean;
  onToggleMaster: (enabled: boolean) => void;
  onToggleEvent: (event: BuyerMessageEventType, enabled: boolean) => void;
  onPickTemplate: (event: BuyerMessageEventType, kind: 'system' | 'custom', templateId: string) => void;
  onChangeDelayDays: (event: BuyerMessageEventType, delayDays: number) => void;
  onSave: () => void;
  onManageTemplates: () => void;
}

export interface BuyerMessagingSectionContainerProps {
  selectedScope: string;
}
