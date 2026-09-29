/**
 * ConversationList (Presentation)
 * Select-all / bulk bar and the conversation rows. Stateless: selection,
 * formatting and every handler come from the Messages page container.
 */

import { Badge, Button, Checkbox, EmptyState, Icon, IdBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ConversationList.style';
import type { ConversationListProps } from './ConversationList.types';

export const ConversationList = ({
  rows,
  isLoading,
  emptyTitle,
  onOpen,
  onToggle,
  allSelected,
  onToggleAll,
  selectedCount,
  bulkActions,
}: ConversationListProps): React.ReactElement => {
  const { t } = useTranslation(['messages', 'translation']);

  if (isLoading || rows.length === 0) {
    return (
      <S.StateSlot>
        <EmptyState
          size="sm"
          icon="inbox"
          title={isLoading ? t('messages.list.loading') : emptyTitle}
          description=""
        />
      </S.StateSlot>
    );
  }

  return (
    <S.Wrapper>
      <S.ListHeader>
        <Checkbox
          checked={allSelected}
          onChange={onToggleAll}
          label={selectedCount > 0 ? t('messages.actions.selected', { count: selectedCount }) : t('messages.list.selectAll')}
        />
        {selectedCount > 0 && (
          <S.BulkActions>
            {bulkActions.map((action) => (
              <Button key={action.id} variant="tertiary" size="xsmall" onClick={action.onClick}>
                <Icon name={action.icon} size={14} />
                <Text variant="body-sm" color="inherit">
                  {action.label}
                </Text>
              </Button>
            ))}
          </S.BulkActions>
        )}
      </S.ListHeader>

      <S.Rows>
        {rows.map((row) => (
          <S.Row key={row.id} $active={row.isActive}>
            <S.RowCheck>
              <Checkbox
                checked={row.isSelected}
                onChange={(checked) => onToggle(row.id, checked)}
                aria-label={t('messages.list.select')}
              />
            </S.RowCheck>
            <S.Avatar $unread={row.unreadCount > 0} aria-hidden>
              <Text variant="body-sm" weight="semibold" color={row.unreadCount > 0 ? 'text.inverse' : 'brand.primary'}>
                {row.avatarLabel}
              </Text>
            </S.Avatar>
            <S.RowMain>
              <S.RowButton type="button" onClick={() => onOpen(row.id)} aria-current={row.isActive || undefined}>
                <S.RowLine>
                  <Text variant="body" weight={row.unreadCount > 0 ? 'semibold' : 'medium'} truncate>
                    {row.otherParty}
                  </Text>
                  <Text variant="caption" color="text.tertiary" numeric>
                    {row.date}
                  </Text>
                </S.RowLine>
                {row.title && (
                  <S.RowLine>
                    <Text variant="body-sm" weight={row.unreadCount > 0 ? 'semibold' : 'regular'} truncate>
                      {row.title}
                    </Text>
                    {row.unreadCount > 0 && (
                      <Badge variant="primary" size="xs" isPill>
                        {row.unreadCount}
                      </Badge>
                    )}
                  </S.RowLine>
                )}
                <S.RowLine>
                  <Text variant="body-sm" color="text.secondary" truncate>
                    {row.snippet}
                  </Text>
                  {!row.title && row.unreadCount > 0 && (
                    <Badge variant="primary" size="xs" isPill>
                      {row.unreadCount}
                    </Badge>
                  )}
                </S.RowLine>
              </S.RowButton>
              {row.referenceId && (
                <S.RowMeta>
                  <IdBadge id={row.referenceId} storeType="ebay" size="sm" />
                </S.RowMeta>
              )}
            </S.RowMain>
          </S.Row>
        ))}
      </S.Rows>
    </S.Wrapper>
  );
};

ConversationList.displayName = 'ConversationList';
