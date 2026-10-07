import * as fs from 'fs';
import * as path from 'path';

const service = fs
  .readFileSync(path.join(__dirname, 'dashboard.service.ts'), 'utf8')
  .replace(/\r\n/g, '\n');

describe('the dashboard counts the seller’s calendar day', () => {
  it('never uses the database calendar', () => {
    expect(service).not.toMatch(/CURRENT_DATE/);
  });
  it('anchors today in the seller zone', () => {
    expect(service).toMatch(/now\(\) AT TIME ZONE \$1::text/);
  });
  it('filters with local-midnight bounds and buckets in the seller zone', () => {
    expect(service).toMatch(/buildLocalRangeSql\(/);
    expect(service).toMatch(/AT TIME ZONE \$\d+::text\)/); // inside date_trunc for buckets
  });
});
