import { SupportQueueFilter } from '@repo/shared';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useListSupportConversationsQuery } from '../api/support.api';

import { SupportPageComponent } from './SupportPage.component';

export const SupportPage = (): React.ReactElement => {
  const navigate = useNavigate();
  const { locale } = useParams();
  const [filter, setFilter] = useState(SupportQueueFilter.WAITING);
  const query = useListSupportConversationsQuery({ filter, limit: 50 });
  return <SupportPageComponent filter={filter} isLoading={query.isLoading} items={query.data?.items ?? []} onFilterChange={setFilter} onOpenConversation={(id) => { void navigate(`/${locale}/support/${id}`); }} />;
};
