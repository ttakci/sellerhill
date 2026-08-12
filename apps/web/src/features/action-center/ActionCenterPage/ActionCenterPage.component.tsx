/**
 * ActionCenterPage Component (Presentation)
 *
 * Renders the pending-action groups. Everything it shows is already resolved:
 * labels are localized and severities mapped by the container, so this file
 * makes no decisions — it only lays them out.
 */

import { Badge, EmptyState, Icon, PageHeader, SegmentedControl, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { severityToBadgeVariant, severityToIcon, severityToTone } from '../actionCenterPresentation';

import * as S from './ActionCenterPage.style';
import type { ActionCenterPageComponentProps } from './ActionCenterPage.types';

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
              {groups.map((group) => (
                <S.GroupCard
                  key={group.key}
                  variant="section"
                  header={{
                    title: group.title,
                    subtitle: group.subtitle,
                  }}
                >
                  <S.ItemStack>
                    {group.items.map((item) => {
                      const isClickable = Boolean(item.actionPath);
                      const rowContent = (
                        <>
                          <S.SeverityMark $tone={severityToTone(item.severity)}>
                            <Icon name={severityToIcon(item.severity)} size={20} />
                          </S.SeverityMark>

                          <S.ItemBody>
                            <S.ItemTitleRow>
                              <Text variant="body" weight="semibold" color="text.primary">
                                {item.title}
                              </Text>
                              <Badge variant={severityToBadgeVariant(item.severity)} size="xs" isPill>
                                {item.count}
                              </Badge>
                            </S.ItemTitleRow>

                            <Text variant="body-sm" color="text.secondary">
                              {item.description}
                            </Text>

                            {item.chips.length > 0 && (
                              <S.ChipRow>
                                {item.chips.map((chip) => (
                                  <Badge key={chip.code} variant="neutral" size="xs" isPill>
                                    {`${chip.label} · ${chip.count}`}
                                  </Badge>
                                ))}
                              </S.ChipRow>
                            )}
                          </S.ItemBody>

                          {isClickable && (
                            <S.ItemAction>
                              <Icon name="arrow-right" size={20} color="brand.primary" />
                            </S.ItemAction>
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
              ))}
            </S.GroupStack>
          )}
        </>
      )}
    </S.Container>
  );
};

ActionCenterPage.displayName = 'ActionCenterPage';
