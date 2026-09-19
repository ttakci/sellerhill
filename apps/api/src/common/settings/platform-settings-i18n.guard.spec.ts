// apps/api/src/common/settings/platform-settings-i18n.guard.spec.ts
//
// Every platform setting the admin panel can show needs a readable title and a
// description in BOTH locales.
//
// The panel resolves `admin.settings.keys.<key>` with the raw key as its
// fallback, so a setting registered without a translation does not fail — it
// quietly renders `tracking.aquiline.apiKey` as its own heading and an empty
// tooltip. Nothing errors, nothing logs, and the operator is left guessing what
// `keepa.refresh.batchAuto` means at exactly the moment they are configuring
// production. Nineteen settings shipped that way before this test existed,
// because adding a knob is one registry entry and one enum value and the
// translation is a third edit nobody is forced to make.

import * as fs from 'fs';
import * as path from 'path';

import { PlatformSettingKey } from '@repo/shared';

const RESOURCES = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'src',
  'i18n',
  'resources',
);

interface AdminSettingsCopy {
  admin: {
    settings: {
      keys: Record<string, string>;
      descriptions: Record<string, string>;
    };
  };
}

function load(locale: string): AdminSettingsCopy['admin']['settings'] {
  const raw = fs.readFileSync(path.join(RESOURCES, locale, 'admin.json'), 'utf8');
  return (JSON.parse(raw) as AdminSettingsCopy).admin.settings;
}

describe.each(['en', 'tr'])('admin settings copy (%s)', (locale) => {
  const copy = load(locale);
  const keys = Object.values(PlatformSettingKey);

  it('gives every platform setting a readable title', () => {
    const missing = keys.filter((key) => !copy.keys[key]?.trim());
    expect(missing).toEqual([]);
  });

  it('gives every platform setting a description', () => {
    const missing = keys.filter((key) => !copy.descriptions[key]?.trim());
    expect(missing).toEqual([]);
  });

  it('never uses the raw key as its own title', () => {
    const echoed = keys.filter((key) => copy.keys[key] === String(key));
    expect(echoed).toEqual([]);
  });
});
