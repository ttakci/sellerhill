import React from 'react';
import { Icon } from '../../atoms/Icon';
import * as S from './Table.style';
import type { TableProps } from './Table.types';

export const Table = <T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  footer,
  sortColumn,
  sortDirection,
  onSort,
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

  return (
    <S.TableContainer className={className}>
      <S.StyledTable>
        <S.Thead>
          <S.Tr>
            {columns.map((column) => (
              <S.Th
                key={column.key}
                $align={column.align}
                $sortable={column.sortable}
                onClick={column.sortable ? () => handleSort(column.key) : undefined}
              >
                <S.ThContent $align={column.align}>
                  {column.header}
                  {column.sortable && sortColumn === column.key && (
                    <S.SortIconWrapper>
                      <Icon // This assumes Icon is imported or I need to import it. Wait, Icon IS imported in Table??? No. I need to check imports.
                        name="chevron-down" // Using chevron-down. 
                        size={12}
                        style={{
                          transform: sortDirection === 'asc' ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
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
              <S.EmptyCell colSpan={columns.length}>{emptyMessage}</S.EmptyCell>
            </S.EmptyRow>
          ) : (
            data.map((row, rowIndex) => (
              <S.Tr
                key={rowIndex}
                $clickable={!!onRowClick}
                onClick={() => handleRowClick(row, rowIndex)}
              >
                {columns.map((column) => (
                  <S.Td key={column.key} $align={column.align}>
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : (row[column.key] as React.ReactNode)}
                  </S.Td>
                ))}
              </S.Tr>
            ))
          )}
        </S.Tbody>
      </S.StyledTable>
      {footer && <S.StyledFooter>{footer}</S.StyledFooter>}
    </S.TableContainer>
  );
};

Table.displayName = 'Table';
