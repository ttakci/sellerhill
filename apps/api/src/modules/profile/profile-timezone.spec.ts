import { BadRequestException } from '@nestjs/common';

import { ProfileService } from './profile.service';

const ROW = {
  id: 'u1', first_name: 'A', last_name: 'B', email: 'a@b.c', phone_number: null, avatar_url: null,
  job_title: null, bio: null, country: null, city_state: null, postal_code: null, timezone: 'Europe/Istanbul',
  digest_enabled: true, digest_send_hour: 8,
  email_verified: true, status: 'active', created_at: new Date(0), updated_at: new Date(0),
};

function make(valid: boolean) {
  const query = jest.fn((..._args: unknown[]) => Promise.resolve([ROW]));
  const timezones = { isValid: jest.fn(() => Promise.resolve(valid)) };
  return { service: new ProfileService({ query } as never, timezones as never), query };
}

describe('profile timezone', () => {
  it('returns the stored zone', async () => {
    await expect(make(true).service.getProfile('u1')).resolves.toMatchObject({ timezone: 'Europe/Istanbul' });
  });

  it('writes a zone Postgres knows', async () => {
    const { service, query } = make(true);
    await service.updateProfile('u1', { timezone: 'Europe/Istanbul' });
    expect(String(query.mock.calls[0][0])).toContain('timezone = $1');
  });

  it('refuses a zone Postgres does not know, writing nothing', async () => {
    const { service, query } = make(false);
    await expect(service.updateProfile('u1', { timezone: 'Mars/Olympus' })).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the daily summary choice', async () => {
    await expect(make(true).service.getProfile('u1')).resolves.toMatchObject({ digestEnabled: true, digestSendHour: 8 });
  });

  it('writes the daily summary choice', async () => {
    const { service, query } = make(true);
    await service.updateProfile('u1', { digestEnabled: false, digestSendHour: 6 });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('digest_enabled = $1');
    expect(sql).toContain('digest_send_hour = $2');
    expect(query.mock.calls[0][1]).toEqual([false, 6, 'u1']);
  });

  it.each([4, 13, 7.5])('refuses send hour %p, writing nothing', async (hour) => {
    const { service, query } = make(true);
    await expect(service.updateProfile('u1', { digestSendHour: hour })).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
