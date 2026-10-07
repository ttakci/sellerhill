import { TimezoneService } from './timezone.service';

function make(rows: { timezone: string | null }[], names = ['UTC', 'Europe/Istanbul', 'America/Los_Angeles']) {
  const query = jest.fn((sql: string) =>
    Promise.resolve(sql.includes('pg_timezone_names') ? names.map((name) => ({ name })) : rows),
  );
  return { service: new TimezoneService({ query } as never), query };
}

describe('TimezoneService', () => {
  it('accepts a name Postgres knows and refuses one it does not', async () => {
    const { service } = make([]);
    await expect(service.isValid('Europe/Istanbul')).resolves.toBe(true);
    await expect(service.isValid('Mars/Olympus')).resolves.toBe(false);
    await expect(service.isValid('')).resolves.toBe(false);
  });

  it('loads pg_timezone_names once', async () => {
    const { service, query } = make([]);
    await service.isValid('UTC');
    await service.isValid('UTC');
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('pg_timezone_names'))).toHaveLength(1);
  });

  it('returns the stored zone', async () => {
    await expect(make([{ timezone: 'Europe/Istanbul' }]).service.getForUser('u1')).resolves.toBe('Europe/Istanbul');
  });

  it('falls back to UTC for NULL, for a missing user and for a name Postgres does not know', async () => {
    await expect(make([{ timezone: null }]).service.getForUser('u1')).resolves.toBe('UTC');
    await expect(make([]).service.getForUser('u1')).resolves.toBe('UTC');
    await expect(make([{ timezone: 'Mars/Olympus' }]).service.getForUser('u1')).resolves.toBe('UTC');
  });
});
