import { describe, expect, it } from 'vitest';

import { buildCsv, fetchAllPages } from './csv';

describe('buildCsv', () => {
  it('quotes every cell, doubles quotes and joins rows with CRLF', () => {
    expect(
      buildCsv(
        ['A', 'B'],
        [
          ['x "y"', 3],
          [null, undefined],
        ]
      )
    ).toBe('"A","B"\r\n"x ""y""","3"\r\n"",""');
  });

  it('neutralises cells a spreadsheet would run as a formula', () => {
    expect(buildCsv(['C'], [['=SUM(A1)'], ['+1'], ['@cmd'], ['-x']])).toBe(
      '"C"\r\n"\'=SUM(A1)"\r\n"\'+1"\r\n"\'@cmd"\r\n"\'-x"'
    );
  });

  it('leaves negative figures alone', () => {
    expect(buildCsv(['N'], [['-12,50'], ['-$3.10']])).toBe('"N"\r\n"-12,50"\r\n"-$3.10"');
  });
});

describe('fetchAllPages', () => {
  const source = Array.from({ length: 250 }, (_, index) => index);
  const fetchPage = (page: number, limit: number) =>
    Promise.resolve({ items: source.slice((page - 1) * limit, page * limit), total: source.length });

  it('reads every page up to the reported total', async () => {
    await expect(fetchAllPages(fetchPage, 100)).resolves.toHaveLength(250);
  });

  it('stops at the row cap', async () => {
    await expect(fetchAllPages(fetchPage, 100, 150)).resolves.toHaveLength(150);
  });

  it('stops on a short page even if the total says more', async () => {
    const short = (page: number) => Promise.resolve({ items: page === 1 ? [1, 2] : [], total: 99 });
    await expect(fetchAllPages(short, 100)).resolves.toEqual([1, 2]);
  });
});
