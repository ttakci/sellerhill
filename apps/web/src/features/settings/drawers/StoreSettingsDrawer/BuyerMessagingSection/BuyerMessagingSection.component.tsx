import { BuyerMessageEventType } from '@repo/shared';
import { Icon, ModernSelect, Text, Toggle, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BuyerMessagingSection.style';
import { BUYER_MESSAGE_EVENTS, type BuyerMessagingSectionProps } from './BuyerMessagingSection.types';

export const BuyerMessagingSectionComponent: React.FC<BuyerMessagingSectionProps> = ({
  config,
  templates,
  onToggleMaster,
  onToggleEvent,
  onPickTemplate,
  onChangeDelayDays,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const enabled = config.enabled;

  const eventEnabled = (ev: BuyerMessageEventType): boolean => config.events?.[ev]?.enabled ?? false;
  const eventDelay = (ev: BuyerMessageEventType): number => config.events?.[ev]?.delayDays ?? 3;
  const templateId = (ev: BuyerMessageEventType): string => config.events?.[ev]?.template?.id ?? '';

  return (
    <S.Section>
      <S.MasterCard>
        <S.ToggleRow>
          <Text variant="body-sm" weight="semibold">
            {t('storeSettings:storeSettings.messaging.title')}
          </Text>
          <Toggle checked={enabled} onChange={onToggleMaster} />
        </S.ToggleRow>
        <Text variant="caption" color="text.secondary">
          {t('storeSettings:storeSettings.messaging.subtitle')}
        </Text>
      </S.MasterCard>

      {enabled && (
        <S.EventList>
          {BUYER_MESSAGE_EVENTS.map((ev) => {
            const opts = templates
              .filter((tpl) => tpl.eventType === ev)
              .map((tpl) => ({
                value: tpl.id,
                label: tpl.isDefault
                  ? `${tpl.name} (${t('storeSettings:storeSettings.messaging.systemTemplate')})`
                  : tpl.name,
              }));
            return (
              <S.EventRow key={ev}>
                <S.EventRowHeader>
                  <S.EventTitleRow>
                    <Text variant="body-sm" weight="semibold">
                      {t(`storeSettings:storeSettings.messaging.events.${ev}`)}
                    </Text>
                    <Tooltip
                      content={t(`storeSettings:storeSettings.messaging.eventDescriptions.${ev}`)}
                      position="top"
                      variant="dark"
                    >
                      <S.InfoButton
                        type="button"
                        variant="ghost"
                        aria-label={t(`storeSettings:storeSettings.messaging.eventDescriptions.${ev}`)}
                      >
                        <Icon name="info" size={14} color="text.tertiary" />
                      </S.InfoButton>
                    </Tooltip>
                  </S.EventTitleRow>
                  <Toggle checked={eventEnabled(ev)} onChange={(checked) => onToggleEvent(ev, checked)} />
                </S.EventRowHeader>
                {eventEnabled(ev) && (
                  <S.EventControls>
                    <S.SelectWrapper>
                      <ModernSelect
                        options={opts}
                        value={templateId(ev)}
                        onChange={(value) => onPickTemplate(ev, String(value))}
                        size="small"
                        fullWidth
                        searchPlaceholder={t('translation:common.search')}
                        noResultsMessage={t('translation:common.noResults')}
                      />
                    </S.SelectWrapper>
                    {ev === BuyerMessageEventType.FEEDBACK_REQUEST && (
                      <S.DelaySelectWrapper>
                        <ModernSelect
                          options={[1, 2, 3, 5, 7, 14].map((days) => ({
                            value: String(days),
                            label: t('storeSettings:storeSettings.messaging.delayDaysOption', { count: days }),
                          }))}
                          value={String(eventDelay(ev))}
                          onChange={(value) => onChangeDelayDays(ev, Number(value))}
                          size="small"
                          fullWidth
                          searchPlaceholder={t('translation:common.search')}
                          noResultsMessage={t('translation:common.noResults')}
                        />
                      </S.DelaySelectWrapper>
                    )}
                  </S.EventControls>
                )}
              </S.EventRow>
            );
          })}
        </S.EventList>
      )}
    </S.Section>
  );
};

BuyerMessagingSectionComponent.displayName = 'BuyerMessagingSectionComponent';
