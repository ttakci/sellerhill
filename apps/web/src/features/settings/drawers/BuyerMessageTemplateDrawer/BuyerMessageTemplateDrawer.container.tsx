import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessageTemplateDrawerComponent } from './BuyerMessageTemplateDrawer.component';
import type { BuyerMessageTemplateDrawerProps, TemplateEditorState } from './BuyerMessageTemplateDrawer.types';

import {
  useCreateBuyerMessageTemplateMutation,
  useGetBuyerMessageTemplatesQuery,
  useResetBuyerMessageTemplateMutation,
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
  eventType: BuyerMessageEventType.ORDER_RECEIVED,
  name: '',
  body: '',
};

const toEditor = (tpl: BuyerMessageTemplate): TemplateEditorState => ({
  eventType: tpl.eventType,
  name: tpl.name,
  body: tpl.body,
});

/**
 * Create/edit drawer for a single custom buyer message template. Reuses the
 * hub's cached template list (same RTK Query cache key as the list drawer, so
 * no extra network request) to resolve the template being edited — there is
 * no dedicated get-by-id endpoint for a single template.
 */
export const BuyerMessageTemplateDrawer: React.FC<BuyerMessageTemplateDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  editingTemplateId,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const isEdit = !!editingTemplateId;

  const { data: templates = [] } = useGetBuyerMessageTemplatesQuery(undefined, { skip: !isOpen });
  const editingTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === editingTemplateId) ?? null,
    [templates, editingTemplateId],
  );

  const [createTpl, { isLoading: isCreating }] = useCreateBuyerMessageTemplateMutation();
  const [updateTpl, { isLoading: isUpdating }] = useUpdateBuyerMessageTemplateMutation();
  const [resetTpl, { isLoading: isResetting }] = useResetBuyerMessageTemplateMutation();
  const isSaving = isCreating || isUpdating;
  useLoading(isSaving);

  const [editor, setEditor] = useState<TemplateEditorState>(emptyEditor);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Reset the draft whenever the drawer opens for a (possibly different)
  // template — without an effect (avoids cascading setState-in-effect).
  // Render-time guard per the React "adjusting state when a prop changes" pattern.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevEditingTemplateId, setPrevEditingTemplateId] = useState(editingTemplateId);
  if (isOpen !== prevOpen || editingTemplateId !== prevEditingTemplateId) {
    setPrevOpen(isOpen);
    setPrevEditingTemplateId(editingTemplateId);
    if (isOpen) {
      setEditor(editingTemplate ? toEditor(editingTemplate) : emptyEditor);
      setIsResetConfirmOpen(false);
    }
  }

  const preview = useMemo(() => renderPreview(editor.body), [editor.body]);
  const canSave = editor.name.trim().length > 0 && editor.body.trim().length > 0;

  const reportError = (error: Parameters<typeof getErrorI18nKey>[0]): void => {
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t,
    );
  };

  const handleSave = (): void => {
    if (!canSave) {
      return;
    }
    const onSuccess = (): void => {
      onClose();
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'translation:message.success.saved',
          primaryButton: {
            labelKey: 'translation:common.ok',
            onClick: closeMessage,
          },
        },
        t,
      );
    };
    if (isEdit && editingTemplateId) {
      void updateTpl({ id: editingTemplateId, body: { name: editor.name, body: editor.body } })
        .unwrap()
        .then(onSuccess)
        .catch(reportError);
    } else {
      void createTpl({ eventType: editor.eventType, name: editor.name, body: editor.body })
        .unwrap()
        .then(onSuccess)
        .catch(reportError);
    }
  };

  const handleConfirmReset = (): void => {
    if (!editingTemplateId) {
      return;
    }
    void resetTpl(editingTemplateId)
      .unwrap()
      .then((reset) => {
        setEditor((e) => ({ ...e, body: reset.body }));
        setIsResetConfirmOpen(false);
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        setIsResetConfirmOpen(false);
        reportError(error);
      });
  };

  return (
    <BuyerMessageTemplateDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      isEdit={isEdit}
      isSaving={isSaving}
      editor={editor}
      preview={preview}
      onNameChange={(name) => setEditor((e) => ({ ...e, name }))}
      onBodyChange={(body) => setEditor((e) => ({ ...e, body }))}
      onEventTypeChange={(eventType) => setEditor((e) => ({ ...e, eventType }))}
      onInsertPlaceholder={(token) => setEditor((e) => ({ ...e, body: `${e.body}${token}` }))}
      onSave={handleSave}
      canSave={canSave}
      titleLabel={t(
        isEdit
          ? 'storeSettings:storeSettings.messaging.templates.edit.title'
          : 'storeSettings:storeSettings.messaging.templates.create.title',
      )}
      subtitleLabel={t(
        isEdit
          ? 'storeSettings:storeSettings.messaging.templates.edit.subtitle'
          : 'storeSettings:storeSettings.messaging.templates.create.subtitle',
      )}
      showReset={Boolean(isEdit && editingTemplate?.isDefault)}
      resetLabel={t('storeSettings:storeSettings.messaging.templates.reset')}
      isResetting={isResetting}
      onResetRequest={() => setIsResetConfirmOpen(true)}
      isResetConfirmOpen={isResetConfirmOpen}
      resetConfirmDescription={t('storeSettings:storeSettings.messaging.templates.resetConfirm')}
      resetConfirmLabel={t('storeSettings:storeSettings.messaging.templates.reset')}
      resetCancelLabel={t('translation:common.cancel')}
      onCloseResetConfirm={() => setIsResetConfirmOpen(false)}
      onConfirmReset={handleConfirmReset}
    />
  );
};

BuyerMessageTemplateDrawer.displayName = 'BuyerMessageTemplateDrawer';
