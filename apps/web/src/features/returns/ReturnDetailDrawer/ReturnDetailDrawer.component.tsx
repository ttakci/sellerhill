import { EbayReturnAction, RETURN_LABEL_ACCEPT, ReturnLabelCarrier } from '@repo/shared';
import {
  Button,
  Drawer,
  EmptyState,
  FilePicker,
  IdBadge,
  InfoMessage,
  ModernTextInput,
  Radio,
  Select,
  Text,
  ValidationMessage,
  Icon,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnBucketBadge } from '../shared/ReturnBucketBadge';

import * as S from './ReturnDetailDrawer.style';
import type { ReturnDetailDrawerComponentProps } from './ReturnDetailDrawer.types';

const EMPTY_VALUE = '—';

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
 * One return in full, in the cancellation drawer's format. The top pane is the
 * return itself — status, eBay's deadline, the return id (linked to eBay), the
 * reason and the buyer's words — and, while eBay offers something the app can
 * do, the answer form: one radio per action, the label fields under "upload a
 * label", then Send. Below it the order card, the return shipment and the
 * journey eBay recorded. Everything is read live when the drawer opens.
 */
export const ReturnDetailDrawerComponent: React.FC<ReturnDetailDrawerComponentProps> = ({
  isOpen,
  onClose,
  isLoading,
  isError,
  detail,
  choices,
  choice,
  onChoiceChange,
  choiceMissing,
  labelFileName,
  onLabelFileChange,
  carrier,
  carrierOptions,
  onCarrierChange,
  carrierName,
  onCarrierNameChange,
  tracking,
  onTrackingChange,
  labelErrors,
  onSend,
  isActing,
  orderMeta,
  orderStats,
  onOpenOrder,
}) => {
  const { t } = useTranslation(['returns', 'translation']);
  const row = detail?.row ?? null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={row ? t('returns.detail.title', { id: row.returnId }) : t('returns.detail.titleLoading')}
      subtitle={row?.productTitle}
    >
      {isLoading || isError || !detail || !row ? (
        <S.EmptyWrap>
          <EmptyState
            icon="undo-2"
            title={isLoading ? t('translation:common.loading') : t('returns.detail.loadFailed')}
            description={isLoading ? '' : t('returns.detail.loadFailedDescription')}
          />
        </S.EmptyWrap>
      ) : (
        <S.BodyStack>
          {/* The return: status + deadline, its id and reason, and the answer. */}
          <S.Pane>
            <S.StatusHead>
              <S.StatusStack>
                <ReturnBucketBadge bucket={row.bucket} size="sm" withTooltip={false} />
                <Text variant="body" weight="semibold" color="text.primary">
                  {row.dueLabel ?? t(`returns.bucketHint.${row.bucket}`)}
                </Text>
              </S.StatusStack>
              {row.dueDate && (
                <S.Deadline>
                  <Text variant="caption" color="text.secondary">
                    {t('returns.columns.deadline')}
                  </Text>
                  <Text variant="body-sm" weight="bold" color={row.isOverdue ? 'semantic.error' : 'text.primary'} numeric>
                    {row.dueDate}
                  </Text>
                </S.Deadline>
              )}
            </S.StatusHead>
            <S.Facts>
              <Fact
                label={t('returns.detail.returnId')}
                value={
                  detail.ebayUrl ? (
                    <IdBadge id={row.returnId} storeType="ebay" href={detail.ebayUrl} size="sm" plain />
                  ) : (
                    row.returnId
                  )
                }
              />
              <Fact label={t('returns.columns.reason')} value={row.reasonLabel} />
            </S.Facts>
            {row.buyerComment && (
              <S.Comment variant="caption" color="text.tertiary">
                {row.buyerComment}
              </S.Comment>
            )}
            {!detail.live && <InfoMessage>{t('returns.detail.offline')}</InfoMessage>}
            {detail.live && !detail.actionsEnabled && row.dueLabel && (
              <InfoMessage>{t('returns.detail.actionsOff')}</InfoMessage>
            )}

            {choices.length > 0 && (
              <S.AnswerForm>
                <S.RadioList role="radiogroup" aria-label={t('returns.form.choose')}>
                  {choices.map((option) => (
                    <Radio
                      key={option.action}
                      name={`return-answer-${row.id}`}
                      value={option.action}
                      label={option.label}
                      checked={choice === option.action}
                      onChange={onChoiceChange}
                    />
                  ))}
                </S.RadioList>
                {choiceMissing && <ValidationMessage>{t('returns.form.choose')}</ValidationMessage>}
                {choice === EbayReturnAction.PROVIDE_LABEL && (
                  <S.LabelFields>
                    <Text variant="h5" color="text.primary">
                      {t('returns.form.labelTitle')}
                    </Text>
                    <FilePicker
                      accept={RETURN_LABEL_ACCEPT}
                      fileName={labelFileName}
                      label={t('returns.form.labelFile')}
                      hint={t('returns.form.labelFileHint')}
                      onChange={onLabelFileChange}
                    />
                    {labelErrors.file && <ValidationMessage>{labelErrors.file}</ValidationMessage>}
                    <Select
                      label={t('returns.form.carrier')}
                      value={carrier ?? ''}
                      options={carrierOptions}
                      onChange={onCarrierChange}
                      size="small"
                      fullWidth
                      error={labelErrors.carrier ? { message: labelErrors.carrier } : undefined}
                    />
                    {carrier === ReturnLabelCarrier.OTHER && (
                      <ModernTextInput
                        name="returnLabelCarrierName"
                        value={carrierName}
                        onChange={onCarrierNameChange}
                        label={t('returns.form.carrierName')}
                        size="small"
                        fullWidth
                        errorMessage={labelErrors.carrierName ?? undefined}
                      />
                    )}
                    <ModernTextInput
                      name="returnLabelTracking"
                      value={tracking}
                      onChange={onTrackingChange}
                      label={t('returns.form.tracking')}
                      size="small"
                      fullWidth
                      errorMessage={labelErrors.tracking ?? undefined}
                    />
                  </S.LabelFields>
                )}
                {choice === EbayReturnAction.MARK_LABEL_SENT && (
                  <Text variant="caption" color="text.secondary">
                    {t('returns.form.markLabelSentHint')}
                  </Text>
                )}
                {choice === EbayReturnAction.ISSUE_REFUND && (
                  <Text variant="caption" color="text.secondary">
                    {t('returns.form.refundHint')}
                  </Text>
                )}
                <S.SendRow>
                  <Button type="button" variant="primary" size="medium" onClick={onSend} isLoading={isActing}>
                    <Icon name="send" size={16} />
                    <Text variant="body" weight="medium">
                      {t('returns.form.send')}
                    </Text>
                  </Button>
                </S.SendRow>
              </S.AnswerForm>
            )}

          </S.Pane>

          {/* The order this return is about — the orders list's own card. */}
          <S.OrderCardInDrawer
            productTitle={row.productTitle}
            imageUrl={row.imageUrl}
            ebayOrderId={row.ebayOrderId ?? row.returnId}
            showStage={false}
            meta={orderMeta}
            stats={orderStats}
            detailLabel={onOpenOrder ? t('translation:common.details') : undefined}
            onClick={onOpenOrder}
            hoverEffect={Boolean(onOpenOrder)}
          />

          {/* The return shipment, when eBay tracks one. */}
          {detail.shipments.length > 0 && (
            <S.Pane>
              <Text variant="h5" color="text.primary">
                {t('returns.detail.shipment')}
              </Text>
              {detail.shipments.map((shipment) => (
                <S.Shipment key={shipment.id}>
                  <S.HistoryMeta>
                    <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
                      {shipment.trackingNumber ?? EMPTY_VALUE}
                    </Text>
                    {shipment.carrier && (
                      <Text variant="caption" color="text.secondary">
                        {shipment.carrier}
                      </Text>
                    )}
                    {shipment.statusLabel && (
                      <Text variant="caption" weight="medium" color="text.secondary">
                        {shipment.statusLabel}
                      </Text>
                    )}
                  </S.HistoryMeta>
                  <S.Facts>
                    <Fact label={t('returns.detail.shippedAt')} value={shipment.shippedAt} numeric />
                    <Fact label={t('returns.detail.deliveredAt')} value={shipment.deliveredAt} numeric />
                    <Fact
                      label={t('returns.detail.markedReceived')}
                      value={shipment.markedReceived ? t('returns.detail.yes') : t('returns.detail.no')}
                    />
                  </S.Facts>
                </S.Shipment>
              ))}
            </S.Pane>
          )}

          {/* The journey eBay recorded — oldest first. */}
          {detail.live && (
            <S.Pane>
              <Text variant="h5" color="text.primary">
                {t('returns.detail.journey')}
              </Text>
              {detail.history.length === 0 ? (
                <Text variant="body-sm" color="text.secondary">
                  {t('returns.detail.journeyEmpty')}
                </Text>
              ) : (
                <S.History>
                  {detail.history.map((step, index) => (
                    <S.HistoryRow key={step.id}>
                      <S.Rail>
                        <S.Marker $actor={step.actor} />
                        {index < detail.history.length - 1 && <S.RailLine />}
                      </S.Rail>
                      <S.HistoryText>
                        <Text variant="body-sm" weight="semibold" color="text.primary">
                          {step.label}
                        </Text>
                        <S.HistoryMeta>
                          {step.at && (
                            <Text variant="caption" color="text.tertiary" numeric>
                              {step.at}
                            </Text>
                          )}
                          {step.author && (
                            <Text variant="caption" color="text.tertiary">
                              {step.author}
                            </Text>
                          )}
                        </S.HistoryMeta>
                        {step.partialRefund && (
                          <Text variant="caption" color="text.secondary" numeric>
                            {t('returns.detail.partialRefundOffered', { amount: step.partialRefund })}
                          </Text>
                        )}
                        {step.trackingNumber && (
                          <Text variant="caption" color="text.secondary" numeric>
                            {t('returns.detail.trackingNumber', { number: step.trackingNumber })}
                          </Text>
                        )}
                        {step.rma && (
                          <Text variant="caption" color="text.secondary" numeric>
                            {t('returns.detail.rma', { rma: step.rma })}
                          </Text>
                        )}
                        {step.notes && (
                          <S.Comment variant="caption" color="text.secondary">
                            {step.notes}
                          </S.Comment>
                        )}
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

ReturnDetailDrawerComponent.displayName = 'ReturnDetailDrawerComponent';
