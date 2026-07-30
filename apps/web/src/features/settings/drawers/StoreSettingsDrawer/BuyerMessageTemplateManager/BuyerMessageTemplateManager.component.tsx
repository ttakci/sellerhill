import { BuyerMessageEventType } from '@repo/shared';
import { Button, Drawer, IconButton, Icon, ModernSelect, ModernTextInput, Text, Textarea } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';


import * as S from './BuyerMessageTemplateManager.style';
import { PLACEHOLDER_TOKENS, TEMPLATE_EVENT_OPTIONS, type BuyerMessageTemplateManagerComponentProps } from './BuyerMessageTemplateManager.types';

export const BuyerMessageTemplateManagerComponent: React.FC<BuyerMessageTemplateManagerComponentProps> = ({
  isOpen,
  onClose,
  templates,
  editor,
  preview,
  onNew,
  onSelect,
  onNameChange,
  onBodyChange,
  onEventTypeChange,
  onInsertPlaceholder,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  /*
   * A real nested Drawer. This used to render its content inline inside the
   * parent drawer's card, so opening "Manage templates" grew the same white
   * panel in place — the messaging toggles stayed visible above a second,
   * unrelated form, and the only way out was a tertiary "Close" button at the
   * very bottom. `onBack` is the affordance the Drawer already has for exactly
   * this nested flow (ListingGroupDrawer/AddListingsDrawer use it).
   */
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onClose}
      size="lg"
      title={t('storeSettings:storeSettings.messaging.templates.title')}
      subtitle={t('storeSettings:storeSettings.messaging.templates.subtitle')}
    >
      <S.BodyStack>
      <S.ListColumn>
        <Text variant="body-sm" weight="semibold">{t('storeSettings:storeSettings.messaging.templates.name')}</Text>
        {templates.length === 0 && (
          <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.messaging.templates.empty')}</Text>
        )}
        {templates.map((tpl) => (
          <S.TemplateItem
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            role="button"
            tabIndex={0}
          >
            <Text variant="body-sm">{tpl.name}</Text>
            <IconButton
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onDelete(tpl.id); }}
              aria-label={t('storeSettings:storeSettings.messaging.templates.delete')}
            >
              <Icon name="trash" size={16} />
            </IconButton>
          </S.TemplateItem>
        ))}
        <Button variant="tertiary" size="small" onClick={onNew}>
          <Text>{t('storeSettings:storeSettings.messaging.templates.new')}</Text>
        </Button>
      </S.ListColumn>

      <S.EditorColumn>
        <ModernTextInput
          name="tplName"
          label={t('storeSettings:storeSettings.messaging.templates.name')}
          value={editor.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
          size="small"
        />
        <ModernSelect
          label={t('storeSettings:storeSettings.messaging.templates.event')}
          options={TEMPLATE_EVENT_OPTIONS.map((ev) => ({ value: ev, label: t(`storeSettings:storeSettings.messaging.events.${ev}`) }))}
          value={editor.eventType}
          onChange={(v) => onEventTypeChange(v as BuyerMessageEventType)}
          size="small"
          fullWidth
          searchPlaceholder={t('translation:common.search')}
          noResultsMessage={t('translation:common.noResults')}
        />
        <Text variant="body-sm" weight="semibold">{t('storeSettings:storeSettings.messaging.templates.body')}</Text>
        <Textarea
          value={editor.body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={4}
        />
        <S.ChipRow>
          {PLACEHOLDER_TOKENS.map((token) => (
            <Button key={token} variant="tertiary" size="small" onClick={() => onInsertPlaceholder(token)}>
              <Text>{token}</Text>
            </Button>
          ))}
        </S.ChipRow>
        <Text variant="caption" weight="semibold">{t('storeSettings:storeSettings.messaging.templates.preview')}</Text>
        <S.PreviewBox>
          <Text variant="caption">{preview}</Text>
        </S.PreviewBox>
        <Button
          variant="primary"
          size="small"
          onClick={onSave}
          disabled={editor.name.trim().length === 0 || editor.body.trim().length === 0}
        >
          <Text>{t('storeSettings:storeSettings.messaging.templates.save')}</Text>
        </Button>
      </S.EditorColumn>
      </S.BodyStack>
    </Drawer>
  );
};

BuyerMessageTemplateManagerComponent.displayName = 'BuyerMessageTemplateManagerComponent';
