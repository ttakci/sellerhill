import { BuyerMessageEventType } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';


import { BuyerMessageTemplateManagerComponent } from './BuyerMessageTemplateManager.component';
import { type BuyerMessageTemplateManagerProps, type TemplateEditorState } from './BuyerMessageTemplateManager.types';

import {
  useCreateBuyerMessageTemplateMutation,
  useDeleteBuyerMessageTemplateMutation,
  useGetBuyerMessageTemplatesQuery,
  useUpdateBuyerMessageTemplateMutation,
} from '@/features/buyer-messaging/api/buyer-messaging.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

const SAMPLE_CONTEXT: Record<string, string> = {
  buyer_username: 'jdoe',
  item_title: 'Red Widget',
  order_id: '12-0-12345',
  tracking_number: '1Z999',
  carrier: 'UPS',
  store_name: 'AcmeShop',
  estimated_delivery: 'Tue',
};

const renderPreview = (body: string): string =>
  body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_full, name: string) => SAMPLE_CONTEXT[name] ?? '');

const emptyEditor: TemplateEditorState = {
  id: null,
  eventType: BuyerMessageEventType.ORDER_RECEIVED,
  name: '',
  body: '',
};

export const BuyerMessageTemplateManager: React.FC<BuyerMessageTemplateManagerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const { data: templates = [] } = useGetBuyerMessageTemplatesQuery();
  const [createTpl, { isLoading: c }] = useCreateBuyerMessageTemplateMutation();
  const [updateTpl, { isLoading: u }] = useUpdateBuyerMessageTemplateMutation();
  const [deleteTpl, { isLoading: d }] = useDeleteBuyerMessageTemplateMutation();
  useLoading(c || u || d);

  const [editor, setEditor] = useState<TemplateEditorState>(emptyEditor);
  const preview = useMemo(() => renderPreview(editor.body), [editor.body]);

  const reportError = (error: Parameters<typeof getErrorI18nKey>[0]): void => {
    showMessage(
      { type: 'error', headerKey: 'translation:message.error.header', descriptionKey: getErrorI18nKey(error), primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage } },
      t,
    );
  };

  const onSave = (): void => {
    if (editor.name.trim().length === 0 || editor.body.trim().length === 0) {
      return;
    }
    const handle = (res: unknown): void => {
      void res;
      setEditor(emptyEditor);
    };
    if (editor.id) {
      void updateTpl({ id: editor.id, body: { name: editor.name, body: editor.body } })
        .unwrap().then(handle).catch(reportError);
    } else {
      void createTpl({ eventType: editor.eventType, name: editor.name, body: editor.body })
        .unwrap().then(handle).catch(reportError);
    }
  };

  return (
    <BuyerMessageTemplateManagerComponent
      isOpen={isOpen}
      onClose={onClose}
      templates={templates}
      editor={editor}
      preview={preview}
      onNew={() => setEditor(emptyEditor)}
      onSelect={(tpl) => setEditor({ id: tpl.id, eventType: tpl.eventType, name: tpl.name, body: tpl.body })}
      onNameChange={(name) => setEditor((e) => ({ ...e, name }))}
      onBodyChange={(body) => setEditor((e) => ({ ...e, body }))}
      onEventTypeChange={(eventType) => setEditor((e) => ({ ...e, eventType }))}
      onInsertPlaceholder={(token) => setEditor((e) => ({ ...e, body: `${e.body}${token}` }))}
      onSave={onSave}
      onDelete={(id) => { void deleteTpl(id).unwrap().catch(reportError); }}
    />
  );
};

BuyerMessageTemplateManager.displayName = 'BuyerMessageTemplateManager';
