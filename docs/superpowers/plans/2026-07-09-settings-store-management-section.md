# Settings — "Mağaza Yapılandırması" Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-row "Mağaza Yapılandırması" section to the Settings hub (Mağaza ayarları / Yeni blacklist gir / Blacklist'leri göster), each row opening a drawer, and remove the now-redundant standalone StoreConfigSection.

**Architecture:** Frontend-only. All three drawers persist through the existing single `POST /v1/store-settings` endpoint by sending the full settings object for a chosen store/global scope and preserving the fields each drawer does not own. A shared pure-helper module computes scope options and resolves the active config. Drawers follow the strict 4-file container/component/style/types split.

**Tech Stack:** React 18, RTK Query, Emotion (`styled` + `tkn()`), `react-i18next`, design-system molecules from `@repo/ui` (`Drawer`, `ModernTextInput`, `ModernSelect`, `SettingsCard`, `SettingsActionRow`, `Button`, `Text`, `Icon`, `Toggle`).

## Global Constraints

- **No backend, DB, shared-domain, or Zod-schema changes.** Reuse `StoreSettings`, `BlacklistKeyword`, `SaveStoreSettingsRequest`, `StoreSettingsResponse`, `blacklistKeywordSchema(t)`, and the RTK Query hooks `useGetAllStoreSettingsQuery` / `useSaveStoreSettingsMutation` exactly as-is.
- **No test infrastructure exists in this repo** (Jest installed but unused). **Verification per task = `pnpm typecheck` + `pnpm lint` (max-warnings 0) + manual browser check**, NOT unit tests. End each task with these three before committing.
- **Frontend file-organization rules (CLAUDE.md §6, enforced by ESLint + PreToolUse hook):** every drawer = `.component.tsx` (markup + `useTranslation`/`useTheme` only) / `.container.tsx` (all logic, no `styled`) / `.style.ts` (all `styled`) / `.types.ts` (types only). No `styled(...)` outside `.style.ts`. No `interface`/`type` outside `.types.ts`. No hooks/state in `.component.tsx` beyond `useTranslation`/`useTheme`.
- **Design-system only:** no native `<input>`/`<select>`/`<button>`; use `@repo/ui` primitives. No hardcoded colors/spacing (use `tkn()`). No hardcoded UI strings (use `t()` with dot-notation: `t('translation:settingsHub.…')`). No hardcoded status strings.
- **Loading & errors:** loading via `useLoading` in containers; errors/success via `showMessage` from `useUI` (`MessageModal`), never `alert`/`confirm`.
- **Commits:** frequent, never use `--no-verify` (pre-commit runs `pnpm validate` = lint + typecheck). Current branch `UAT` — commit directly on it.
- **i18n is dual-language:** every new key goes into BOTH `packages/shared/src/i18n/resources/en/translation.json` and `tr/translation.json`. TR copy is the product's primary language; write natural Turkish for `tr`, English equivalent for `en`.

---

## File Structure

### Create
| File | Responsibility |
|---|---|
| `apps/web/src/features/settings/drawers/storeScope.ts` | Pure helpers: `buildScopeOptions(availableStores, t)`, `resolveScopeConfig(storeConfigs, scope)`, `GLOBAL_SCOPE` constant, `StoreScopeOption` type. |
| `apps/web/src/features/settings/drawers/StoreSettingsDrawer/{.component,.container,.style,.types}.tsx` + `index.ts` | Row 1 drawer: scope selector + location + validation toggles; selector-driven upsert. |
| `apps/web/src/features/settings/drawers/BlacklistAddDrawer/{.component,.container,.style,.types}.tsx` + `index.ts` | Row 2 drawer: scope selector + keyword + scope select + Add. |
| `apps/web/src/features/settings/drawers/BlacklistListDrawer/{.component,.container,.style,.types}.tsx` + `index.ts` | Row 3 drawer: scope selector + `BlacklistCard` grid + remove. |

### Modify
| File | Change |
|---|---|
| `packages/shared/src/i18n/resources/{en,tr}/translation.json` | Add `settingsHub.sections.storeManagement.*`, `settingsHub.drawer.storeSettings.*`, `settingsHub.drawer.blacklist.{add,list}.*`. |
| `apps/web/src/features/settings/drawers/index.ts` | Export `StoreSettingsDrawer`, `BlacklistAddDrawer`, `BlacklistListDrawer`; remove `StoreConfigDrawer` export. |
| `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts` | `SettingsDrawerKey`: drop `'storeConfig'`, add `'storeSettings' | 'blacklistAdd' | 'blacklistList'`. Update `SettingsHubPageComponentProps` (drop `editingStoreConfig`/`onNewStoreConfig`/`onEditStoreConfig`). |
| `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx` | Drop store-config new/edit handlers + `EDIT_STORE_CONFIG_PARAM` + `editingStoreConfig`. Pass `storeConfigs` + `availableStores` to the 3 new drawers. |
| `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx` | Remove `StoreConfigSection`; add `StoreManagementSection` (3 `SettingsActionRow`s); swap the drawer JSX (remove `StoreConfigDrawer`, add the 3 new drawers). |

### Delete
| File | Reason |
|---|---|
| `apps/web/src/features/settings/drawers/StoreConfigDrawer/` (whole folder) | Replaced by selector-driven `StoreSettingsDrawer`; no other consumer. Done in the hub-rewrite task. |

---

## Resolved design decisions (from spec open questions)

1. **Mobile bottom-sheet:** `ModernSelect` (alias of the `Select` molecule, `packages/ui/src/index.ts:74`) already renders a portal `BottomSheet` on mobile (`Select.component.tsx` `isMobile` branch). **Use `ModernSelect` for all scope selectors.**
2. **Shared scope logic:** a pure helper module (`storeScope.ts`) — not a `packages/ui` molecule. Each drawer container owns its `selectedScope` state and calls the helpers. Avoids premature abstraction; rule-compliant (a `.ts` util, no JSX/styled).
3. **Row 1:** a fresh selector-driven `StoreSettingsDrawer` (scope = global + every store, always selectable). The old create/edit-mode `StoreConfigDrawer` is deleted in the hub-rewrite task. Renaming-in-place was rejected to keep every intermediate commit compiling.

---

## Task 1: i18n keys (EN + TR)

**Files:**
- Modify: `packages/shared/src/i18n/resources/en/translation.json` (inside `settingsHub.sections`, add after the `storeConfig` block ~line 196; inside `settingsHub.drawer`, add after `storeConfig` block ~line 251)
- Modify: `packages/shared/src/i18n/resources/tr/translation.json` (mirror structure)

**Interfaces:**
- Produces keys consumed by Tasks 3–6: `settingsHub.sections.storeManagement.{title,subtitle,storeSettings,blacklistAdd,blacklistList}`, `settingsHub.drawer.storeSettings.{title,subtitle,global,appliesTo,validation,validateTitle,validateDescription,country,region,zipCode}`, `settingsHub.drawer.blacklist.add.{title,subtitle,keyword,scope,scopeBoth,scopeTitle,scopeDescription,add,duplicate,empty}`, `settingsHub.drawer.blacklist.list.{title,subtitle,empty,removeLabel}`.

- [ ] **Step 1: Add section + drawer keys to EN file**

Insert into `en/translation.json` under `settingsHub.sections` (after the `blacklist` block, before `listingGroups`):

```json
      "storeManagement": {
        "title": "Store Configuration",
        "subtitle": "Store settings and listing keyword blacklist",
        "storeSettings": "Store Settings",
        "blacklistAdd": "Add Blacklist Keyword",
        "blacklistList": "View Blacklist"
      },
```

Insert under `settingsHub.drawer` (after the `storeConfig` block):

```json
      "storeSettings": {
        "title": "Store Settings",
        "subtitle": "Location and listing validation for the selected scope",
        "global": "Global (all stores)",
        "appliesTo": "Applies to",
        "validation": "Listing validation",
        "validateTitle": "Validate product titles",
        "validateDescription": "Validate product descriptions",
        "country": "Country",
        "region": "Region",
        "zipCode": "Zip Code"
      },
      "blacklist": {
        "add": {
          "title": "Add Blacklist Keyword",
          "subtitle": "Forbidden keyword for the selected scope",
          "keyword": "Keyword",
          "scope": "Scope",
          "scopeBoth": "Title & Description",
          "scopeTitle": "Title only",
          "scopeDescription": "Description only",
          "add": "Add Keyword",
          "duplicate": "This keyword already exists for the selected scope",
          "empty": "Keyword cannot be empty"
        },
        "list": {
          "title": "Blacklist Keywords",
          "subtitle": "Forbidden keywords for the selected scope",
          "empty": "No blacklist keywords for the selected scope",
          "removeLabel": "Remove keyword"
        }
      },
```

- [ ] **Step 2: Add the same keys to TR file with Turkish copy**

Mirror the exact same nested structure in `tr/translation.json`. Turkish copy:

```json
      "storeManagement": {
        "title": "Mağaza Yapılandırması",
        "subtitle": "Mağaza ayarları ve listing kelime blacklist'i",
        "storeSettings": "Mağaza Ayarları",
        "blacklistAdd": "Yeni Blacklist Gir",
        "blacklistList": "Blacklist'leri Göster"
      },
```

```json
      "storeSettings": {
        "title": "Mağaza Ayarları",
        "subtitle": "Seçili kapsam için konum ve listing doğrulaması",
        "global": "Global (tüm mağazalar)",
        "appliesTo": "Uygulandığı yer",
        "validation": "Listing doğrulaması",
        "validateTitle": "Ürün başlıklarını doğrula",
        "validateDescription": "Ürün açıklamalarını doğrula",
        "country": "Ülke",
        "region": "Bölge",
        "zipCode": "Posta Kodu"
      },
      "blacklist": {
        "add": {
          "title": "Yeni Blacklist Kelimesi",
          "subtitle": "Seçili kapsam için yasaklı kelime",
          "keyword": "Kelime",
          "scope": "Kapsam",
          "scopeBoth": "Başlık & Açıklama",
          "scopeTitle": "Yalnızca başlık",
          "scopeDescription": "Yalnızca açıklama",
          "add": "Kelime Ekle",
          "duplicate": "Bu kelime seçili kapsam için zaten var",
          "empty": "Kelime boş olamaz"
        },
        "list": {
          "title": "Blacklist Kelimeleri",
          "subtitle": "Seçili kapsam için yasaklı kelimeler",
          "empty": "Seçili kapsam için blacklist kelimesi yok",
          "removeLabel": "Kelimeyi kaldır"
        }
      },
```

- [ ] **Step 3: Validate JSON + build shared package**

Run:
```bash
pnpm --filter @repo/shared build
```
Expected: build succeeds (validates JSON parses). If it fails, a trailing comma / missing brace in the JSON — fix it.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/i18n/resources/en/translation.json packages/shared/src/i18n/resources/tr/translation.json
git commit -m "feat(settings): i18n keys for store management section + blacklist drawers"
```

---

## Task 2: Shared scope helpers (`storeScope.ts`)

**Files:**
- Create: `apps/web/src/features/settings/drawers/storeScope.ts`

**Interfaces:**
- Consumes: `StoreSettingsResponse` from `@repo/shared`.
- Produces:
  - `export const GLOBAL_SCOPE = 'global';`
  - `export type StoreScopeOption = { value: string; label: string };`
  - `export function buildScopeOptions(availableStores: { id: string; name: string }[], globalLabel: string): StoreScopeOption[]` → returns `[{ value: GLOBAL_SCOPE, label: globalLabel }, ...stores.map(s => ({ value: s.id, label: s.name }))]`.
  - `export function resolveScopeConfig(storeConfigs: StoreSettingsResponse[], scope: string): StoreSettingsResponse | null` → returns the config matching `scope === GLOBAL_SCOPE ? isGlobal : storeId === scope`, else `null`.

- [ ] **Step 1: Create the helper module**

`apps/web/src/features/settings/drawers/storeScope.ts`:

```ts
import type { StoreSettingsResponse } from '@repo/shared';

/** Sentinel value representing the global (all-stores) scope. */
export const GLOBAL_SCOPE = 'global';

export type StoreScopeOption = { value: string; label: string };

/**
 * Build the scope selector options: global first, then every available store.
 * Used by all three store-management drawers.
 */
export function buildScopeOptions(
  availableStores: Array<{ id: string; name: string }>,
  globalLabel: string,
): StoreScopeOption[] {
  return [
    { value: GLOBAL_SCOPE, label: globalLabel },
    ...availableStores.map((s) => ({ value: s.id, label: s.name })),
  ];
}

/**
 * Resolve the persisted config for a selected scope from the full config list.
 * Returns null when no config exists yet for that scope (create-on-first-edit).
 */
export function resolveScopeConfig(
  storeConfigs: StoreSettingsResponse[],
  scope: string,
): StoreSettingsResponse | null {
  if (scope === GLOBAL_SCOPE) {
    return storeConfigs.find((c) => c.isGlobal) ?? null;
  }
  return storeConfigs.find((c) => !c.isGlobal && c.storeId === scope) ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors). This file is pure; if it fails, the import path or type name is wrong.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/settings/drawers/storeScope.ts
git commit -m "feat(settings): shared store-scope helpers for management drawers"
```

---

## Task 3: BlacklistAddDrawer (Row 2)

**Files:**
- Create: `apps/web/src/features/settings/drawers/BlacklistAddDrawer/BlacklistAddDrawer.types.ts`
- Create: `apps/web/src/features/settings/drawers/BlacklistAddDrawer/BlacklistAddDrawer.style.ts`
- Create: `apps/web/src/features/settings/drawers/BlacklistAddDrawer/BlacklistAddDrawer.component.tsx`
- Create: `apps/web/src/features/settings/drawers/BlacklistAddDrawer/BlacklistAddDrawer.container.tsx`
- Create: `apps/web/src/features/settings/drawers/BlacklistAddDrawer/index.ts`
- Modify: `apps/web/src/features/settings/drawers/index.ts` (add export)

**Interfaces:**
- Consumes: `useGetAllStoreSettingsQuery`, `useSaveStoreSettingsMutation` from `@/features/store-settings/api/storeSettingsApi`; `buildScopeOptions`, `resolveScopeConfig`, `GLOBAL_SCOPE` from `../storeScope`; `showMessage`/`closeMessage` from `useUI`; `useLoading` from `@repo/ui`.
- Produces: `export { BlacklistAddDrawer } from './BlacklistAddDrawer.container';` with props `{ isOpen: boolean; onClose: () => void; availableStores: Array<{id;name}> }`.

- [ ] **Step 1: Types file**

`BlacklistAddDrawer.types.ts`:

```ts
import type { StoreSettingsResponse } from '@repo/shared';

export type BlacklistScope = 'title' | 'description' | 'both';

export interface BlacklistAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
}

export interface BlacklistAddDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  keyword: string;
  onKeywordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedScopeValue: BlacklistScope;
  onSelectScopeValue: (value: BlacklistScope) => void;
  onAdd: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}
```

- [ ] **Step 2: Style file**

`BlacklistAddDrawer.style.ts` — a vertical stack + a field grid for keyword/scope. Use `tkn()` for spacing.

```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.4')};
`;

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.4')};
  @media (min-width: 600px) {
    grid-template-columns: 2fr 1fr;
    align-items: end;
  }
`;
```

- [ ] **Step 3: Component file (markup only)**

`BlacklistAddDrawer.component.tsx`:

```tsx
import { Button, Drawer, ModernSelect, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FieldGrid } from './BlacklistAddDrawer.style';
import type { BlacklistAddDrawerComponentProps, BlacklistScope } from './BlacklistAddDrawer.types';

export const BlacklistAddDrawerComponent: React.FC<BlacklistAddDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  keyword,
  onKeywordChange,
  selectedScopeValue,
  onSelectScopeValue,
  onAdd,
  isSaving,
  errorMessage,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.blacklist.add.title')}
      subtitle={t('translation:settingsHub.drawer.blacklist.add.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:settingsHub.drawer.blacklist.add.add'),
        onClick: onAdd,
        isLoading: isSaving,
      }}
    >
      <BodyStack>
        <ModernSelect
          label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
          options={scopeOptions}
          value={selectedScope}
          onChange={(v) => onSelectScope(String(v))}
          fullWidth
        />
        <FieldGrid>
          <ModernTextInput
            label={t('translation:settingsHub.drawer.blacklist.add.keyword')}
            value={keyword}
            onChange={onKeywordChange}
          />
          <ModernSelect
            label={t('translation:settingsHub.drawer.blacklist.add.scope')}
            options={[
              { value: 'both', label: t('translation:settingsHub.drawer.blacklist.add.scopeBoth') },
              { value: 'title', label: t('translation:settingsHub.drawer.blacklist.add.scopeTitle') },
              { value: 'description', label: t('translation:settingsHub.drawer.blacklist.add.scopeDescription') },
            ]}
            value={selectedScopeValue}
            onChange={(v) => onSelectScopeValue(v as BlacklistScope)}
            fullWidth
          />
        </FieldGrid>
        {errorMessage && (
          <Text variant="caption" color="semantic.error">
            {errorMessage}
          </Text>
        )}
      </BodyStack>
    </Drawer>
  );
};

BlacklistAddDrawerComponent.displayName = 'BlacklistAddDrawerComponent';
```

> Verify `semantic.error` is a valid token path in `tkn`; if the codebase uses `text.error` or similar for error text, match the existing pattern (grep `color="semantic` in `apps/web/src/features` and use whatever error-color token other drawers use). Keep it consistent.

- [ ] **Step 4: Container file (all logic)**

`BlacklistAddDrawer.container.tsx`:

```tsx
import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BlacklistAddDrawerComponent } from './BlacklistAddDrawer.component';
import type { BlacklistAddDrawerProps, BlacklistScope } from './BlacklistAddDrawer.types';

import { useGetAllStoreSettingsQuery, useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

export const BlacklistAddDrawer: React.FC<BlacklistAddDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const { isLoading } = useGetAllStoreSettingsQuery(undefined, { skip: !isOpen });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isLoading || isSaving);

  const [selectedScope, setSelectedScope] = useState<string>(GLOBAL_SCOPE);
  const [keyword, setKeyword] = useState('');
  const [scopeValue, setScopeValue] = useState<BlacklistScope>('both');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));

  const handleAdd = (): void => {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.empty'));
      return;
    }
    const config = resolveScopeConfig(storeConfigs, selectedScope);
    const existing = config?.blacklist ?? [];
    const isDuplicate = existing.some((b) => b.keyword.toLowerCase() === trimmed.toLowerCase() && b.scope === scopeValue);
    if (isDuplicate) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }
    setErrorMessage(null);

    const payload = {
      isGlobal: selectedScope === GLOBAL_SCOPE,
      storeId: selectedScope === GLOBAL_SCOPE ? undefined : selectedScope,
      country: config?.country ?? '',
      state: config?.state ?? '',
      zipCode: config?.zipCode ?? '',
      validateTitle: config?.validateTitle ?? true,
      validateDescription: config?.validateDescription ?? false,
      blacklist: [...existing, { keyword: trimmed, scope: scopeValue }].map((b) => ({ keyword: b.keyword, scope: b.scope })),
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'translation:common.saveSuccess',
            primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
          },
          t,
        );
        setKeyword('');
        onClose();
      })
      .catch((error: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <BlacklistAddDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={setSelectedScope}
      keyword={keyword}
      onKeywordChange={(e) => setKeyword(e.target.value)}
      selectedScopeValue={scopeValue}
      onSelectScopeValue={setScopeValue}
      onAdd={handleAdd}
      isSaving={isSaving}
      errorMessage={errorMessage}
    />
  );
};

BlacklistAddDrawer.displayName = 'BlacklistAddDrawer';
```

- [ ] **Step 5: Barrel + feature export**

`BlacklistAddDrawer/index.ts`:

```ts
export { BlacklistAddDrawer } from './BlacklistAddDrawer.container';
export type { BlacklistAddDrawerProps } from './BlacklistAddDrawer.types';
```

Add to `apps/web/src/features/settings/drawers/index.ts` (after the `AmazonAccountsDrawer` export line):

```ts
export { BlacklistAddDrawer } from './BlacklistAddDrawer';
export type { BlacklistAddDrawerProps } from './BlacklistAddDrawer';
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Fix any token-path / hook-usage / `styled`-placement errors the rules flag.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/settings/drawers/BlacklistAddDrawer apps/web/src/features/settings/drawers/index.ts
git commit -m "feat(settings): BlacklistAddDrawer for adding keyword to selected scope"
```

---

## Task 4: BlacklistListDrawer (Row 3)

**Files:**
- Create: `apps/web/src/features/settings/drawers/BlacklistListDrawer/BlacklistListDrawer.{types,style,component,container}.tsx` + `index.ts`
- Modify: `apps/web/src/features/settings/drawers/index.ts` (add export)

**Interfaces:**
- Consumes: same hooks as Task 3; `BlacklistCard` from `@/features/store-settings/components/BlacklistCard` (props: `{ keyword: string; scope: 'both'|'title'|'description'; onRemove: () => void }`); `buildScopeOptions`, `resolveScopeConfig`, `GLOBAL_SCOPE` from `../storeScope`.
- Produces: `export { BlacklistListDrawer }` props `{ isOpen; onClose; availableStores; storeConfigs }`.

- [ ] **Step 1: Types file**

`BlacklistListDrawer.types.ts`:

```ts
import type { StoreSettingsResponse } from '@repo/shared';

export interface BlacklistListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
}

export interface BlacklistListDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  items: Array<{ keyword: string; scope: 'both' | 'title' | 'description' }>;
  onRemove: (keyword: string, scope: 'both' | 'title' | 'description') => void;
  isLoading: boolean;
}
```

- [ ] **Step 2: Style file** — a responsive card grid.

`BlacklistListDrawer.style.ts`:

```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.4')};
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.3')};
  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const EmptyText = styled.p`
  margin: 0;
  color: ${tkn('colors.text.secondary')};
`;
```

- [ ] **Step 3: Component file (markup only)**

`BlacklistListDrawer.component.tsx`:

```tsx
import { Drawer, ModernSelect, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BlacklistCard } from '@/features/store-settings/components/BlacklistCard';

import { BodyStack, CardGrid, EmptyText } from './BlacklistListDrawer.style';
import type { BlacklistListDrawerComponentProps } from './BlacklistListDrawer.types';

export const BlacklistListDrawerComponent: React.FC<BlacklistListDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  items,
  onRemove,
  isLoading,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.blacklist.list.title')}
      subtitle={t('translation:settingsHub.drawer.blacklist.list.subtitle')}
      size="md"
    >
      <BodyStack>
        <ModernSelect
          label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
          options={scopeOptions}
          value={selectedScope}
          onChange={(v) => onSelectScope(String(v))}
          fullWidth
        />
        {items.length > 0 ? (
          <CardGrid>
            {items.map((item) => (
              <BlacklistCard
                key={`${item.keyword}-${item.scope}`}
                keyword={item.keyword}
                scope={item.scope}
                onRemove={() => onRemove(item.keyword, item.scope)}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptyText>
            <Text variant="body-sm" color="text.secondary">
              {isLoading
                ? t('translation:common.loading')
                : t('translation:settingsHub.drawer.blacklist.list.empty')}
            </Text>
          </EmptyText>
        )}
      </BodyStack>
    </Drawer>
  );
};

BlacklistListDrawerComponent.displayName = 'BlacklistListDrawerComponent';
```

> Note: `isLoading` is only used to pick the loading-vs-empty label here; the container drives the global overlay via `useLoading`. This is presentation of an empty-state label, which is permitted. If ESLint's `logic-only-in-container` flags reading `isLoading` for a label, pass a derived `emptyLabelKey: string` from the container instead and render `t(emptyLabelKey)` — adjust both files together.

- [ ] **Step 4: Container file**

`BlacklistListDrawer.container.tsx`:

```tsx
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BlacklistListDrawerComponent } from './BlacklistListDrawer.component';
import type { BlacklistListDrawerProps } from './BlacklistListDrawer.types';

import { useGetAllStoreSettingsQuery, useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

type BlacklistScope = 'both' | 'title' | 'description';

export const BlacklistListDrawer: React.FC<BlacklistListDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const { isLoading } = useGetAllStoreSettingsQuery(undefined, { skip: !isOpen });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isLoading || isSaving);

  const [selectedScope, setSelectedScope] = useState<string>(GLOBAL_SCOPE);

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));
  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const items = useMemo(() => config?.blacklist ?? [], [config]);

  const handleRemove = (keyword: string, scope: BlacklistScope): void => {
    if (!config) {return;}
    const next = config.blacklist.filter(
      (b) => !(b.keyword === keyword && b.scope === scope),
    );
    const payload = {
      isGlobal: config.isGlobal,
      storeId: config.isGlobal ? undefined : config.storeId,
      country: config.country,
      state: config.state,
      zipCode: config.zipCode,
      validateTitle: config.validateTitle,
      validateDescription: config.validateDescription,
      blacklist: next.map((b) => ({ keyword: b.keyword, scope: b.scope })),
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
      .catch((error: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <BlacklistListDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={setSelectedScope}
      items={items}
      onRemove={handleRemove}
      isLoading={isLoading}
    />
  );
};

BlacklistListDrawer.displayName = 'BlacklistListDrawer';
```

- [ ] **Step 5: Barrel + feature export**

`BlacklistListDrawer/index.ts`:

```ts
export { BlacklistListDrawer } from './BlacklistListDrawer.container';
export type { BlacklistListDrawerProps } from './BlacklistListDrawer.types';
```

Add to `drawers/index.ts`:

```ts
export { BlacklistListDrawer } from './BlacklistListDrawer';
export type { BlacklistListDrawerProps } from './BlacklistListDrawer';
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/settings/drawers/BlacklistListDrawer apps/web/src/features/settings/drawers/index.ts
git commit -m "feat(settings): BlacklistListDrawer with card grid for selected scope"
```

---

## Task 5: StoreSettingsDrawer (Row 1, selector-driven)

**Files:**
- Create: `apps/web/src/features/settings/drawers/StoreSettingsDrawer/StoreSettingsDrawer.{types,style,component,container}.tsx` + `index.ts`
- Modify: `apps/web/src/features/settings/drawers/index.ts` (add export)

**Interfaces:**
- Consumes: `useSaveStoreSettingsMutation` from `@/features/store-settings/api/storeSettingsApi`; `buildScopeOptions`, `resolveScopeConfig`, `GLOBAL_SCOPE` from `../storeScope`; `showMessage`/`closeMessage`/`useLoading` from `@repo/ui`.
- Produces: `export { StoreSettingsDrawer }` props `{ isOpen; onClose; availableStores; storeConfigs }`.

- [ ] **Step 1: Types file**

`StoreSettingsDrawer.types.ts`:

```ts
import type { StoreSettingsResponse } from '@repo/shared';

export interface StoreSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
}

export interface StoreSettingsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  country: string;
  state: string;
  zipCode: string;
  validateTitle: boolean;
  validateDescription: boolean;
  onCountryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleValidateTitle: (checked: boolean) => void;
  onToggleValidateDescription: (checked: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  isSaveDisabled: boolean;
}
```

- [ ] **Step 2: Style file**

`StoreSettingsDrawer.style.ts`:

```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.4')};
`;

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.4')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.3')};
`;
```

- [ ] **Step 3: Component file**

`StoreSettingsDrawer.component.tsx`:

```tsx
import { Drawer, ModernSelect, ModernTextInput, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FieldGrid, ToggleRow } from './StoreSettingsDrawer.style';
import type { StoreSettingsDrawerComponentProps } from './StoreSettingsDrawer.types';

export const StoreSettingsDrawerComponent: React.FC<StoreSettingsDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  country,
  state,
  zipCode,
  validateTitle,
  validateDescription,
  onCountryChange,
  onStateChange,
  onZipCodeChange,
  onToggleValidateTitle,
  onToggleValidateDescription,
  onSave,
  isSaving,
  isSaveDisabled,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.storeSettings.title')}
      subtitle={t('translation:settingsHub.drawer.storeSettings.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
        disabled: isSaveDisabled,
      }}
    >
      <BodyStack>
        <ModernSelect
          label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
          options={scopeOptions}
          value={selectedScope}
          onChange={(v) => onSelectScope(String(v))}
          fullWidth
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.storeSettings.country')}
          value={country}
          onChange={onCountryChange}
        />
        <FieldGrid>
          <ModernTextInput
            label={t('translation:settingsHub.drawer.storeSettings.region')}
            value={state}
            onChange={onStateChange}
          />
          <ModernTextInput
            label={t('translation:settingsHub.drawer.storeSettings.zipCode')}
            value={zipCode}
            onChange={onZipCodeChange}
          />
        </FieldGrid>
        <Text variant="body-sm" weight="semibold">
          {t('translation:settingsHub.drawer.storeSettings.validation')}
        </Text>
        <ToggleRow>
          <Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateTitle')}</Text>
          <Toggle checked={validateTitle} onChange={onToggleValidateTitle} />
        </ToggleRow>
        <ToggleRow>
          <Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateDescription')}</Text>
          <Toggle checked={validateDescription} onChange={onToggleValidateDescription} />
        </ToggleRow>
      </BodyStack>
    </Drawer>
  );
};

StoreSettingsDrawerComponent.displayName = 'StoreSettingsDrawerComponent';
```

> The location fields here intentionally duplicate the old StoreConfigDrawer's layout — that drawer is deleted in Task 6, so this is the single source of truth afterward (no long-lived duplication).

- [ ] **Step 4: Container file**

`StoreSettingsDrawer.container.tsx`:

```tsx
import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StoreSettingsDrawerComponent } from './StoreSettingsDrawer.component';
import type { StoreSettingsDrawerProps } from './StoreSettingsDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

export const StoreSettingsDrawer: React.FC<StoreSettingsDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const [selectedScope, setSelectedScope] = useState<string>(GLOBAL_SCOPE);
  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const [country, setCountry] = useState(config?.country ?? '');
  const [stateField, setStateField] = useState(config?.state ?? '');
  const [zipCode, setZipCode] = useState(config?.zipCode ?? '');
  const [validateTitle, setValidateTitle] = useState(config?.validateTitle ?? true);
  const [validateDescription, setValidateDescription] = useState(config?.validateDescription ?? false);

  // When the user switches scope, reload fields from that scope's config.
  const handleSelectScope = (value: string): void => {
    setSelectedScope(value);
    const next = resolveScopeConfig(storeConfigs, value);
    setCountry(next?.country ?? '');
    setStateField(next?.state ?? '');
    setZipCode(next?.zipCode ?? '');
    setValidateTitle(next?.validateTitle ?? true);
    setValidateDescription(next?.validateDescription ?? false);
  };

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));
  const isSaveDisabled =
    isSaving || country.trim().length === 0 || stateField.trim().length === 0 || zipCode.trim().length === 0;

  const handleSave = (): void => {
    if (isSaveDisabled) {return;}
    // Preserve the selected scope's existing blacklist (this drawer doesn't manage it).
    const blacklist = (config?.blacklist ?? []).map((b) => ({ keyword: b.keyword, scope: b.scope }));
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    const payload = {
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      country: country.trim(),
      state: stateField.trim(),
      zipCode: zipCode.trim(),
      validateTitle,
      validateDescription,
      blacklist,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'translation:common.saveSuccess',
            primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
          },
          t,
        );
        onClose();
      })
      .catch((error: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <StoreSettingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={handleSelectScope}
      country={country}
      state={stateField}
      zipCode={zipCode}
      validateTitle={validateTitle}
      validateDescription={validateDescription}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onToggleValidateTitle={setValidateTitle}
      onToggleValidateDescription={setValidateDescription}
      onSave={handleSave}
      isSaving={isSaving}
      isSaveDisabled={isSaveDisabled}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
```

> Lazy initializers seed state from the config for the default `GLOBAL_SCOPE` on mount. Scope switches re-seed via `handleSelectScope`. Because the parent remounts this drawer per open (hub uses a `key`), no sync effect is needed — mirroring the pattern in the deleted `StoreConfigDrawer.container.tsx`.

- [ ] **Step 5: Barrel + feature export**

`StoreSettingsDrawer/index.ts`:

```ts
export { StoreSettingsDrawer } from './StoreSettingsDrawer.container';
export type { StoreSettingsDrawerProps } from './StoreSettingsDrawer.types';
```

Add to `drawers/index.ts`:

```ts
export { StoreSettingsDrawer } from './StoreSettingsDrawer';
export type { StoreSettingsDrawerProps } from './StoreSettingsDrawer';
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/settings/drawers/StoreSettingsDrawer apps/web/src/features/settings/drawers/index.ts
git commit -m "feat(settings): selector-driven StoreSettingsDrawer (location + validation)"
```

---

## Task 6: Wire StoreManagementSection into the hub; remove StoreConfigSection + StoreConfigDrawer

**Files:**
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts`
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx`
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx`
- Delete: `apps/web/src/features/settings/drawers/StoreConfigDrawer/` (whole folder)
- Modify: `apps/web/src/features/settings/drawers/index.ts` (remove StoreConfigDrawer export)

**Interfaces:**
- Consumes: the three drawers from Tasks 3–5; `SettingsActionRow`, `SettingsCard` from `@repo/ui`.
- Produces: the final hub with the new section; clean drawer-key union.

- [ ] **Step 1: Update drawer-key union + props in `SettingsHubPage.types.ts`**

Replace the `SettingsDrawerKey` union:

```ts
export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'amazonList'
  | 'storeSettings'
  | 'blacklistAdd'
  | 'blacklistList'
  | 'listingGroupNew'
  | 'listingGroupEdit'
  | 'password'
  | 'language'
  | null;
```

Remove the now-unused props from `SettingsHubPageComponentProps`: delete `editingStoreConfig`, `onNewStoreConfig`, `onEditStoreConfig`. Keep `storeConfigs` and `availableStores` (the new drawers consume them).

- [ ] **Step 2: Simplify the container (`SettingsHubPage.container.tsx`)**

- Delete the `EDIT_STORE_CONFIG_PARAM` constant.
- Delete `editingStoreConfigId`, `handleNewStoreConfig`, `handleEditStoreConfig`, and the `editingStoreConfig` memo.
- In `handleCloseDrawer`, remove the `next.delete(EDIT_STORE_CONFIG_PARAM)` line.
- In the `<SettingsHubPageComponent … />` JSX, remove `editingStoreConfig={…}`, `onNewStoreConfig={…}`, `onEditStoreConfig={…}`. Keep `storeConfigs={storeConfigs}` and `availableStores={availableStores}`.

(All other queries/handlers stay. `useGetAllStoreSettingsQuery` and `useGetEbayAccountsQuery` already feed `storeConfigs` and `availableStores`.)

- [ ] **Step 3: Rewrite the section + drawer wiring in `SettingsHubPage.component.tsx`**

3a. Update the `@repo/ui` import line — it already imports `SettingsActionRow`, `SettingsCard` (keep). Add `StoreSettingsDrawer`, `BlacklistAddDrawer`, `BlacklistListDrawer` to the `../drawers` import; remove `StoreConfigDrawer`.

3b. **Delete the entire `StoreConfigSection` subcomponent** (the `const StoreConfigSection = …` block).

3c. **Add a new `StoreManagementSection` subcomponent** (place it near `AccountSecuritySection`):

```tsx
const StoreManagementSection = ({
  onAction,
}: {
  onAction: (key: 'storeSettings' | 'blacklistAdd' | 'blacklistList') => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{ key: 'storeSettings' | 'blacklistAdd' | 'blacklistList'; icon: string; labelKey: string }> = [
    { key: 'storeSettings', icon: 'settings', labelKey: 'translation:settingsHub.sections.storeManagement.storeSettings' },
    { key: 'blacklistAdd', icon: 'plus', labelKey: 'translation:settingsHub.sections.storeManagement.blacklistAdd' },
    { key: 'blacklistList', icon: 'list', labelKey: 'translation:settingsHub.sections.storeManagement.blacklistList' },
  ];
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'store',
        title: t('translation:settingsHub.sections.storeManagement.title'),
        subtitle: t('translation:settingsHub.sections.storeManagement.subtitle'),
      }}
    >
      {items.map(({ key, icon, labelKey }) => (
        <SettingsActionRow key={key} icon={icon as never} label={t(labelKey)} onClick={() => onAction(key)} />
      ))}
    </SettingsCard>
  );
};
```

> Verify the icon names exist in the `Icon` map (`settings`, `plus`, `list`, `store`). If `settings` is unavailable, grep `packages/ui/src/atoms/Icon` for the actual name (e.g. `sliders`, `gear`) and use that. The old sections use `map-pin`, `layers`, `shield-check`, `storefront`, `amazon`, `list`, `plus`, `block` — reuse from those known-good names.

3d. **In the main component body**, remove the `<StoreConfigSection … />` usage from the second `<S.TwoColGrid>` so that grid now contains only `<ListingGroupsSection … />` — OR convert it to a standalone `<ListingGroupsSection />` outside a two-column grid (cleaner, since its sibling is gone). Recommended: replace the second `TwoColGrid` block with just:

```tsx
      <ListingGroupsSection
        groups={listingGroups}
        onNew={() => onOpenDrawer('listingGroupNew')}
        onEdit={onEditListingGroup}
      />
```

3e. **Add the new section** right after the Listing Groups block (and before/after `AccountSecuritySection` — place it logically above Account & Security):

```tsx
      <StoreManagementSection onAction={(key) => onOpenDrawer(key)} />
```

3f. **Replace the drawer JSX**: remove the `<StoreConfigDrawer … />` block and add:

```tsx
      <StoreSettingsDrawer
        isOpen={activeDrawer === 'storeSettings'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
      <BlacklistAddDrawer
        isOpen={activeDrawer === 'blacklistAdd'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
      <BlacklistListDrawer
        isOpen={activeDrawer === 'blacklistList'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
```

3g. Remove now-unused props from the `SettingsHubPageComponent` destructure (`editingStoreConfig`, `onNewStoreConfig`, `onEditStoreConfig`) and the `StoreConfigDrawer` import. Ensure `storeConfigs` + `availableStores` remain destructured (now used by the drawers directly).

- [ ] **Step 4: Delete the old StoreConfigDrawer folder + remove its export**

```bash
git rm -r apps/web/src/features/settings/drawers/StoreConfigDrawer
```

In `drawers/index.ts`, delete the two lines:
```ts
export { StoreConfigDrawer } from './StoreConfigDrawer';
export type { StoreConfigDrawerProps } from './StoreConfigDrawer';
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Watch for: leftover references to `StoreConfigDrawer` / `editingStoreConfig` / `'storeConfig'` drawer key / removed props. Grep to be sure:

```bash
grep -rn "StoreConfigDrawer\|editingStoreConfig\|onNewStoreConfig\|onEditStoreConfig\|'storeConfig'" apps/web/src/features/settings
```
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/features/settings
git commit -m "feat(settings): Mağaza Yapılandırması section (3 rows) + remove StoreConfigSection"
```

---

## Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full quality gate**

Run:
```bash
pnpm validate
```
Expected: lint (max-warnings 0) + typecheck both PASS.

- [ ] **Step 2: Run the app**

```bash
pnpm docker:up   # if not already running (PostgreSQL + Redis)
pnpm dev
```
Open the web app (default `http://localhost:5173`), sign in, navigate to Settings.

- [ ] **Step 3: Manual browser checks**

For each, confirm in both **EN** and **TR**, and on **desktop + a narrow mobile viewport** (DevTools toggle):

1. **Section renders:** "Mağaza Yapılandırması" / "Store Configuration" card with exactly 3 rows (Mağaza Ayarları / Yeni Blacklist Gir / Blacklist'leri Göster), same geometry as Account & Security. Old per-store StoreConfigSection is gone; Listing Groups still present.
2. **Row 1 — Store Settings drawer:** opens; scope selector shows Global + each connected eBay store; on mobile the selector opens a bottom sheet. Editing location + toggles and saving shows the success MessageModal and persists (reload → values remain). Switching scope reloads that scope's values. Blacklist for that scope is unchanged after save.
3. **Row 2 — Add Blacklist drawer:** adding a `{keyword, scope}` to Global and to a store persists; duplicate `(keyword, scope)` shows the duplicate error; empty keyword shows the empty error. Existing location/validation for that scope unchanged after add.
4. **Row 3 — List Blacklist drawer:** shows the selected scope's keywords as cards; remove deletes the right card and persists; empty scope shows the empty-state message; switching scope swaps the list.
5. **No regressions:** Profile, eBay, Amazon, Listing Groups, Change Password, Language drawers and Deactivate modal still open and close cleanly.

- [ ] **Step 4: Final commit (if any verification fixups were made)**

If Steps 1–3 surfaced fixes, commit them:
```bash
git add -A
git commit -m "fix(settings): verification fixes for store management section"
```
Otherwise, no commit — the feature is complete at Task 6's commit.

---

## Self-Review (completed during authoring)

- **Spec coverage:** Section + 3 rows (Task 6), Row 1 store-settings drawer (Task 5), Row 2 add drawer (Task 3), Row 3 list drawer with cards (Task 4), scope selector global+stores with mobile bottom-sheet (Tasks 3–5 via `ModernSelect`), backend-unchanged persistence (all containers reuse `useSaveStoreSettingsMutation` with full payload), i18n EN+TR (Task 1), Option-A removal of StoreConfigSection (Task 6), listing groups untouched (Task 6 Step 3d). ✅
- **Placeholders:** none — all code blocks are complete; the two "verify token/icon name" notes include the grep command to resolve them. ✅
- **Type consistency:** `StoreScopeOption` / `buildScopeOptions` / `resolveScopeConfig` / `GLOBAL_SCOPE` defined in Task 2 and consumed identically in Tasks 3–5. `BlacklistScope = 'both'|'title'|'description'` matches `BlacklistCardProps.scope`. Drawer prop names (`isOpen`, `onClose`, `availableStores`, `storeConfigs`) match across types/container/usage. ✅
