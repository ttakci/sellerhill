/**
 * ActionCenterPage Component (Presentation)
 *
 * Renders the pending-action groups. Everything it shows is already resolved:
 * labels are localized and severities mapped by the container, so this file
 * makes no decisions — it only lays them out.
 */

import { EmptyState, Icon, PageHeader, SegmentedControl, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { groupToIcon, severityToBadgeVariant } from '../actionCenterPresentation';

import * as S from './ActionCenterPage.style';
import type { ActionCenterGroupView, ActionCenterPageComponentProps } from './ActionCenterPage.types';

export const ActionCenterPage: React.FC<ActionCenterPageComponentProps> = ({
  groups,
  filter,
  onFilterChange,
  filterOptions,
  isInitialLoading,
  isEmpty,
  onItemAction,
}) => {
  const { t } = useTranslation(['actionCenter', 'translation']);

  // Two independent columns (see GroupStack/GroupColumn) — even-indexed
  // groups left, odd-indexed groups right — so a tall card in one column
  // never pushes the other column's cards down. Plain array filters, not a
  // hook: cheap for the handful of groups this page ever renders.
  const leftGroups = groups.filter((_, index) => index % 2 === 0);
  const rightGroups = groups.filter((_, index) => index % 2 === 1);

  const renderGroup = (group: ActionCenterGroupView) => (
    <S.GroupCard
      key={group.key}
      variant="section"
      header={{
        icon: groupToIcon(group.key),
        title: group.title,
        subtitle: group.subtitle,
      }}
    >
      <S.ItemStack>
        {group.items.map((item) => {
          const isClickable = Boolean(item.actionPath);
          const rowContent = (
            <>
              <S.ItemBody>
                <S.ItemTitleRow>
                  <S.ItemTitle variant="body" weight="semibold" color="text.primary">
                    {item.title}
                  </S.ItemTitle>
                  <S.CountBadge variant={severityToBadgeVariant(item.severity)} size="xs" isPill>
                    {item.count}
                  </S.CountBadge>
                </S.ItemTitleRow>

                <Text variant="body-sm" color="text.secondary">
                  {item.description}
                </Text>

                {item.chips.length > 0 && (
                  <S.ChipList>
                    {item.chips.map((chip) => (
                      <S.ChipListItem key={chip.code}>
                        <S.ChipDot />
                        <S.ChipLabel variant="body-sm" color="text.secondary">
                          {chip.label}
                        </S.ChipLabel>
                        <S.ChipCount variant="neutral" size="xs" isPill>
                          {chip.count}
                        </S.ChipCount>
                      </S.ChipListItem>
                    ))}
                  </S.ChipList>
                )}
              </S.ItemBody>

              {/*
                "Detay ->" bottom-right, same affordance as
                ListingCard/OrderCard/JobsPage — not a vertically
                centered bare arrow, so a multi-line row (long
                description + a chip list) doesn't strand the
                arrow floating beside the middle of the text.
              */}
              {isClickable && (
                <S.ItemFooter>
                  <S.ItemAction>
                    <Text variant="body-sm" weight="semibold" color="brand.primary">
                      {t('translation:common.details')}
                    </Text>
                    <Icon name="arrow-right" size={14} color="brand.primary" />
                  </S.ItemAction>
                </S.ItemFooter>
              )}
            </>
          );

          return isClickable ? (
            <S.ItemRowButton key={item.key} type="button" onClick={() => onItemAction(item)}>
              {rowContent}
            </S.ItemRowButton>
          ) : (
            <S.ItemRow key={item.key}>{rowContent}</S.ItemRow>
          );
        })}
      </S.ItemStack>
    </S.GroupCard>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('actionCenter.title')}
        subtitle={t('actionCenter.subtitle')}
      />

      {/*
        The initial fetch renders this page's own state card, never the global
        loading overlay — and it uses the SAME component as the empty state so
        the two do not look like different screens.
      */}
      {isInitialLoading ? (
        <S.StateCard padding="lg">
          <EmptyState
            icon="loader"
            title={t('actionCenter.loading.title')}
            description={t('actionCenter.loading.description')}
          />
        </S.StateCard>
      ) : isEmpty ? (
        <S.StateCard padding="lg">
          <EmptyState
            icon="check-circle"
            title={t('actionCenter.empty.title')}
            description={t('actionCenter.empty.description')}
          />
        </S.StateCard>
      ) : (
        <>
          <S.Toolbar>
            <SegmentedControl options={filterOptions} value={filter} onChange={onFilterChange} />
          </S.Toolbar>

          {groups.length === 0 ? (
            <S.StateCard padding="lg">
              <EmptyState
                icon="filter"
                title={t('actionCenter.emptyFiltered.title')}
                description={t('actionCenter.emptyFiltered.description')}
              />
            </S.StateCard>
          ) : (
            <S.GroupStack>
              <S.GroupColumn>{leftGroups.map(renderGroup)}</S.GroupColumn>
              {rightGroups.length > 0 && <S.GroupColumn>{rightGroups.map(renderGroup)}</S.GroupColumn>}
            </S.GroupStack>
          )}
        </>
      )}
    </S.Container>
  );
};

ActionCenterPage.displayName = 'ActionCenterPage';
