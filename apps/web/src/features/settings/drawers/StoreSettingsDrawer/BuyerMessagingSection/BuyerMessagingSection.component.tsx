import { BuyerMessageEventType, BuyerMessageTemplateKind, SYSTEM_BUYER_MESSAGE_TEMPLATES } from '@repo/shared';
import { Button, ModernSelect, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';


import * as S from './BuyerMessagingSection.style';
import { BUYER_MESSAGE_EVENTS, type BuyerMessagingSectionProps } from './BuyerMessagingSection.types';

export const BuyerMessagingSectionComponent: React.FC<BuyerMessagingSectionProps> = ({
  config,
  templates,
  saving,
  onToggleMaster,
  onToggleEvent,
  onPickTemplate,
  onChangeDelayDays,
  onSave,
  onManageTemplates,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const enabled = config?.enabled ?? false;

  const eventEnabled = (ev: BuyerMessageEventType): boolean => config?.events?.[ev]?.enabled ?? false;
  const eventDelay = (ev: BuyerMessageEventType): number => config?.events?.[ev]?.delayDays ?? 3;
  const templateKind = (ev: BuyerMessageEventType): 'system' | 'custom' =>
    config?.events?.[ev]?.template?.kind === BuyerMessageTemplateKind.CUSTOM ? 'custom' : 'system';
  const templateId = (ev: BuyerMessageEventType): string =>
    config?.events?.[ev]?.template?.id ?? SYSTEM_BUYER_MESSAGE_TEMPLATES[ev].id;

  return (
    <S.Section>
      <S.ToggleRow>
        <Text variant="body-sm" weight="semibold">{t('storeSettings:storeSettings.messaging.title')}</Text>
        <Toggle checked={enabled} onChange={onToggleMaster} />
      </S.ToggleRow>
      <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.messaging.subtitle')}</Text>

      {enabled && BUYER_MESSAGE_EVENTS.map((ev) => {
        const evTemplates = templates.filter((tpl) => tpl.eventType === ev);
        const opts: Array<{ value: string; label: string }> = [
          { value: `system:${SYSTEM_BUYER_MESSAGE_TEMPLATES[ev].id}`, label: t('storeSettings:storeSettings.messaging.systemTemplate') },
          ...evTemplates.map((tpl) => ({ value: `custom:${tpl.id}`, label: tpl.name })),
        ];
        return (
          <S.EventRow key={ev}>
            <S.EventRowHeader>
              <Text variant="body-sm">{t(`storeSettings:storeSettings.messaging.events.${ev}`)}</Text>
              <Toggle checked={eventEnabled(ev)} onChange={(c) => onToggleEvent(ev, c)} />
            </S.EventRowHeader>
            {ev === BuyerMessageEventType.SHIPPED && (
              <Text variant="caption" color="text.tertiary">{t('storeSettings:storeSettings.messaging.shippedWarning')}</Text>
            )}
            {eventEnabled(ev) && (
              <S.EventControls>
                <S.SelectWrapper>
                  <ModernSelect
                    options={opts}
                    value={`${templateKind(ev)}:${templateId(ev)}`}
                    onChange={(v) => {
                      const [kind, id] = String(v).split(':');
                      onPickTemplate(ev, kind as 'system' | 'custom', id);
                    }}
                    size="small"
                    fullWidth
                    searchPlaceholder={t('translation:common.search')}
                    noResultsMessage={t('translation:common.noResults')}
                  />
                </S.SelectWrapper>
                {ev === BuyerMessageEventType.FEEDBACK_REQUEST && (
                  <ModernSelect
                    options={[1, 2, 3, 5, 7, 14].map((d) => ({ value: String(d), label: String(d) }))}
                    value={String(eventDelay(ev))}
                    onChange={(v) => onChangeDelayDays(ev, Number(v))}
                    size="small"
                    searchPlaceholder={t('translation:common.search')}
                    noResultsMessage={t('translation:common.noResults')}
                  />
                )}
              </S.EventControls>
            )}
          </S.EventRow>
        );
      })}

      <S.ManageRow>
        <Button variant="tertiary" size="small" onClick={onManageTemplates}>
          <Text>{t('storeSettings:storeSettings.messaging.manageTemplates')}</Text>
        </Button>
        <Button variant="primary" size="small" onClick={onSave} isLoading={saving}>
          <Text>{t('translation:common.save')}</Text>
        </Button>
      </S.ManageRow>
    </S.Section>
  );
};

BuyerMessagingSectionComponent.displayName = 'BuyerMessagingSectionComponent';
