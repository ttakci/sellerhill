import { EbayCancellationAction } from '@repo/shared';
import {
  Button,
  DatePicker,
  Drawer,
  EmptyState,
  IdBadge,
  InfoMessage,
  ModernTextInput,
  Radio,
  Text,
  ValidationMessage,
  Icon,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CancellationDetailDrawer.style';
import type { CancellationDetailDrawerComponentProps } from './CancellationDetailDrawer.types';

import { ReturnBucketBadgeComponent } from '@/features/returns/shared/ReturnBucketBadge';

const Fact = ({ label, value, numeric }: { label: string; value: React.ReactNode | null; numeric?: boolean }) =>
  value ? (
    <S.Fact>
      <S.FactLabel>
        <Text variant="body-sm" color="text.secondary">
          {label}
        </Text>
      </S.FactLabel>
      <S.FactValue>
        {typeof value === 'string' ? (
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric={numeric}>
            {value}
          </Text>
        ) : (
          value
        )}
      </S.FactValue>
    </S.Fact>
  ) : null;

/**
 * One cancellation request in full. The top pane is the request itself — status,
 * eBay's deadline, the request id (linked to eBay), the buyer's reason — and, while
 * eBay still offers it, the answer form eBay's own page has: accept or decline, and
 * on a decline the optional shipment date and tracking number, then Send.
 */
export const CancellationDetailDrawerComponent: React.FC<CancellationDetailDrawerComponentProps> = ({
  isOpen,
  onClose,
  isLoading,
  isError,
  detail,
  locale,
  choice,
  onChoiceChange,
  shipDate,
  onShipDateChange,
  tracking,
  onTrackingChange,
  choiceMissing,
  onSend,
  isActing,
  orderMeta,
  orderStats,
  onOpenOrder,
}) => {
  const { t } = useTranslation(['cancellations', 'translation']);
  const row = detail?.row ?? null;
  const canAnswer = Boolean(detail && detail.actions.length > 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={row ? t('cancellations.detail.title', { id: row.cancelId }) : t('cancellations.detail.titleLoading')}
      subtitle={row?.productTitle}
    >
      {isLoading || isError || !detail || !row ? (
        <S.EmptyWrap>
          <EmptyState
            icon="x-circle"
            title={isLoading ? t('translation:common.loading') : t('cancellations.detail.loadFailed')}
            description={isLoading ? '' : t('cancellations.detail.loadFailedDescription')}
          />
        </S.EmptyWrap>
      ) : (
        <S.BodyStack>
          {/* The request: status + deadline, its id and reason, and the answer. */}
          <S.Pane>
            <S.StatusHead>
              <ReturnBucketBadgeComponent
                label={row.bucketLabel}
                tooltip={null}
                variant={row.bucketVariant}
                icon={row.bucketIcon}
                size="sm"
              />
              {row.dueDate && (
                <S.Deadline>
                  <Text variant="caption" color="text.secondary">
                    {t('cancellations.columns.deadline')}
                  </Text>
                  <Text variant="body-sm" weight="bold" color={row.isOverdue ? 'semantic.error' : 'text.primary'} numeric>
                    {row.dueDate}
                  </Text>
                </S.Deadline>
              )}
            </S.StatusHead>
            <S.Facts>
              <Fact
                label={t('cancellations.detail.requestId')}
                value={
                  detail.ebayUrl ? (
                    <IdBadge id={row.cancelId} storeType="ebay" href={detail.ebayUrl} size="sm" plain />
                  ) : (
                    row.cancelId
                  )
                }
              />
              <Fact label={t('cancellations.columns.reason')} value={row.reasonLabel} />
            </S.Facts>
            {row.reasonRaw && (
              <Text variant="caption" color="text.tertiary">
                {row.reasonRaw}
              </Text>
            )}
            {!detail.live && <InfoMessage>{t('cancellations.liveUnavailable')}</InfoMessage>}
            {detail.live && !detail.actionsEnabled && row.dueDate && (
              <InfoMessage>{t('cancellations.actionsOff')}</InfoMessage>
            )}

            {canAnswer && (
              <S.AnswerForm>
                <S.RadioRow role="radiogroup" aria-label={t('cancellations.form.choose')}>
                  {detail.actions.map((action) => (
                    <Radio
                      key={action}
                      name={`cancellation-answer-${row.id}`}
                      value={action}
                      label={t(`cancellations.actions.${action}`)}
                      checked={choice === action}
                      onChange={onChoiceChange}
                    />
                  ))}
                </S.RadioRow>
                {choiceMissing && <ValidationMessage>{t('cancellations.form.choose')}</ValidationMessage>}
                {choice === EbayCancellationAction.REJECT && (
                  <>
                    <Text variant="h5" color="text.primary">
                      {t('cancellations.form.shippingTitle')}
                    </Text>
                    <DatePicker
                      value={shipDate}
                      onChange={onShipDateChange}
                      label={t('cancellations.form.shipDate')}
                      locale={locale}
                      clearLabel={t('cancellations.filters.clear')}
                      size="small"
                      fullWidth
                    />
                    <ModernTextInput
                      name="cancellationTracking"
                      value={tracking}
                      onChange={onTrackingChange}
                      label={t('cancellations.form.tracking')}
                      size="small"
                      fullWidth
                    />
                  </>
                )}
                <S.SendRow>
                  <Button type="button" variant="primary" size="medium" onClick={onSend} isLoading={isActing}>
                    <Icon name="send" size={16} />
                    <Text variant="body" weight="medium">
                      {t('cancellations.form.send')}
                    </Text>
                  </Button>
                </S.SendRow>
              </S.AnswerForm>
            )}
          </S.Pane>

          {/* The order this request is about — the orders list's own card. */}
          <S.OrderCardInDrawer
            productTitle={row.productTitle}
            imageUrl={row.imageUrl}
            ebayOrderId={row.ebayOrderId ?? row.cancelId}
            showStage={false}
            meta={orderMeta}
            stats={orderStats}
            detailLabel={onOpenOrder ? t('translation:common.details') : undefined}
            onClick={onOpenOrder}
            hoverEffect={Boolean(onOpenOrder)}
          />

          {/* The journey eBay recorded — oldest first. */}
          {detail.live && (
            <S.Pane>
              <Text variant="h5" color="text.primary">
                {t('cancellations.detail.journey')}
              </Text>
              {detail.history.length === 0 ? (
                <Text variant="body-sm" color="text.secondary">
                  {t('cancellations.detail.journeyEmpty')}
                </Text>
              ) : (
                <S.History>
                  {detail.history.map((step, index) => (
                    <S.HistoryRow key={step.id}>
                      <S.Rail>
                        <S.StepMarker $upcoming={step.upcoming} />
                        {index < detail.history.length - 1 && <S.RailLine />}
                      </S.Rail>
                      <S.HistoryText>
                        <Text
                          variant="body-sm"
                          weight={step.upcoming ? 'regular' : 'semibold'}
                          color={step.upcoming ? 'text.tertiary' : 'text.primary'}
                        >
                          {step.label}
                        </Text>
                        <S.HistoryMeta>
                          {step.upcoming ? (
                            <Text variant="caption" color="text.tertiary">
                              {t('cancellations.history.pending')}
                            </Text>
                          ) : (
                            step.at && (
                              <Text variant="caption" color="text.tertiary" numeric>
                                {step.at}
                              </Text>
                            )
                          )}
                          <Text variant="caption" color="text.tertiary">
                            {t(`cancellations.party.${step.actor}`)}
                          </Text>
                        </S.HistoryMeta>
                      </S.HistoryText>
                    </S.HistoryRow>
                  ))}
                </S.History>
              )}
            </S.Pane>
          )}
        </S.BodyStack>
      )}
    </Drawer>
  );
};

CancellationDetailDrawerComponent.displayName = 'CancellationDetailDrawerComponent';
