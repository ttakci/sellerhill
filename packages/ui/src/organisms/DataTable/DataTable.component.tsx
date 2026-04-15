import React, { useCallback, useMemo, useState } from 'react';

import { Icon } from '../../atoms/Icon';
import { IconButton } from '../../atoms/IconButton';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Select } from '../../molecules/Select';
import { Table } from '../../molecules/Table';
import { TablePagination } from '../../molecules/Table/TablePagination.component';
import { ViewToggle } from '../../molecules/ViewToggle/ViewToggle.component';
import type { ViewMode } from '../../molecules/ViewToggle/ViewToggle.types';

import { ColumnManager } from './ColumnManager';
import * as S from './DataTable.style';
import type { DataTableProps } from './DataTable.types';

export const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  renderGridCard,
  viewMode: controlledViewMode,
  defaultViewMode,
  onViewModeChange,
  hideViewToggle = false,
  selectable,
  selectedRows = [],
  onSelectionChange,
  bulkActions,
  bulkActionsPlaceholder,
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
  onRowClick,
  className,
}: DataTableProps<T>): React.ReactElement => {
  const isMobile = useIsMobile();
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>(defaultViewMode ?? (isMobile ? 'grid' : 'table'));

  const viewMode = controlledViewMode ?? internalViewMode;

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (!controlledViewMode) {
        setInternalViewMode(mode);
      }
      onViewModeChange?.(mode);
    },
    [controlledViewMode, onViewModeChange]
  );

  // Bulk actions state
  const [bulkValue, setBulkValue] = useState<string | number>('');

  const bulkOptions = useMemo(
    () => [
      { value: '__placeholder__', label: bulkActionsPlaceholder || 'Bulk Actions' },
      ...(bulkActions?.map((action, idx) => ({
        value: idx.toString(),
        label: action.label,
      })) || []),
    ],
    [bulkActions, bulkActionsPlaceholder]
  );

  const handleBulkChange = useCallback(
    (value: string | number) => {
      if (value === '__placeholder__') {
        return;
      }
      const actionIndex = parseInt(value as string, 10);
      if (!isNaN(actionIndex) && bulkActions?.[actionIndex]) {
        bulkActions[actionIndex].onClick(selectedRows);
      }
      setBulkValue('');
    },
    [bulkActions, selectedRows]
  );

  const hasBulkActions = bulkActions && bulkActions.length > 0 && data.length > 0;
  const showColumnManager = viewMode === 'table' && columnOptions && columnOptions.length > 0;
  const hasToolbar = hasBulkActions || !hideViewToggle || onDownload || actions || showColumnManager || toolbarLeft;

  return (
    <S.DataTableContainer className={className}>
      {hasToolbar && (
        <S.Toolbar>
          <S.ToolbarLeft>
            {!hideViewToggle && <ViewToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />}
            {hasBulkActions && (
              <S.BulkSelectWrapper>
                <Select
                  size="small"
                  value={bulkValue}
                  options={bulkOptions}
                  onChange={handleBulkChange}
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
          emptyMessage={emptyMessage}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          onRowClick={onRowClick}
        />
      ) : (
        <S.GridContainer>
          {data.length === 0 ? (
            <div
              style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', color: 'var(--text-tertiary)' }}
            >
              {emptyMessage || 'No data'}
            </div>
          ) : (
            data.map((item, index) => renderGridCard(item, index))
          )}
        </S.GridContainer>
      )}

      {pagination && (
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

DataTable.displayName = 'DataTable';
