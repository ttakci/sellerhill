import { buildLocalRangeSql, localDayEndExclusiveSql, localDayStartSql } from './local-day-sql';

describe('local-day SQL', () => {
  it('turns a local date into its local midnight as an instant', () => {
    expect(localDayStartSql('$2', '$4')).toBe('(($2)::date::timestamp AT TIME ZONE ($4)::text)');
  });

  it('ends at the NEXT local midnight, exclusive', () => {
    expect(localDayEndExclusiveSql('$3', '$4')).toBe('((($3)::date + 1)::timestamp AT TIME ZONE ($4)::text)');
  });

  it('bounds the column on both sides without casting the column', () => {
    const sql = buildLocalRangeSql('o.order_date', '$2', '$3', '$4');
    expect(sql).toBe(
      'o.order_date >= (($2)::date::timestamp AT TIME ZONE ($4)::text) AND o.order_date < ((($3)::date + 1)::timestamp AT TIME ZONE ($4)::text)',
    );
    expect(sql).not.toMatch(/o\.order_date\s+AT TIME ZONE/);
  });
});
