import { AmazonAccountStatus, type AmazonAccountPublicDto } from '@repo/shared';
import { formatDate, getLocaleConfig, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountsDrawerComponent } from './AmazonAccountsDrawer.component';
import type {
  AmazonAccountCardView,
  AmazonAccountsDrawerProps,
} from './AmazonAccountsDrawer.types';

import { useVerifyAmazonAccountMutation } from '@/features/amazon/api/amazon.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const AmazonAccountsDrawer: React.FC<AmazonAccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onEdit,
}) => {
  const { t, i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);
  const { showMessage } = useUI();
  const [verifyAccount] = useVerifyAmazonAccountMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Reset the selection when the drawer transitions to closed — without an
  // effect (avoids cascading setState-in-effect). Render-time guard per the
  // React "adjusting state when a prop changes" pattern.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setSelectedId(null);
    }
  }

  const handleSelect = (id: string): void => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleContinue = (): void => {
    if (selectedId) {
      onEdit(selectedId);
    }
  };

  // Verification runs on a BullMQ worker (Playwright login). The mutation only
  // marks the account VERIFYING and enqueues; the hub already polls while any
  // account is in that state, so the card resolves to active/invalid on its own.
  const handleVerify = (id: string): void => {
    void verifyAccount(id)
      .unwrap()
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error, 'translation:common.error'),
          },
          t
        );
      });
  };

  const cards: AmazonAccountCardView[] = accounts.map((a: AmazonAccountPublicDto) => ({
    id: a.id,
    displayName: a.label || a.email,
    email: a.email,
    connectedSince: formatDate(a.createdAt, locale, { year: 'numeric' }),
    status: a.status,
    lastVerificationError: a.lastVerificationError ?? undefined,
    isVerifying: a.status === AmazonAccountStatus.VERIFYING,
  }));

  return (
    <AmazonAccountsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      accounts={cards}
      selectedId={selectedId}
      isContinueDisabled={selectedId === null}
      onSelect={handleSelect}
      onContinue={handleContinue}
      onVerify={handleVerify}
    />
  );
};

AmazonAccountsDrawer.displayName = 'AmazonAccountsDrawer';
