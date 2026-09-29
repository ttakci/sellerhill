/**
 * MessagesPage — placeholder.
 *
 * Wires the route (`/messages`) and the `EbayAccountGuard` gate live so the
 * sidebar nav item and lazy route have somewhere real to land. The actual
 * inbox UI (folder rail, conversation list, thread view) is built in a later
 * task and replaces this file's contents — not its export name or path.
 */

import { PageContainer, PageHeader } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';

export const MessagesPageContainer: React.FC = () => {
  const { t } = useTranslation(['messages', 'translation']);

  return (
    <EbayAccountGuard>
      <PageContainer>
        <PageHeader title={t('messages.page.title')} subtitle={t('messages.page.subtitle')} />
      </PageContainer>
    </EbayAccountGuard>
  );
};

export default MessagesPageContainer;
