import { BuyerMessageEventType } from '@repo/shared';
import { Button, ConfirmModal, Drawer, ModernSelect, ModernTextInput, Text, Textarea } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BuyerMessageTemplateDrawer.style';
import { PLACEHOLDER_TOKENS, TEMPLATE_EVENT_OPTIONS, type BuyerMessageTemplateDrawerComponentProps } from './BuyerMessageTemplateDrawer.types';

export const BuyerMessageTemplateDrawerComponent: React.FC<BuyerMessageTemplateDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  isEdit,
  isSaving,
  editor,
  preview,
  onNameChange,
  onBodyChange,
  onEventTypeChange,
  onInsertPlaceholder,
  onSave,
  canSave,
  titleLabel,
  subtitleLabel,
  showReset,
  resetLabel,
  isResetting,
  onResetRequest,
  isResetConfirmOpen,
  resetConfirmDescription,
  resetConfirmLabel,
  resetCancelLabel,
  onCloseResetConfirm,
  onConfirmReset,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={titleLabel}
      subtitle={subtitleLabel}
      size="md"
      primaryAction={{
        label: t('storeSettings:storeSettings.messaging.templates.save'),
        onClick: onSave,
        isLoading: isSaving,
        disabled: !canSave,
      }}
    >
      <S.FormCard>
        <ModernTextInput
          name="tplName"
          label={t('storeSettings:storeSettings.messaging.templates.name')}
          value={editor.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
          fullWidth
        />
        <ModernSelect
          label={t('storeSettings:storeSettings.messaging.templates.event')}
          options={TEMPLATE_EVENT_OPTIONS.map((ev) => ({
            value: ev,
            label: t(`storeSettings:storeSettings.messaging.events.${ev}`),
          }))}
          value={editor.eventType}
          onChange={(v) => onEventTypeChange(v as BuyerMessageEventType)}
          isDisabled={isEdit}
          fullWidth
          searchPlaceholder={t('translation:common.search')}
          noResultsMessage={t('translation:common.noResults')}
        />
        {showReset && (
          <S.ResetRow>
            <Button variant="tertiary" size="small" onClick={onResetRequest} isLoading={isResetting}>
              <Text>{resetLabel}</Text>
            </Button>
          </S.ResetRow>
        )}
        <Textarea
          label={t('storeSettings:storeSettings.messaging.templates.body')}
          value={editor.body}
          onChange={(e) => onBodyChange(e.target.value)}
          autoResize
          fullWidth
        />
        <S.ChipRow>
          {PLACEHOLDER_TOKENS.map((token) => (
            <Button key={token} variant="tertiary" size="small" onClick={() => onInsertPlaceholder(token)}>
              <Text variant="caption">{token}</Text>
            </Button>
          ))}
        </S.ChipRow>
        <Textarea
          label={t('storeSettings:storeSettings.messaging.templates.preview')}
          value={preview}
          readOnly
          autoResize
          fullWidth
        />
      </S.FormCard>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={onCloseResetConfirm}
        onConfirm={onConfirmReset}
        type="warning"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={resetConfirmDescription}
        confirmLabel={resetConfirmLabel}
        cancelLabel={resetCancelLabel}
        isLoading={isResetting}
      />
    </Drawer>
  );
};

BuyerMessageTemplateDrawerComponent.displayName = 'BuyerMessageTemplateDrawerComponent';
