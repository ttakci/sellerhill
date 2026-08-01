import type { AmazonAccountPublicDto } from '@repo/shared';
import { formatDate, getLocaleConfig } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountsDrawerComponent } from './AmazonAccountsDrawer.component';
import type {
  AmazonAccountCardView,
  AmazonAccountsDrawerProps,
} from './AmazonAccountsDrawer.types';

export const AmazonAccountsDrawer: React.FC<AmazonAccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onEdit,
}) => {
  const { i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);
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

  const cards: AmazonAccountCardView[] = accounts.map((a: AmazonAccountPublicDto) => ({
    id: a.id,
    displayName: a.label || a.email,
    email: a.email,
    connectedSince: formatDate(a.createdAt, locale, { year: 'numeric' }),
    status: a.status,
    lastVerificationError: a.lastVerificationError ?? undefined,
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
    />
  );
};

AmazonAccountsDrawer.displayName = 'AmazonAccountsDrawer';
