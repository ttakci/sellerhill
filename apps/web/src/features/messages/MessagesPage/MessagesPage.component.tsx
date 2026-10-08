/**
 * MessagesPage (Presentation)
 * Header, store filter, then either the reconnect prompt (store connected
 * before messaging existed) or the three-pane inbox: folder rail,
 * conversation list, thread.
 */

import {
  Badge,
  EmptyState,
  Icon,
  PageHeader,
  SegmentedControl,
  TabNav,
  TablePagination,
  Text,
} from '@repo/ui';
import React from 'react';

import { ConversationList } from '../components/ConversationList';
import { ConversationThread } from '../components/ConversationThread';

import * as S from './MessagesPage.style';
import type { MessagesPageComponentProps } from './MessagesPage.types';

export const MessagesPageComponent = ({
  title,
  subtitle,
  onBack,
  backLabel,
  showToolbar,
  messagingEnabled,
  onReconnect,
  isReconnecting,
  reconnectTitle,
  reconnectDescription,
  reconnectAction,
  folderGroups,
  compactFilters,
  threadOpen,
  listProps,
  pagination,
  threadProps,
}: MessagesPageComponentProps): React.ReactElement => (
  <S.Container>
    <PageHeader
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      backAriaLabel={backLabel}
      backMobileOnly
    />

    {/* Below `xl` the rail is hidden, so its stand-in sits in a row of its own;
        at `xl` and above the row renders nothing and is hidden outright, so the
        inbox starts right under the title (the store switcher lives in the
        header's actions slot). */}
    {showToolbar && messagingEnabled && (
      <S.Toolbar>
        {messagingEnabled && (
          <S.CompactFilters>
            <TabNav
              variant="pill"
              items={compactFilters.typeItems}
              value={compactFilters.typeValue}
              onChange={compactFilters.onTypeChange}
            />
            <SegmentedControl
              size="sm"
              options={compactFilters.folderOptions}
              value={compactFilters.folderValue}
              onChange={compactFilters.onFolderChange}
            />
          </S.CompactFilters>
        )}
      </S.Toolbar>
    )}

    {!messagingEnabled ? (
      <S.StateCard padding="lg">
        <EmptyState
          icon="mail"
          title={reconnectTitle}
          description={reconnectDescription}
          actionIcon="refresh"
          action={reconnectAction}
          onAction={onReconnect}
          isActionLoading={isReconnecting}
        />
      </S.StateCard>
    ) : (
      <S.Shell $threadOpen={threadOpen}>
        <S.RailPane data-pane="rail">
          {folderGroups.map((group) => (
            <S.RailGroup key={group.key} aria-label={group.label || undefined}>
              {!!group.label && (
                <S.RailGroupLabel>
                  <S.RailGroupDot $tone="brand" aria-hidden />
                  <Text variant="overline" color="text.tertiary">
                    {group.label}
                  </Text>
                </S.RailGroupLabel>
              )}
              {group.items.map((item) => {
                const isEbayItem = item.key.includes('FROM_EBAY');
                const tone: 'brand' | 'amber' = isEbayItem ? 'amber' : 'brand';
                return (
                <S.RailItem
                  key={item.key}
                  type="button"
                  $active={item.isActive}
                  $tone={tone}
                  aria-current={item.isActive || undefined}
                  onClick={item.onSelect}
                >
                  <Icon name={item.icon} size={16} color={item.isActive ? (tone === 'amber' ? 'semantic.warning' : 'brand.primary') : 'text.secondary'} />
                  <S.RailItemLabel>
                    <Text variant="body-sm" weight={item.isActive ? 'semibold' : 'medium'} color="inherit">
                      {item.label}
                    </Text>
                  </S.RailItemLabel>
                  {!!item.count && (
                    <Badge variant="solidNavy" size="xs">
                      {item.count}
                    </Badge>
                  )}
                </S.RailItem>
                );
              })}
            </S.RailGroup>
          ))}
        </S.RailPane>

        <S.ListColumn data-pane="list">
          <S.ListScroll>
            <ConversationList {...listProps} />
          </S.ListScroll>
          {pagination && (
            <TablePagination
              variant="footer"
              compact
              count={pagination.count}
              page={pagination.page}
              rowsPerPage={pagination.rowsPerPage}
              rowsPerPageOptions={pagination.rowsPerPageOptions}
              onPageChange={pagination.onPageChange}
              onRowsPerPageChange={pagination.onRowsPerPageChange}
              labelRowsPerPage={pagination.labelRowsPerPage}
              labelInfo={pagination.labelInfo}
            />
          )}
        </S.ListColumn>

        <S.ThreadPane data-pane="thread">
          <ConversationThread {...threadProps} />
        </S.ThreadPane>
      </S.Shell>
    )}
  </S.Container>
);
