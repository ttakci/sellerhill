// apps/web/src/features/billing/components/PlanChangeConfirm/PlanChangeConfirm.component.tsx
//
// Stateless confirmation dialog shown before an EXISTING Stripe subscription
// is repriced. The container previews the change via `POST
// /billing/plan-change/preview` (Stripe's own proration arithmetic, not an
// estimate computed here) and assembles the localized body text — this
// component only lays out the Modal shell around it. No `.container.tsx`,
// matching PaymentMethodCard's stateless convention: everything arrives as
// props.
//
// No `.style.ts` — Modal/Button/Text already supply every visual need here,
// so there is nothing to style locally.

import { Button, Modal, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PlanChangeConfirmProps } from './PlanChangeConfirm.types';

export const PlanChangeConfirm = ({
  isOpen,
  body,
  isConfirming,
  onConfirm,
  onCancel,
}: PlanChangeConfirmProps): React.ReactElement => {
  const { t } = useTranslation(['billing']);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t('billing:billing.planChange.title')}
      footer={
        <>
          <Button variant="secondary" size="medium" disabled={isConfirming} onClick={onCancel}>
            <Text variant="body-sm">{t('billing:billing.planChange.cancel')}</Text>
          </Button>
          <Button variant="primary" size="medium" isLoading={isConfirming} onClick={onConfirm}>
            <Text variant="body-sm">{t('billing:billing.planChange.confirm')}</Text>
          </Button>
        </>
      }
    >
      <Text variant="body">{body}</Text>
    </Modal>
  );
};

PlanChangeConfirm.displayName = 'PlanChangeConfirm';
