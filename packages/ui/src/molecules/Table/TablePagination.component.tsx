import React from 'react';

import { Icon } from '../../atoms/Icon';
import { Select } from '../Select';

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
  labelInfo,
  variant = 'footer',
}: TablePaginationProps): React.ReactElement => {
  const start = Math.min((page - 1) * rowsPerPage + 1, count);
  const end = Math.min(page * rowsPerPage, count);
  const rowsPerPageLabel = labelRowsPerPage;

  /*
   * The caller's current page size always appears in the list. A page defaulting
   * to a size outside `rowsPerPageOptions` (orders uses 20) otherwise matched no
   * option and the Select rendered blank.
   */
  const resolvedOptions = rowsPerPageOptions.includes(rowsPerPage)
    ? rowsPerPageOptions
    : [...rowsPerPageOptions, rowsPerPage].sort((a, b) => a - b);

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
  };

  const handleRowsPerPageChange = (value: string | number) => {
    onRowsPerPageChange(Number(value));
  };

  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));

  const renderLabelInfo = () => {
    if (!labelInfo) {return null;}

    return labelInfo
      .replace('{{from}}', start.toString())
      .replace('{{to}}', end.toString())
      .replace('{{total}}', count.toString());
  };

  return (
    <S.PaginationContainer className={className} $variant={variant}>
      <S.RowsPerPage>
        <S.PaginationLabel>{rowsPerPageLabel}</S.PaginationLabel>
        <S.SelectWrapper>
          <Select
            size="small"
            value={rowsPerPage.toString()}
            options={resolvedOptions.map((opt) => ({ value: opt.toString(), label: opt.toString() }))}
            onChange={(val: string | number) => handleRowsPerPageChange(val)}
            fullWidth
          />
        </S.SelectWrapper>
      </S.RowsPerPage>

      <S.NavigationWrapper>
        <S.PageInfo>
          <S.PaginationLabel>
            {count > 0
              ? renderLabelInfo()
              : labelInfo
                ? labelInfo.replace('{{from}}', '0').replace('{{to}}', '0').replace('{{total}}', '0')
                : null}
          </S.PaginationLabel>
        </S.PageInfo>

        <S.Navigation>
          <S.NavButton
            variant="ghost"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            type="button"
          >
            <Icon name="chevron-left" size={20} />
          </S.NavButton>
          <S.PageCounter>
            {page} / {totalPages}
          </S.PageCounter>
          <S.NavButton
            variant="ghost"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            type="button"
          >
            <Icon name="chevron-right" size={20} />
          </S.NavButton>
        </S.Navigation>
      </S.NavigationWrapper>
    </S.PaginationContainer>
  );
};

TablePagination.displayName = 'TablePagination';
