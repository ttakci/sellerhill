import React from 'react';
import { Checkbox } from '../../atoms/Checkbox';
import { Icon } from '../../atoms/Icon';
import * as S from './Table.style';
import type { TableProps } from './Table.types';
import { TablePagination } from './TablePagination.component';

export const Table = <T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No data available',
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
  bulkActionsPlaceholder = 'Bulk Actions',
  onFilter,
  onDownload,
  actions,
  pagination,
}: TableProps<T>): React.ReactElement => {
  const handleRowClick = (row: T, index: number) => {
    if (onRowClick) {
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
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(data);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedRows, row]);
    } else {
      onSelectionChange(selectedRows.filter((r) => r !== row));
    }
  };

  const hasToolbar = (bulkActions && bulkActions.length > 0) || onFilter || onDownload || actions;

  const handleBulkAction = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const actionIndex = parseInt(event.target.value, 10);
    if (!isNaN(actionIndex) && bulkActions?.[actionIndex]) {
      bulkActions[actionIndex].onClick(selectedRows);
    }
    event.target.value = 'default';
  };

  return (
    <S.TableContainer className={className}>
      {hasToolbar && (
        <S.Toolbar>
          <S.ToolbarSection>
            {bulkActions && bulkActions.length > 0 && (
              <S.BulkSelectWrapper>
                <S.BulkSelect onChange={handleBulkAction} defaultValue="default">
                  <option value="default" disabled>
                    {bulkActionsPlaceholder}
                  </option>
                  {bulkActions.map((action, index) => (
                    <option key={index} value={index}>
                      {action.label}
                    </option>
                  ))}
                </S.BulkSelect>
                <S.BulkSelectIcon>
                  <Icon name="expand-more" size={18} />
                </S.BulkSelectIcon>
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
      <S.OverflowWrapper>
        <S.StyledTable>
          <S.Thead>
            <S.Tr>
              {selectable && (
                <S.Th style={{ width: '48px', paddingRight: 0 }} $sticky={columns.some((c) => c.sticky)} $left={0}>
                  <Checkbox checked={isAllSelected} onChange={handleSelectAll} />
                </S.Th>
              )}
              {columns.map((column) => (
                <S.Th
                  key={column.key}
                  $align={column.align}
                  $sortable={column.sortable}
                  $sticky={column.sticky}
                  $left={selectable ? 48 : 0}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                  style={{ width: column.width }}
                >
                  <S.ThContent $align={column.align}>
                    {column.header}
                    {column.sortable && (
                      <S.SortIconWrapper>
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
                    onClick={() => handleRowClick(row, rowIndex)}
                  >
                    {selectable && (
                      <S.Td
                        style={{ width: '48px', paddingRight: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        $sticky={columns.some((c) => c.sticky)}
                        $left={0}
                      >
                        <Checkbox checked={isSelected} onChange={(checked) => handleSelectRow(row, checked)} />
                      </S.Td>
                    )}
                    {columns.map((column) => (
                      <S.Td key={column.key} $align={column.align} $sticky={column.sticky} $left={selectable ? 48 : 0}>
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
        />
      )}
      {footer && <S.StyledFooter>{footer}</S.StyledFooter>}
    </S.TableContainer>
  );
};

Table.displayName = 'Table';
