import { EbayCancellationAction } from '@repo/shared';
import { Button, ConfirmModal, Drawer, EmptyState, Icon, IdBadge, InfoMessage, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CancellationDetailDrawer.style';
import type { CancellationDetailDrawerComponentProps } from './CancellationDetailDrawer.types';

import { ReturnBucketBadgeComponent } from '@/features/returns/shared/ReturnBucketBadge';

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
 * One cancellation request in full: what eBay is waiting for, what the seller
 * can do from here, the order and the buyer, the reason, the money and the
 * journey eBay recorded. Everything is read live when the drawer opens.
 */
export const CancellationDetailDrawerComponent: React.FC<CancellationDetailDrawerComponentProps> = ({
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
  const { t } = useTranslation(['cancellations', 'translation']);
  const row = detail?.row ?? null;

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
          {/* Status: the bucket, then what eBay expects and by when. */}
          <S.Pane>
            <S.StatusStack>
              <ReturnBucketBadgeComponent
                label={row.bucketLabel}
                tooltip={null}
                variant={row.bucketVariant}
                icon={row.bucketIcon}
                size="md"
              />
              <Text variant="body" weight="semibold" color="text.primary">
                {row.dueLabel ?? row.bucketHint}
              </Text>
              {row.dueBy && (
                <Text variant="body-sm" weight="medium" color={row.isOverdue ? 'semantic.error' : 'text.secondary'}>
                  {row.dueBy}
                </Text>
              )}
            </S.StatusStack>
            {!detail.live && <InfoMessage>{t('cancellations.liveUnavailable')}</InfoMessage>}
          </S.Pane>

          {/* What the seller can do — from here, or on eBay. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('cancellations.detail.whatYouCanDo')}
            </Text>
            {detail.actions.length === 0 && !detail.ebayUrl ? (
              <Text variant="body-sm" color="text.secondary">
                {t('cancellations.detail.nothingToDo')}
              </Text>
            ) : (
              <S.ActionRow>
                {detail.actions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === EbayCancellationAction.APPROVE ? 'primary' : 'secondary'}
                    size="medium"
                    onClick={() => onRequestAction(action)}
                    disabled={isActing}
                  >
                    <Text variant="body" weight="medium">
                      {t(`cancellations.actions.${action}`)}
                    </Text>
                  </Button>
                ))}
                {detail.ebayUrl && onOpenOnEbay && (
                  <Button type="button" variant="secondary" size="medium" onClick={onOpenOnEbay}>
                    <Icon name="external-link" size={16} />
                    <Text variant="body" weight="medium">
                      {t('cancellations.detail.openOnEbay')}
                    </Text>
                  </Button>
                )}
              </S.ActionRow>
            )}
            {detail.live && !detail.actionsEnabled && row.dueLabel && (
              <InfoMessage>{t('cancellations.actionsOff')}</InfoMessage>
            )}
          </S.Pane>

          {/* The order and the product. */}
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
              <Fact label={t('cancellations.order')} value={row.ebayOrderId} numeric />
              <Fact label={t('cancellations.columns.buyer')} value={row.buyerLoginName} />
              <Fact label={t('cancellations.columns.requested')} value={row.requestedAt} numeric />
              <Fact label={t('cancellations.detail.closedAt')} value={detail.closedAt} numeric />
            </S.Facts>
            {onViewOrder && (
              <S.ActionRow>
                <Button type="button" variant="tertiary" size="small" onClick={onViewOrder}>
                  <Text variant="body-sm" weight="medium">
                    {t('cancellations.viewOrder')}
                  </Text>
                </Button>
              </S.ActionRow>
            )}
          </S.Pane>

          {/* Why. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('cancellations.columns.reason')}
            </Text>
            <Text variant="body-sm" weight="semibold" color="text.primary">
              {row.reasonLabel}
            </Text>
            {row.reasonRaw && (
              <Text variant="caption" color="text.tertiary">
                {row.reasonRaw}
              </Text>
            )}
          </S.Pane>

          {/* The money. */}
          <S.Pane>
            <Text variant="h5" color="text.primary">
              {t('cancellations.detail.money')}
            </Text>
            <S.Facts>
              <Fact label={t('cancellations.detail.requestedRefund')} value={detail.requestedRefund} numeric />
              <Fact label={t('cancellations.detail.actualRefund')} value={detail.actualRefund} numeric />
              <Fact label={t('cancellations.detail.amountOwed')} value={detail.amountOwed} numeric />
              <Fact label={t('cancellations.detail.paymentStatus')} value={detail.paymentStatus} />
            </S.Facts>
            {!detail.requestedRefund && !detail.actualRefund && !detail.amountOwed && !detail.paymentStatus && (
              <Text variant="body-sm" color="text.secondary">
                {EMPTY_VALUE}
              </Text>
            )}
          </S.Pane>

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

      <ConfirmModal
        isOpen={pendingAction !== null}
        onClose={onCancelAction}
        onConfirm={onConfirmAction}
        type="warning"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={confirmDescription}
        confirmLabel={pendingAction ? t(`cancellations.confirm.${pendingAction}.confirm`) : ''}
        cancelLabel={t('translation:common.cancel')}
        isLoading={isActing}
      />
    </Drawer>
  );
};

CancellationDetailDrawerComponent.displayName = 'CancellationDetailDrawerComponent';
