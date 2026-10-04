import React from 'react';

import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Skeleton } from '../../atoms/Skeleton';
import { Select } from '../../molecules/Select';
import { Table } from '../../molecules/Table';
import { TablePagination } from '../../molecules/Table/TablePagination.component';
import { ViewToggle } from '../../molecules/ViewToggle/ViewToggle.component';

import { ColumnManager } from './ColumnManager';
import * as S from './DataTable.style';
import type { DataTableComponentProps } from './DataTable.types';

/** Stat cells in a skeleton card's footer strip. */
const SKELETON_STAT_COUNT = 4;

export const DataTableComponent = <T,>({
  columns,
  data,
  renderGridCard,
  gridMinItemWidth,
  gridMaxColumns,
  viewMode,
  onViewModeChange,
  hideViewToggle,
  selectable,
  selectedRows,
  onSelectionChange,
  isRowSelectable,
  bulkActions,
  bulkActionsPlaceholder,
  bulkValue,
  bulkOptions,
  onBulkChange,
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  onMoveColumn,
  resultLabel,
  sortOptions,
  sortValue,
  onSortChange,
  sortLabel,
  columnManagerLabel,
  sortColumn,
  sortDirection,
  onSort,
  onDownload,
  toolbarLeft,
  actions,
  pagination,
  emptyMessage,
  emptyContent,
  loading,
  skeletonCount,
  onRowClick,
  className,
}: DataTableComponentProps<T>): React.ReactElement => {
  const hasBulkActions = bulkActions && bulkActions.length > 0 && data.length > 0;
  const showColumnManager = viewMode === 'table' && columnOptions && columnOptions.length > 0;
  const hasSort = Boolean(sortOptions && sortOptions.length > 0 && onSortChange);
  const hasToolbar =
    hasSort ||
    Boolean(resultLabel) ||
    hasBulkActions || !hideViewToggle || onDownload || actions || showColumnManager || toolbarLeft;
  const isEmpty = data.length === 0;
  const resolvedEmpty = emptyContent ?? emptyMessage ?? 'No data';
  // Skeleton only when there is genuinely nothing to show yet — a background
  // refetch that still has previous rows/cards keeps showing them, never a flash.
  const showSkeleton = loading && isEmpty;
  const skeletonRows = Array.from({ length: skeletonCount });
  const skeletonColumnCount = Math.max(1, Math.min(columns.length, 6));

  return (
    <S.DataTableContainer className={className}>
      {hasToolbar && (
        <S.Toolbar>
          <S.ToolbarLeft>
            {!hideViewToggle && <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />}
            {hasBulkActions && (
              <S.BulkSelectWrapper>
                <Select
                  size="small"
                  value={bulkValue}
                  options={bulkOptions}
                  onChange={onBulkChange}
                  placeholder={bulkActionsPlaceholder || 'Bulk Actions'}
                  fullWidth={false}
                />
              </S.BulkSelectWrapper>
            )}
            {toolbarLeft}
          </S.ToolbarLeft>
          <S.ToolbarRight>
            {resultLabel && (
              <S.ResultSummary variant="body-sm" weight="medium" color="text.secondary">
                {resultLabel}
              </S.ResultSummary>
            )}
            {hasSort && (
              <S.SortWrapper>
                <Select
                  size="small"
                  trailingIcon="filter-list"
                  valuePrefix={sortLabel}
                  value={sortValue}
                  options={sortOptions ?? []}
                  onChange={onSortChange}
                  fullWidth
                />
              </S.SortWrapper>
            )}
            {showColumnManager && (
              <ColumnManager
                columnOptions={columnOptions}
                visibleColumnKeys={visibleColumnKeys || []}
                onToggleColumn={onToggleColumn || (() => {})}
                onMoveColumn={onMoveColumn}
                label={columnManagerLabel}
              />
            )}
            {onDownload && (
              <IconButton variant="ghost" onClick={onDownload} title="Export">
                <Icon name="download" size={20} />
              </IconButton>
            )}
            {actions}
          </S.ToolbarRight>
        </S.Toolbar>
      )}

      {viewMode === 'table' ? (
        showSkeleton ? (
          <S.SkeletonTableCard>
            {skeletonRows.map((_, rowIndex) => (
              <S.SkeletonRow key={rowIndex}>
                <Skeleton width="2.25rem" height="2.25rem" radius="md" />
                <Skeleton width="30%" height="0.875rem" />
                {Array.from({ length: skeletonColumnCount - 1 }).map((__, cellIndex) => (
                  <Skeleton key={cellIndex} width="4rem" height="0.875rem" />
                ))}
              </S.SkeletonRow>
            ))}
          </S.SkeletonTableCard>
        ) : (
          <Table
            columns={columns}
            data={data}
            selectable={selectable}
            selectedRows={selectedRows}
            onSelectionChange={onSelectionChange}
            isRowSelectable={isRowSelectable}
            emptyMessage={typeof resolvedEmpty === 'string' ? resolvedEmpty : undefined}
            emptyContent={typeof resolvedEmpty !== 'string' ? resolvedEmpty : undefined}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
            onRowClick={onRowClick}
          />
        )
      ) : (
        <S.GridContainer $minItemWidth={gridMinItemWidth} $maxColumns={gridMaxColumns}>
          {showSkeleton ? (
            skeletonRows.map((_, cardIndex) => (
              <S.SkeletonGridCard key={cardIndex} aria-hidden="true">
                <S.SkeletonGridCardHeader>
                  <Skeleton width="60%" height="1rem" />
                </S.SkeletonGridCardHeader>
                <S.SkeletonGridCardMain>
                  <Skeleton width="5.5rem" height="5.5rem" radius="md" />
                  <S.SkeletonGridCardBody>
                    <Skeleton width="70%" height="0.875rem" />
                    <Skeleton width="50%" height="0.75rem" />
                    <Skeleton width="60%" height="0.75rem" />
                  </S.SkeletonGridCardBody>
                </S.SkeletonGridCardMain>
                <S.SkeletonGridCardFooter>
                  {Array.from({ length: SKELETON_STAT_COUNT }).map((__, statIndex) => (
                    <S.SkeletonGridCardStat key={statIndex}>
                      <Skeleton width="60%" height="0.625rem" />
                      <Skeleton width="80%" height="0.875rem" />
                    </S.SkeletonGridCardStat>
                  ))}
                </S.SkeletonGridCardFooter>
              </S.SkeletonGridCard>
            ))
          ) : isEmpty ? (
            <S.GridEmptyState>{resolvedEmpty}</S.GridEmptyState>
          ) : (
            data.map((item, index) => renderGridCard(item, index))
          )}
        </S.GridContainer>
      )}

      {pagination && !isEmpty && (
        <S.PaginationSlot>
          {/*
            Detached: here the pagination is a sibling of the table card / card
            grid, not a footer inside the table's surface, so it carries its own
            border and radius instead of a bare divider.
          */}
          <TablePagination
            variant="detached"
            count={pagination.count}
            page={pagination.page}
            rowsPerPage={pagination.rowsPerPage}
            onPageChange={pagination.onPageChange}
            onRowsPerPageChange={pagination.onRowsPerPageChange}
            labelRowsPerPage={pagination.labelRowsPerPage}
            labelInfo={pagination.labelInfo}
          />
        </S.PaginationSlot>
      )}
    </S.DataTableContainer>
  );
};

DataTableComponent.displayName = 'DataTableComponent';
