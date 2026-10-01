import { EbayReturnAction } from '@repo/shared';
import { Button, ConfirmModal, Drawer, EmptyState, Icon, IdBadge, InfoMessage, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnBucketBadge } from '../shared/ReturnBucketBadge';

import * as S from './ReturnDetailDrawer.style';
import type { ReturnDetailDrawerComponentProps } from './ReturnDetailDrawer.types';


const EMPTY_VALUE = '—';

const Fact = ({ label, value, numeric }: { label: string; value: string | null; numeric?: boolean }) =>
  value ? (
    <S.Fact>
      <S.FactLabel>
        <Text variant="body-sm" color="text.secondary">
          {label}
        </Text>
      </S.FactLabel>
      <S.FactValue>
        <Text variant="body-sm" weight="semibold" color="text.primary" numeric={numeric}>
          {value}
        </Text>
      </S.FactValue>
    </S.Fact>
  ) : null;

/**
 * One return in full: what eBay is waiting for, what the seller can do from
 * here, the product and the buyer, the money, the return shipment, and the
 * journey eBay recorded. Everything is read live when the drawer opens.
 */
export const ReturnDetailDrawerComponent: React.FC<ReturnDetailDrawerComponentProps> = ({
  isOpen,
  onClose,
  isLoading,
  isError,
  detail,
  onViewOrder,
  onOpenOnEbay,
  onRequestAction,
  pendingAction,
  confirmDescription,
  onConfirmAction,
  onCancelAction,
  isActing,
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
          {/* Status: the bucket, then what eBay expects and by when. */}
          <S.Pane>
            <S.StatusStack>
              <ReturnBucketBadge bucket={row.bucket} size="md" withTooltip={false} />
              <Text variant="body" weight="semibold" color="text.primary">
                {row.dueLabel ?? t(`returns.bucketHint.${row.bucket}`)}
              </Text>
              {row.dueBy && (
                <Text variant="body-sm" weight="medium" color={row.isOverdue ? 'semantic.error' : 'text.secondary'}>
                  {row.dueBy}
                </Text>
              )}
            </S.StatusStack>
            {!detail.live && <InfoMessage>{t('returns.detail.offline')}</InfoMessage>}
          </S.Pane>

          {/* What the seller can do — from here, or on eBay. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('returns.detail.whatYouCanDo')}
            </Text>
            {detail.actions.length === 0 && !detail.ebayUrl && detail.optionsOnEbay.length === 0 ? (
              <Text variant="body-sm" color="text.secondary">
                {t('returns.detail.nothingToDo')}
              </Text>
            ) : (
              <>
                <S.ActionRow>
                  {detail.actions.map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant={action === EbayReturnAction.MARK_RECEIVED ? 'secondary' : 'primary'}
                      size="medium"
                      onClick={() => onRequestAction(action)}
                      disabled={isActing}
                    >
                      <Text variant="body" weight="medium">
                        {action === EbayReturnAction.ISSUE_REFUND && detail.refundToIssue
                          ? t('returns.actions.buttonWithAmount.issue_refund', { amount: detail.refundToIssue })
                          : t(`returns.actions.button.${action}`)}
                      </Text>
                    </Button>
                  ))}
                  {detail.ebayUrl && onOpenOnEbay && (
                    <Button type="button" variant="secondary" size="medium" onClick={onOpenOnEbay}>
                      <Icon name="external-link" size={16} />
                      <Text variant="body" weight="medium">
                        {t('returns.detail.openOnEbay')}
                      </Text>
                    </Button>
                  )}
                </S.ActionRow>
                {detail.optionsOnEbay.length > 0 && (
                  <Text variant="caption" color="text.secondary">
                    {t('returns.detail.alsoOnEbay', { options: detail.optionsOnEbay.join(' · ') })}
                  </Text>
                )}
              </>
            )}
          </S.Pane>

          {/* The product and the buyer. */}
          <S.Pane>
            <S.Product>
              <S.Image>{row.imageUrl ? <img src={row.imageUrl} alt="" /> : <Icon name="image" size={28} />}</S.Image>
              <S.ProductText>
                <S.Title variant="body" weight="semibold" color="text.primary">
                  {row.productTitle}
                </S.Title>
                {row.productMeta.map((meta) => (
                  <S.MetaRow key={meta.id}>
                    <Text variant="caption" color="text.tertiary">
                      {meta.label}
                    </Text>
                    <IdBadge id={meta.id} storeType={meta.storeType} size="sm" plain />
                  </S.MetaRow>
                ))}
              </S.ProductText>
            </S.Product>
            <S.Facts>
              <Fact label={t('returns.order')} value={row.ebayOrderId} numeric />
              <Fact label={t('returns.detail.buyer')} value={detail.buyerLoginName} />
              <Fact label={t('returns.detail.quantity')} value={detail.quantity === null ? null : String(detail.quantity)} numeric />
              <Fact label={t('returns.detail.returnType')} value={detail.returnTypeLabel} />
              <Fact label={t('returns.columns.opened')} value={row.openedAt} numeric />
            </S.Facts>
            {onViewOrder && (
              <S.ActionRow>
                <Button type="button" variant="tertiary" size="small" onClick={onViewOrder}>
                  <Text variant="body-sm" weight="medium">
                    {t('returns.viewOrder')}
                  </Text>
                </Button>
              </S.ActionRow>
            )}
          </S.Pane>

          {/* Why. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('returns.columns.reason')}
            </Text>
            <Text variant="body-sm" weight="semibold" color="text.primary">
              {row.reasonLabel}
            </Text>
            {row.buyerComment && (
              <S.Comment variant="body-sm" color="text.secondary">
                {row.buyerComment}
              </S.Comment>
            )}
          </S.Pane>

          {/* The money. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('returns.columns.refund')}
            </Text>
            <S.Facts>
              <Fact label={t('returns.detail.itemPrice')} value={detail.itemPrice} numeric />
              <Fact label={t('returns.refund.estimated')} value={detail.estimatedRefund} numeric />
              <Fact label={t('returns.refund.refunded')} value={detail.actualRefund} numeric />
              <Fact label={t('returns.detail.closedAs')} value={detail.closeReasonLabel} />
              <Fact label={t('returns.detail.closedAt')} value={detail.closedAt} numeric />
            </S.Facts>
            {!detail.itemPrice && !detail.estimatedRefund && !detail.actualRefund && (
              <Text variant="body-sm" color="text.secondary">
                {EMPTY_VALUE}
              </Text>
            )}
          </S.Pane>

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

      <ConfirmModal
        isOpen={pendingAction !== null}
        onClose={onCancelAction}
        onConfirm={onConfirmAction}
        type={pendingAction === EbayReturnAction.ISSUE_REFUND ? 'warning' : 'info'}
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={confirmDescription}
        confirmLabel={pendingAction ? t(`returns.actions.button.${pendingAction}`) : ''}
        cancelLabel={t('translation:common.cancel')}
        isLoading={isActing}
      />
    </Drawer>
  );
};

ReturnDetailDrawerComponent.displayName = 'ReturnDetailDrawerComponent';
