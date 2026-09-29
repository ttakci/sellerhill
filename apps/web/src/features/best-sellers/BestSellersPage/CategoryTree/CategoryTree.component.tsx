/**
 * CategoryTree Component (Presentation)
 *
 * A two-level, cascading category picker: departments at the root, each with
 * a chevron that reveals its own sub-categories underneath it. Rendered both
 * as the persistent desktop sidebar and inside the mobile Drawer — every
 * decision (which rows exist, which are open, which is active) is already
 * made by the container, so this file only lays the rows out.
 */
import { Icon, SearchField, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CategoryTree.style';
import type { CategoryTreeComponentProps } from './CategoryTree.types';

export const CategoryTree: React.FC<CategoryTreeComponentProps> = ({
  rows,
  searchValue,
  onSearchChange,
  onSelect,
  onToggleExpand,
  hasDepartments,
  className,
}) => {
  const { t } = useTranslation(['bestSellers']);

  return (
    <S.Wrapper className={className}>
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        placeholder={t('bestSellers.categorySearchPlaceholder')}
        aria-label={t('bestSellers.categorySearchPlaceholder')}
        size="small"
        fullWidth
      />

      <S.List role="tree" aria-label={t('bestSellers.categories.title')}>
        {rows.map((row) => (
          <S.Row
            key={row.key}
            role="treeitem"
            tabIndex={0}
            aria-selected={row.isActive}
            aria-expanded={row.hasChildren ? row.isExpanded : undefined}
            $depth={row.depth}
            $active={row.isActive}
            onClick={() => onSelect(row.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(row.path);
              }
            }}
          >
            {row.hasChildren ? (
              <S.ChevronSlot
                type="button"
                $isOpen={row.isExpanded}
                aria-label={
                  row.isExpanded
                    ? t('bestSellers.categories.collapse', { name: row.name })
                    : t('bestSellers.categories.expand', { name: row.name })
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleExpand(row.path);
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Icon name="chevron-right" size={14} />
              </S.ChevronSlot>
            ) : row.depth === 0 ? (
              <S.ChevronPlaceholder aria-hidden="true" />
            ) : null}

            <S.RowLabel>
              <Text
                variant="body-sm"
                weight={row.isActive ? 'semibold' : 'regular'}
                color={row.isActive ? 'brand.primary' : 'text.primary'}
                truncate
              >
                {row.name}
              </Text>
            </S.RowLabel>
          </S.Row>
        ))}

        {rows.length === 0 && (
          <S.EmptyHint>
            <Text variant="caption" color="text.tertiary">
              {hasDepartments ? t('bestSellers.categoryNoResults') : t('bestSellers.states.loading.title')}
            </Text>
          </S.EmptyHint>
        )}
      </S.List>
    </S.Wrapper>
  );
};

CategoryTree.displayName = 'CategoryTree';
