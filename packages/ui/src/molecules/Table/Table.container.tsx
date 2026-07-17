import { useMemo, useRef, useState } from 'react';

import { TableComponent } from './Table.component';
import type { TableProps } from './Table.types';

export const Table = <T,>(props: TableProps<T>) => {
  const {
    columns,
    data,
    emptyMessage,
    emptyContent,
    onRowClick,
    className,
    footer,
    sortColumn,
    sortDirection,
    onSort,
    selectable,
    selectedRows = [],
    onSelectionChange,
    bulkActions,
    bulkActionsPlaceholder,
    onFilter,
    onDownload,
    actions,
    pagination,
  } = props;

  const [bulkValue, setBulkValue] = useState<string | number>('');
  const overflowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragging, setWasDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleRowClick = (row: T, index: number) => {
    if (onRowClick && !wasDragging) {
      onRowClick(row, index);
    }
  };

  const handleSort = (columnKey: string) => {
    if (onSort) {
      onSort(columnKey);
    }
  };

  const isAllSelected = data.length > 0 && selectedRows.length === data.length;

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) {
      return;
    }
    if (checked) {
      onSelectionChange(data);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    if (!onSelectionChange) {
      return;
    }
    if (checked) {
      onSelectionChange([...selectedRows, row]);
    } else {
      onSelectionChange(selectedRows.filter((r) => r !== row));
    }
  };

  const hasToolbar = (bulkActions && bulkActions.length > 0) || onFilter || onDownload || actions;

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

  const handleBulkChange = (value: string | number) => {
    if (value === '__placeholder__') {
      return;
    }
    const actionIndex = parseInt(value as string, 10);
    if (!isNaN(actionIndex) && bulkActions?.[actionIndex]) {
      bulkActions[actionIndex].onClick(selectedRows);
    }
    setBulkValue('');
  };

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overflowRef.current) {
      return;
    }
    setIsDragging(true);
    setWasDragging(false);
    setStartX(e.pageX - overflowRef.current.offsetLeft);
    setScrollLeft(overflowRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !overflowRef.current) {
      return;
    }
    e.preventDefault();
    const x = e.pageX - overflowRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    overflowRef.current.scrollLeft = scrollLeft - walk;
    if (Math.abs(walk) > 5) {
      setWasDragging(true);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    setTimeout(() => setWasDragging(false), 0);
  };

  return (
    <TableComponent
      columns={columns}
      data={data}
      emptyMessage={emptyMessage}
      emptyContent={emptyContent}
      className={className}
      footer={footer}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      selectable={selectable}
      selectedRows={selectedRows}
      bulkActions={bulkActions}
      bulkActionsPlaceholder={bulkActionsPlaceholder}
      onFilter={onFilter}
      onDownload={onDownload}
      actions={actions}
      pagination={pagination}
      bulkValue={bulkValue}
      bulkOptions={bulkOptions}
      overflowRef={overflowRef}
      onRowClick={handleRowClick}
      onSort={handleSort}
      onSelectAll={handleSelectAll}
      onSelectRow={handleSelectRow}
      onBulkChange={handleBulkChange}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUpOrLeave={handleMouseUpOrLeave}
      isAllSelected={isAllSelected}
      hasToolbar={!!hasToolbar}
    />
  );
};

Table.displayName = 'Table';
