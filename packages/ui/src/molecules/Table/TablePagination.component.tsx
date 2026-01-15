import React from 'react';
import { Icon } from '../../atoms/Icon';
import { Select } from '../../atoms/Select';
import * as S from './TablePagination.style';
import type { TablePaginationProps } from './TablePagination.types';

export const TablePagination = ({
  count,
  page,
  rowsPerPage,
  rowsPerPageOptions = [10, 25, 50, 100],
  onPageChange,
  onRowsPerPageChange,
  className,
  labelRowsPerPage,
}: TablePaginationProps): React.ReactElement => {
  const start = Math.min((page - 1) * rowsPerPage + 1, count);
  const end = Math.min(page * rowsPerPage, count);
  const rowsPerPageLabel = labelRowsPerPage || 'Rows per page:';

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
  };

  const handleRowsPerPageChange = (value: string | number) => {
    onRowsPerPageChange(Number(value));
  };

  const selectOptions = rowsPerPageOptions.map((opt) => ({
    value: opt,
    label: opt.toString(),
  }));

  const totalPages = Math.ceil(count / rowsPerPage);

  return (
    <S.PaginationContainer className={className}>
      <S.RowsPerPage>
        <S.PaginationLabel variant="caption" weight="semibold">
          {rowsPerPageLabel}
        </S.PaginationLabel>
        <S.SelectWrapper>
          <Select
            value={rowsPerPage.toString()}
            options={rowsPerPageOptions.map(opt => ({ value: opt.toString(), label: opt.toString() }))}
            onChange={(val) => handleRowsPerPageChange(val)}
            fullWidth={false}
          />
        </S.SelectWrapper>
      </S.RowsPerPage>

      <div style={{ flex: 1 }} />

      <S.PageInfo>
        <S.PaginationLabel variant="caption" weight="semibold">
          {count > 0 ? `${start}-${end} of ${count}` : '0 of 0'}
        </S.PaginationLabel>
      </S.PageInfo>

      <S.Navigation>
        <S.NavButton
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
          type="button"
        >
          <Icon name="chevron-left" size={16} />
        </S.NavButton>
        <S.NavButton
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          type="button"
        >
          <Icon name="chevron-right" size={16} />
        </S.NavButton>
      </S.Navigation>
    </S.PaginationContainer>
  );
};

TablePagination.displayName = 'TablePagination';
