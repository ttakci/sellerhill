import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useAddAdminVeroKeywordsMutation,
  useGetAdminVeroKeywordsQuery,
  useRemoveAdminVeroKeywordMutation,
} from '../../api/admin.api';

import { VeroKeywordsPanelComponent } from './VeroKeywordsPanel.component';
import type { VeroKeywordsPanelProps } from './VeroKeywordsPanel.types';

const PAGE_SIZE = 100;

/**
 * The platform VeRO brand list: brand names refused for every seller who keeps
 * VeRO protection on. Operator-only — a seller never sees this list, only the
 * one brand that matched a product of theirs.
 */
export const VeroKeywordsPanel: React.FC<VeroKeywordsPanelProps> = ({ skip }) => {
  const { t } = useTranslation(['admin']);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [addResult, setAddResult] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data } = useGetAdminVeroKeywordsQuery({ search, page, limit: PAGE_SIZE }, { skip });
  const [addKeywords, { isLoading: isAdding }] = useAddAdminVeroKeywordsMutation();
  const [removeKeyword] = useRemoveAdminVeroKeywordMutation();

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
    // A narrowed list on page 4 of the old one would show an empty page.
    setPage(1);
  }, []);

  const handleAdd = useCallback((): void => {
    if (!draft.trim()) {
      return;
    }
    void addKeywords({ keywords: [draft] })
      .unwrap()
      .then((result) => {
        setDraft('');
        setAddResult(t('admin.vero.addResult', { added: result.added, skipped: result.skipped }));
      })
      .catch(() => {
        setAddResult(t('admin.vero.addFailed'));
      });
  }, [draft, addKeywords, t]);

  const handleRemove = useCallback(
    (id: string): void => {
      setRemovingId(id);
      void removeKeyword(id)
        .unwrap()
        .catch(() => undefined)
        .finally(() => setRemovingId(null));
    },
    [removeKeyword]
  );

  return (
    <VeroKeywordsPanelComponent
      items={data?.items ?? []}
      total={total}
      search={search}
      onSearchChange={handleSearchChange}
      draft={draft}
      onDraftChange={(e) => setDraft(e.target.value)}
      onAdd={handleAdd}
      isAdding={isAdding}
      addResult={addResult}
      onRemove={handleRemove}
      removingId={removingId}
      page={Math.min(page, pageCount)}
      pageCount={pageCount}
      onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
      onNextPage={() => setPage((current) => Math.min(pageCount, current + 1))}
    />
  );
};

VeroKeywordsPanel.displayName = 'VeroKeywordsPanel';
