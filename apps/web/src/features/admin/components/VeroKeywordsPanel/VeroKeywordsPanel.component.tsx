import { Button, SearchField, Text, Textarea } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './VeroKeywordsPanel.style';
import type { VeroKeywordsPanelComponentProps } from './VeroKeywordsPanel.types';

export const VeroKeywordsPanelComponent: React.FC<VeroKeywordsPanelComponentProps> = ({
  items,
  total,
  search,
  onSearchChange,
  draft,
  onDraftChange,
  onAdd,
  isAdding,
  addResult,
  onRemove,
  removingId,
  page,
  pageCount,
  onPreviousPage,
  onNextPage,
}) => {
  const { t } = useTranslation(['admin']);

  return (
    <S.Section>
      <Text variant="h4" weight="semibold">
        {t('admin.vero.title')}
      </Text>
      <Text variant="caption" color="text.secondary">
        {t('admin.vero.hint')}
      </Text>

      <S.AddForm>
        <S.AddField>
          <Textarea
            value={draft}
            onChange={onDraftChange}
            placeholder={t('admin.vero.addPlaceholder')}
            aria-label={t('admin.vero.addPlaceholder')}
            fullWidth
            rows={4}
          />
        </S.AddField>
        <Button size="small" variant="secondary" onClick={onAdd} isLoading={isAdding} disabled={!draft.trim()}>
          <Text variant="body-sm" weight="semibold">
            {t('admin.vero.add')}
          </Text>
        </Button>
        {addResult && (
          <Text variant="caption" color="text.secondary">
            {addResult}
          </Text>
        )}
      </S.AddForm>

      <SearchField
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('admin.vero.searchPlaceholder')}
        aria-label={t('admin.vero.searchPlaceholder')}
      />
      <Text variant="caption" color="text.secondary" numeric>
        {t('admin.vero.total', { count: total })}
      </Text>

      {items.length > 0 ? (
        <S.ListPane>
          {items.map((row) => (
            <S.Row key={row.id}>
              <Text variant="body-sm">{row.keyword}</Text>
              <S.RowActions>
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={removingId === row.id}
                  onClick={() => onRemove(row.id)}
                >
                  <Text variant="body-sm">{t('admin.vero.remove')}</Text>
                </Button>
              </S.RowActions>
            </S.Row>
          ))}
        </S.ListPane>
      ) : (
        <Text variant="body-sm" color="text.secondary">
          {t(search ? 'admin.vero.noResults' : 'admin.vero.empty')}
        </Text>
      )}

      {pageCount > 1 && (
        <S.Pager>
          <Button size="small" variant="secondary" onClick={onPreviousPage} disabled={page <= 1}>
            <Text variant="body-sm">{t('admin.vero.previous')}</Text>
          </Button>
          <Text variant="caption" color="text.secondary" numeric>
            {t('admin.vero.page', { page, pageCount })}
          </Text>
          <Button size="small" variant="secondary" onClick={onNextPage} disabled={page >= pageCount}>
            <Text variant="body-sm">{t('admin.vero.next')}</Text>
          </Button>
        </S.Pager>
      )}
    </S.Section>
  );
};

VeroKeywordsPanelComponent.displayName = 'VeroKeywordsPanelComponent';
