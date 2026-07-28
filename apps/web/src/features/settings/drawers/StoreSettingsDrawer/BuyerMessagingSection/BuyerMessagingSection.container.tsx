import { BuyerMessageEventType, BuyerMessageTemplateKind, SYSTEM_BUYER_MESSAGE_TEMPLATES, type BuyerMessagingConfig } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';


import { GLOBAL_SCOPE } from '../../storeScope';
import { BuyerMessageTemplateManager } from '../BuyerMessageTemplateManager/BuyerMessageTemplateManager.container';

import { BuyerMessagingSectionComponent } from './BuyerMessagingSection.component';
import { type BuyerMessagingSectionContainerProps } from './BuyerMessagingSection.types';

import {
  useGetBuyerMessagingConfigQuery,
  useUpdateBuyerMessagingConfigMutation,
} from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const defaultConfig: BuyerMessagingConfig = {
  enabled: false,
  events: {
    [BuyerMessageEventType.ORDER_RECEIVED]: {
      enabled: false,
      template: { kind: BuyerMessageTemplateKind.SYSTEM, id: SYSTEM_BUYER_MESSAGE_TEMPLATES[BuyerMessageEventType.ORDER_RECEIVED].id },
    },
    [BuyerMessageEventType.SHIPPED]: {
      enabled: false,
      template: { kind: BuyerMessageTemplateKind.SYSTEM, id: SYSTEM_BUYER_MESSAGE_TEMPLATES[BuyerMessageEventType.SHIPPED].id },
    },
    [BuyerMessageEventType.DELIVERED]: {
      enabled: false,
      template: { kind: BuyerMessageTemplateKind.SYSTEM, id: SYSTEM_BUYER_MESSAGE_TEMPLATES[BuyerMessageEventType.DELIVERED].id },
    },
    [BuyerMessageEventType.FEEDBACK_REQUEST]: {
      enabled: false,
      template: { kind: BuyerMessageTemplateKind.SYSTEM, id: SYSTEM_BUYER_MESSAGE_TEMPLATES[BuyerMessageEventType.FEEDBACK_REQUEST].id },
      delayDays: 3,
    },
  },
};

export const BuyerMessagingSection: React.FC<BuyerMessagingSectionContainerProps> = ({ selectedScope }) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  const storeId = selectedScope === GLOBAL_SCOPE ? undefined : selectedScope;

  const { data: remoteConfig } = useGetBuyerMessagingConfigQuery({ storeId });
  const [updateConfig, { isLoading }] = useUpdateBuyerMessagingConfigMutation();
  useLoading(isLoading);

  const [draft, setDraft] = useState<BuyerMessagingConfig>(remoteConfig ?? defaultConfig);
  const [managerOpen, setManagerOpen] = useState(false);

  // Re-sync draft when the fetched config changes (scope switch / refetch).
  // Render-time state adjustment (React-recommended) — avoids cascading renders
  // from setState-in-effect.
  const [prevRemote, setPrevRemote] = useState(remoteConfig);
  if (remoteConfig !== prevRemote) {
    setPrevRemote(remoteConfig);
    if (remoteConfig) {
      setDraft(remoteConfig);
    }
  }

  const persist = (next: BuyerMessagingConfig): void => {
    void updateConfig({ config: next, storeId })
      .unwrap()
      .then(() => {
        showMessage(
          { type: 'success', headerKey: 'translation:message.success.header', descriptionKey: 'translation:message.success.saved' },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          { type: 'error', headerKey: 'translation:message.error.header', descriptionKey: getErrorI18nKey(error), primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage } },
          t,
        );
      });
  };

  const onToggleMaster = (enabled: boolean): void => setDraft((d) => ({ ...d, enabled }));
  const onToggleEvent = (event: BuyerMessageEventType, enabled: boolean): void =>
    setDraft((d) => ({ ...d, events: { ...d.events, [event]: { ...d.events[event]!, enabled } } }));
  const onPickTemplate = (event: BuyerMessageEventType, kind: 'system' | 'custom', templateId: string): void =>
    setDraft((d) => ({
      ...d,
      events: {
        ...d.events,
        [event]: { ...d.events[event]!, template: { kind: kind === 'custom' ? BuyerMessageTemplateKind.CUSTOM : BuyerMessageTemplateKind.SYSTEM, id: templateId } },
      },
    }));
  const onChangeDelayDays = (event: BuyerMessageEventType, delayDays: number): void =>
    setDraft((d) => ({ ...d, events: { ...d.events, [event]: { ...d.events[event]!, delayDays } } }));

  return (
    <>
      <BuyerMessagingSectionComponent
        config={draft}
        templates={[]}
        saving={isLoading}
        onToggleMaster={onToggleMaster}
        onToggleEvent={onToggleEvent}
        onPickTemplate={onPickTemplate}
        onChangeDelayDays={onChangeDelayDays}
        onSave={() => persist(draft)}
        onManageTemplates={() => setManagerOpen(true)}
      />
      {managerOpen && <BuyerMessageTemplateManager isOpen={managerOpen} onClose={() => setManagerOpen(false)} />}
    </>
  );
};

BuyerMessagingSection.displayName = 'BuyerMessagingSection';
