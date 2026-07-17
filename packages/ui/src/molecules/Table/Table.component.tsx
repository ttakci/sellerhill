import type React from 'react';

import { Checkbox } from '../../atoms/Checkbox';
import { Icon } from '../../atoms/Icon';
import { Select } from '../Select';

import * as S from './Table.style';
import type { TableComponentProps } from './Table.types';
import { TablePagination } from './TablePagination.component';

export const TableComponent = <T,>({
  columns,
  data,
  emptyMessage,
  emptyContent,
  className,
  footer,
  sortColumn,
  sortDirection,
  selectable,
  selectedRows = [],
  bulkActions,
  bulkActionsPlaceholder,
  onFilter,
  onDownload,
  actions,
  pagination,
  bulkValue,
  bulkOptions,
  overflowRef,
  onRowClick,
  onSort,
  onSelectAll,
  onSelectRow,
  onBulkChange,
  onMouseDown,
  onMouseMove,
  onMouseUpOrLeave,
  isAllSelected,
  hasToolbar,
}: TableComponentProps<T>): React.ReactElement => {
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
                  onChange={onBulkChange}
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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
      >
        <S.StyledTable>
          <colgroup>
            {selectable ? <S.ColSelection /> : null}
            {columns.map((column) => (
              <S.ColAuto key={`col-${column.key}`} $width={column.width} />
            ))}
          </colgroup>
          <S.Thead>
            <S.Tr>
              {selectable && (
                <S.Th $selection $sticky={columns.some((c) => c.sticky)} $left={0}>
                  <S.CheckboxCell>
                    <Checkbox checked={isAllSelected} onChange={onSelectAll} />
                  </S.CheckboxCell>
                </S.Th>
              )}
              {columns.map((column) => (
                <S.Th
                  key={column.key}
                  $align={column.align}
                  $sticky={column.sticky}
                  $left={selectable ? 52 : 0}
                  $width={column.width}
                >
                  <S.ThContent $align={column.align}>
                    {column.header}
                    {column.sortable && (
                      <S.SortIconWrapper onClick={() => onSort(column.key)}>
                        <S.SortIcon
                          $active={sortColumn === column.key}
                          $rotated={sortColumn === column.key && sortDirection === 'asc'}
                        >
                          <Icon name="chevron-down" size={16} />
                        </S.SortIcon>
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
                <S.EmptyCell colSpan={columns.length + (selectable ? 1 : 0)}>
                  {emptyContent ?? emptyMessage}
                </S.EmptyCell>
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
                    onClick={() => onRowClick(row, rowIndex)}
                  >
                    {selectable && (
                      <S.Td
                        $selection
                        onClick={(e) => e.stopPropagation()}
                        $sticky={columns.some((c) => c.sticky)}
                        $left={0}
                      >
                        <S.CheckboxCell>
                          <Checkbox checked={isSelected} onChange={(checked) => onSelectRow(row, checked)} />
                        </S.CheckboxCell>
                      </S.Td>
                    )}
                    {columns.map((column) => (
                      <S.Td
                        key={column.key}
                        $align={column.align}
                        $sticky={column.sticky}
                        $left={selectable ? 52 : 0}
                        $width={column.width}
                      >
                        {column.render
                          ? column.render((row as Record<string, unknown>)[column.key], row, rowIndex)
                          : ((row as Record<string, unknown>)[column.key] as React.ReactNode)}
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

TableComponent.displayName = 'TableComponent';
