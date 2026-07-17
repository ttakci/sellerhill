import React from 'react';

import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { Select } from '../../molecules/Select';
import { Table } from '../../molecules/Table';
import { TablePagination } from '../../molecules/Table/TablePagination.component';
import { ViewToggle } from '../../molecules/ViewToggle/ViewToggle.component';

import { ColumnManager } from './ColumnManager';
import * as S from './DataTable.style';
import type { DataTableComponentProps } from './DataTable.types';

export const DataTableComponent = <T,>({
  columns,
  data,
  renderGridCard,
  viewMode,
  onViewModeChange,
  hideViewToggle,
  selectable,
  selectedRows,
  onSelectionChange,
  bulkActions,
  bulkActionsPlaceholder,
  bulkValue,
  bulkOptions,
  onBulkChange,
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
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
  onRowClick,
  className,
}: DataTableComponentProps<T>): React.ReactElement => {
  const hasBulkActions = bulkActions && bulkActions.length > 0 && data.length > 0;
  const showColumnManager = viewMode === 'table' && columnOptions && columnOptions.length > 0;
  const hasToolbar = hasBulkActions || !hideViewToggle || onDownload || actions || showColumnManager || toolbarLeft;
  const isEmpty = data.length === 0;
  const resolvedEmpty = emptyContent ?? emptyMessage ?? 'No data';

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
            {showColumnManager && (
              <ColumnManager
                columnOptions={columnOptions}
                visibleColumnKeys={visibleColumnKeys || []}
                onToggleColumn={onToggleColumn || (() => {})}
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
        <Table
          columns={columns}
          data={data}
          selectable={selectable}
          selectedRows={selectedRows}
          onSelectionChange={onSelectionChange}
          emptyMessage={typeof resolvedEmpty === 'string' ? resolvedEmpty : undefined}
          emptyContent={typeof resolvedEmpty !== 'string' ? resolvedEmpty : undefined}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          onRowClick={onRowClick}
        />
      ) : (
        <S.GridContainer>
          {isEmpty ? (
            <S.GridEmptyState>{resolvedEmpty}</S.GridEmptyState>
          ) : (
            data.map((item, index) => renderGridCard(item, index))
          )}
        </S.GridContainer>
      )}

      {pagination && !isEmpty && (
        <TablePagination
          count={pagination.count}
          page={pagination.page}
          rowsPerPage={pagination.rowsPerPage}
          onPageChange={pagination.onPageChange}
          onRowsPerPageChange={pagination.onRowsPerPageChange}
          labelRowsPerPage={pagination.labelRowsPerPage}
          labelInfo={pagination.labelInfo}
        />
      )}
    </S.DataTableContainer>
  );
};

DataTableComponent.displayName = 'DataTableComponent';
