import React, { useRef, useState } from 'react';

import { Checkbox } from '../../atoms/Checkbox';
import { Icon } from '../../atoms/Icon';
import { Select } from '../Select';

import * as S from './Table.style';
import type { TableProps } from './Table.types';
import { TablePagination } from './TablePagination.component';

export const Table = <T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage,
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
}: TableProps<T>): React.ReactElement => {
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

  const bulkOptions = React.useMemo(
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
    <S.TableContainer className={className}>
      {hasToolbar && (
        <S.Toolbar>
          <S.ToolbarSection>
            {bulkActions && bulkActions.length > 0 && (
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
          </S.ToolbarSection>
          <S.ToolbarSection>
            {actions}
            {onFilter && (
              <S.ToolbarButton onClick={onFilter}>
                <Icon name="filter-list" size={20} />
              </S.ToolbarButton>
            )}
            {onDownload && (
              <S.ToolbarButton onClick={onDownload}>
                <Icon name="download" size={20} />
              </S.ToolbarButton>
            )}
          </S.ToolbarSection>
        </S.Toolbar>
      )}
      <S.OverflowWrapper
        ref={overflowRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <S.StyledTable>
          <S.Thead>
            <S.Tr>
              {selectable && (
                <S.Th style={{ width: '3rem', paddingRight: 0 }} $sticky={columns.some((c) => c.sticky)} $left={0}>
                  <Checkbox checked={isAllSelected} onChange={handleSelectAll} />
                </S.Th>
              )}
              {columns.map((column) => (
                <S.Th
                  key={column.key}
                  $align={column.align}
                  $sticky={column.sticky}
                  $left={selectable ? 48 : 0}
                  style={{ width: column.width }}
                >
                  <S.ThContent $align={column.align}>
                    {column.header}
                    {column.sortable && (
                      <S.SortIconWrapper onClick={() => handleSort(column.key)}>
                        <Icon
                          name="chevron-down"
                          size={16}
                          style={{
                            transform:
                              sortColumn === column.key && sortDirection === 'desc'
                                ? 'rotate(0deg)'
                                : sortColumn === column.key && sortDirection === 'asc'
                                  ? 'rotate(180deg)'
                                  : 'rotate(0deg)',
                            opacity: sortColumn === column.key ? 1 : 0.3,
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                          }}
                        />
                      </S.SortIconWrapper>
                    )}
                  </S.ThContent>
                </S.Th>
              ))}
            </S.Tr>
          </S.Thead>
          <S.Tbody>
            {data.length === 0 ? (
              <S.EmptyRow>
                <S.EmptyCell colSpan={columns.length + (selectable ? 1 : 0)}>{emptyMessage}</S.EmptyCell>
              </S.EmptyRow>
            ) : (
              data.map((row, rowIndex) => {
                const isSelected = selectedRows.includes(row);
                return (
                  <S.Tr
                    key={rowIndex}
                    $clickable={!!onRowClick}
                    $selected={isSelected}
                    $index={rowIndex}
                    data-selected={isSelected}
                    onClick={() => handleRowClick(row, rowIndex)}
                  >
                    {selectable && (
                      <S.Td
                        style={{ width: '3rem', paddingRight: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        $sticky={columns.some((c) => c.sticky)}
                        $left={0}
                      >
                        <Checkbox checked={isSelected} onChange={(checked) => handleSelectRow(row, checked)} />
                      </S.Td>
                    )}
                    {columns.map((column) => (
                      <S.Td
                        key={column.key}
                        $align={column.align}
                        $sticky={column.sticky}
                        $left={selectable ? 48 : 0}
                        style={{ width: column.width }}
                      >
                        {column.render
                          ? column.render(row[column.key], row, rowIndex)
                          : (row[column.key] as React.ReactNode)}
                      </S.Td>
                    ))}
                  </S.Tr>
                );
              })
            )}
          </S.Tbody>
        </S.StyledTable>
      </S.OverflowWrapper>
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
      {footer && <S.StyledFooter>{footer}</S.StyledFooter>}
    </S.TableContainer>
  );
};

Table.displayName = 'Table';
