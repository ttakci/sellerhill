import React, { useCallback, useMemo, useState } from 'react';

import type { ViewMode } from '../../molecules/ViewToggle/ViewToggle.types';

import { DataTableComponent } from './DataTable.component';
import type { DataTableProps } from './DataTable.types';

export const DataTable = <T,>(props: DataTableProps<T>): React.ReactElement => {
  const {
    data,
    renderGridCard,
    gridMinItemWidth = '20rem',
    gridMaxColumns,
    viewMode: controlledViewMode,
    defaultViewMode,
    onViewModeChange,
    hideViewToggle = false,
    selectedRows = [],
    bulkActions,
    bulkActionsPlaceholder,
    loading = false,
    skeletonCount = 6,
  } = props;

  /* Cards are the default on every width (operator decision, 2026-10-01): a
     card carries the product photo and reads the way a seller thinks about a
     sale or a listing; the table stays one toggle away for scanning figures. */
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>(defaultViewMode ?? 'grid');

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

  return (
    <DataTableComponent
      columns={props.columns}
      data={data}
      renderGridCard={renderGridCard}
      gridMinItemWidth={gridMinItemWidth}
      gridMaxColumns={gridMaxColumns}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      hideViewToggle={hideViewToggle}
      selectable={props.selectable}
      selectedRows={selectedRows}
      onSelectionChange={props.onSelectionChange}
      isRowSelectable={props.isRowSelectable}
      bulkActions={bulkActions}
      bulkActionsPlaceholder={bulkActionsPlaceholder}
      bulkValue={bulkValue}
      bulkOptions={bulkOptions}
      onBulkChange={handleBulkChange}
      columnOptions={props.columnOptions}
      visibleColumnKeys={props.visibleColumnKeys}
      onToggleColumn={props.onToggleColumn}
      columnManagerLabel={props.columnManagerLabel}
      sortColumn={props.sortColumn}
      sortDirection={props.sortDirection}
      onSort={props.onSort}
      onDownload={props.onDownload}
      toolbarLeft={props.toolbarLeft}
      actions={props.actions}
      pagination={props.pagination}
      emptyMessage={props.emptyMessage}
      emptyContent={props.emptyContent}
      loading={loading}
      skeletonCount={skeletonCount}
      onRowClick={props.onRowClick}
      className={props.className}
    />
  );
};

DataTable.displayName = 'DataTable';
