// apps/web/src/features/billing/components/PaymentMethodCard/PaymentMethodCard.component.tsx
//
// Stateless — all data arrives as props (the customer's default Stripe payment
// method, already resolved by the backend, plus the existing portal-open
// handler/loading flag from BillingPage.container.tsx). No `.container.tsx`,
// matching the Button/Badge convention for stateless components.

import { Button, InfoMessage, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './PaymentMethodCard.style';
import type { PaymentMethodCardProps } from './PaymentMethodCard.types';

export const PaymentMethodCard = ({
  paymentMethod,
  onChange,
  isChangeLoading,
}: PaymentMethodCardProps): React.ReactElement => {
  const { t } = useTranslation(['billing', 'translation']);
  return (
    <S.Card variant="section" header={{ title: t('billing:billing.paymentMethod.title') }}>
      <S.Row>
        <S.CardIdentity>
          <Text variant="body" weight="semibold">
            {t('billing:billing.paymentMethod.card', {
              brand: paymentMethod.brand.toUpperCase(),
              last4: paymentMethod.last4,
            })}
          </Text>
          <Text variant="body-sm" color="text.secondary" numeric>
            {t('billing:billing.paymentMethod.expires', {
              month: String(paymentMethod.expMonth).padStart(2, '0'),
              year: paymentMethod.expYear,
            })}
          </Text>
        </S.CardIdentity>
        <Button variant="secondary" size="small" isLoading={isChangeLoading} onClick={onChange}>
          <Text variant="body-sm">{t('billing:billing.paymentMethod.change')}</Text>
        </Button>
      </S.Row>
      {paymentMethod.expiringSoon ? (
        <InfoMessage>{t('billing:billing.paymentMethod.expiringSoon')}</InfoMessage>
      ) : null}
    </S.Card>
  );
};

PaymentMethodCard.displayName = 'PaymentMethodCard';
