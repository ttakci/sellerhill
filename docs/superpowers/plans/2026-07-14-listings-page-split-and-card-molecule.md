# Listings Page Split + ListingCard Molecule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single `/listings` page (slider/full via local `viewMode` state) into two routes — `/listings` (overview, slider) and `/listings/all` (card-grid default + table toggle + filters) — and extract the carousel's compact card into a reusable generic `ListingCard` molecule in `packages/ui`.

**Architecture:** Two separate pages, each with its own container/component/style/types. `viewMode` local state is removed; view is derived from the route. The carousel card and the `/listings/all` grid card both render a new generic `ListingCard` molecule (primitive props, no `@repo/shared` dependency). `ListingCarousel` is split into 4 files and uses the molecule. Existing DataTable built-in `ViewToggle` provides the grid/table toggle on `/listings/all`.

**Tech Stack:** React 18, Vite, RTK Query, Emotion (styled + `tkn()`), react-router v6, i18next. `packages/ui` design system (atoms/molecules/organisms). No test framework is in use — verification is `pnpm typecheck` + `pnpm lint` + manual browser run.

## Global Constraints

- **Frontend rules:** Every feature component is split into `.container.tsx` (logic) / `.component.tsx` (markup, only `useTranslation`/`useTheme`) / `.style.ts` (styled) / `.types.ts` (types). Stateless molecules = `.component.tsx` + `.style.ts` + `.types.ts` + `index.ts` (no container). Enforced by ESLint + PreToolUse hook.
- **No `@repo/shared` dep in `packages/ui`:** The `ListingCard` molecule takes primitive props only. DTO→props mapping happens in feature containers.
- **Tokens only:** No hardcoded hex/rgb/px/rem. All colors/spacing via `tkn('...')`. No inline `style={{}}`. No `styled.h1` etc. — use `<Text>`. No native `<button>`/`<input>`/`<img>` is fine for images (`<img>` is allowed; atoms cover form controls).
- **i18n:** No hardcoded UI strings. Dot notation for primary namespace (`t('listings.x')`), colon for cross-namespace (`t('translation:common.x')`).
- **Enums:** Use `ListingStatus` from `@repo/shared` for status values; never string literals.
- **Verification cycle (no tests):** After each task run `pnpm lint` (must be 0 warnings) and `pnpm typecheck` (must introduce NO NEW errors in touched files — the web app has pre-existing TS errors per CLAUDE.md, so compare against baseline). End with a manual browser run.
- **Commits:** Commit per task. Never use `--no-verify` (pre-commit runs `pnpm lint`). When staging, stage only the files you changed — the working tree has unrelated pre-staged work; do NOT `git add .` or `git add -A`. Use explicit paths.
- **Reference spec:** `docs/superpowers/specs/2026-07-14-listings-page-split-and-card-molecule-design.md`.

---

## File Structure

**New (packages/ui):**
- `packages/ui/src/molecules/ListingCard/ListingCard.types.ts` — generic props (no `ListingDto`).
- `packages/ui/src/molecules/ListingCard/ListingCard.component.tsx` — markup using `Card`, `Text`, `Icon`, `IdBadge`, `Badge`.
- `packages/ui/src/molecules/ListingCard/ListingCard.style.ts` — horizontal + vertical layouts.
- `packages/ui/src/molecules/ListingCard/index.ts` — barrel.

**New (apps/web listings feature):**
- `apps/web/src/features/listings/shared/listings-filter.types.ts` — `ListingsFilterState`, `NumericRange` (moved).
- `apps/web/src/features/listings/carousel/ListingCarousel.{container,component,style,types}.tsx` + `index.ts` — 4-file split, uses `ListingCard`.
- `apps/web/src/features/listings/overview/ListingsOverviewPage.{container,component,style,types}.tsx` + `index.ts`.
- `apps/web/src/features/listings/all/ListingsAllPage.{container,component,style,types}.tsx` + `index.ts`.

**Modified:**
- `packages/ui/src/molecules/index.ts` — `export * from './ListingCard';`
- `packages/ui/src/index.ts` — export `ListingCard` + types.
- `apps/web/src/App.tsx` — add `listings/all` route; swap imports.
- `apps/web/src/features/listings/index.ts` — re-export new pages, drop old.
- `apps/web/src/layouts/AppLayout/AppLayout.component.tsx` — nav `$active` for `/listings/all`.
- `apps/web/src/layouts/AppLayout/AppLayout.container.tsx` — breadcrumb `/listings/all`.
- i18n `packages/shared/src/i18n/resources/{en,tr}/listings.json` — `breadcrumb.allListings`.

**Deleted:**
- `apps/web/src/features/listings/ListingsPage.{container,component,style,types}.tsx`
- `apps/web/src/features/listings/ListingCarousel.tsx`

---

### Task 1: ListingCard molecule (packages/ui)

**Files:**
- Create: `packages/ui/src/molecules/ListingCard/ListingCard.types.ts`
- Create: `packages/ui/src/molecules/ListingCard/ListingCard.component.tsx`
- Create: `packages/ui/src/molecules/ListingCard/ListingCard.style.ts`
- Create: `packages/ui/src/molecules/ListingCard/index.ts`
- Modify: `packages/ui/src/molecules/index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `ListingCard` component, `ListingCardProps`, `ListingCardOrientation`, `ListingCardStat`, `ListingCardBadge`, `ListingCardStatus`, `StatTone` — consumed by Tasks 3, 4, 5.

- [ ] **Step 1: Create `ListingCard.types.ts`**

```ts
import type React from 'react';

export type ListingCardOrientation = 'horizontal' | 'vertical';
export type StatTone = 'default' | 'positive' | 'negative' | 'info';

export interface ListingCardStat {
  label: string;
  value: string;
  tone?: StatTone;
}

export interface ListingCardBadge {
  id: string;
  storeType: 'amazon' | 'ebay';
  size?: 'sm' | 'md';
}

export interface ListingCardStatus {
  label: string;
  tone: 'active' | 'neutral';
}

export interface ListingCardProps {
  title: string;
  imageUrl?: string;
  brand?: string;
  primaryBadge?: ListingCardBadge;
  secondaryBadge?: ListingCardBadge;
  stats: ListingCardStat[];
  status: ListingCardStatus;
  soldCount?: number;
  watchCount?: number;
  orientation: ListingCardOrientation;
  onClick?: () => void;
  className?: string;
}
```

- [ ] **Step 2: Create `ListingCard.style.ts`**

Two layouts driven by `$orientation`. Image is fixed-width (horizontal) or top 16:9 (vertical). Stats render in a grid row. Footer holds sold/watch extras + status badge.

```ts
import styled from '@emotion/styled';

import { Card } from '../../atoms/Card';
import { Text } from '../../atoms/Text';
import { tkn } from '../../theme/tkn';

import type { ListingCardOrientation, StatTone } from './ListingCard.types';

export const Wrapper = styled(Card)<{ $orientation: ListingCardOrientation }>`
  padding: ${tkn('spacing.lg')};
  display: flex;
  gap: ${tkn('spacing.lg')};
  height: 100%;
  width: 100%;
  border: none;
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `flex-direction: row; align-items: stretch;`
      : `flex-direction: column;`}

  &:hover {
    border: none;
  }
`;

export const Image = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `width: 8.5rem; height: 8.5rem;`
      : `width: 100%; aspect-ratio: 16 / 9; border: 0.0625rem solid ${tkn('colors.border.secondary')};`}

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }
`;

export const Content = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
  ${({ $orientation }) => ($orientation === 'horizontal' ? '' : 'min-height: 0;')}
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const Brand = styled(Text)``;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  align-items: center;
`;

export const ExtraFields = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ExtraItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.xs+')};
  margin-top: ${tkn('spacing.xs')};
`;

export const StatCell = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
`;

export const StatValue = styled(Text)<{ $tone: StatTone }>`
  color: ${({ $tone, theme }) => {
    const t = theme as import('@emotion/react').Theme & {
      colors: { semantic: { success: string; info: string; danger: string; text?: never } };
    };
    if ($tone === 'positive') return t.colors.semantic.success;
    if ($tone === 'negative') return t.colors.semantic.danger;
    if ($tone === 'info') return t.colors.semantic.info;
    return t.colors.text.primary;
  }};
`;

export const Footer = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.sm')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;
```

> **Note for implementer:** If `theme.colors.semantic.danger` does not exist (verify in `packages/ui/src/theme/theme.types.ts`), use `t.colors.semantic.error` instead. Check the `ThemeColors.semantic` keys before finalizing and pick the existing negative-tone key. The positive key is `success`, the info key is `info`.

- [ ] **Step 3: Create `ListingCard.component.tsx`**

```tsx
import React from 'react';

import { Badge } from '../../atoms/Badge';
import { Icon } from '../../atoms/Icon';
import { IdBadge } from '../../molecules/IdBadge';
import { Text } from '../../atoms/Text';

import * as S from './ListingCard.style';
import type { ListingCardProps } from './ListingCard.types';

export const ListingCard = ({
  title,
  imageUrl,
  brand,
  primaryBadge,
  secondaryBadge,
  stats,
  status,
  soldCount,
  watchCount,
  orientation,
  onClick,
  className,
}: ListingCardProps): React.ReactElement => {
  const hasExtras = (soldCount ?? 0) > 0 || (watchCount ?? 0) > 0;
  const statusVariant = status.tone === 'active' ? 'success' : 'neutral';

  return (
    <S.Wrapper $orientation={orientation} onClick={onClick} className={className}>
      <S.Image $orientation={orientation}>
        {imageUrl ? <img src={imageUrl} alt={title} /> : <Icon name="image" size={orientation === 'horizontal' ? 32 : 48} />}
      </S.Image>
      <S.Content $orientation={orientation}>
        <S.Title variant="body-sm" weight="semibold">
          {title}
        </S.Title>
        {brand && (
          <S.Brand variant="caption" color="text.tertiary">
            {brand}
          </S.Brand>
        )}
        {(primaryBadge || secondaryBadge) && (
          <S.BadgeRow>
            {primaryBadge && <IdBadge id={primaryBadge.id} storeType={primaryBadge.storeType} size={primaryBadge.size ?? 'sm'} />}
            {secondaryBadge && (
              <IdBadge id={secondaryBadge.id} storeType={secondaryBadge.storeType} size={secondaryBadge.size ?? 'sm'} />
            )}
          </S.BadgeRow>
        )}
        {hasExtras && (
          <S.ExtraFields>
            {(soldCount ?? 0) > 0 && (
              <S.ExtraItem>
                <Icon name="shopping-cart" size={12} />
                <Text variant="caption">{soldCount}</Text>
              </S.ExtraItem>
            )}
            {(watchCount ?? 0) > 0 && (
              <S.ExtraItem>
                <Icon name="visibility" size={12} />
                <Text variant="caption">{watchCount}</Text>
              </S.ExtraItem>
            )}
          </S.ExtraFields>
        )}
        <S.StatsGrid>
          {stats.map((stat) => (
            <S.StatCell key={stat.label}>
              <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">
                {stat.label}
              </S.StatLabel>
              <S.StatValue variant="body-sm" weight="bold" $tone={stat.tone ?? 'default'}>
                {stat.value}
              </S.StatValue>
            </S.StatCell>
          ))}
        </S.StatsGrid>
        <S.Footer>
          <Badge variant={statusVariant} size="sm">
            {status.label}
          </Badge>
        </S.Footer>
      </S.Content>
    </S.Wrapper>
  );
};

ListingCard.displayName = 'ListingCard';
```

- [ ] **Step 4: Create `index.ts`**

```ts
export { ListingCard } from './ListingCard.component';
export type {
  ListingCardBadge,
  ListingCardOrientation,
  ListingCardProps,
  ListingCardStat,
  ListingCardStatus,
  StatTone,
} from './ListingCard.types';
```

- [ ] **Step 5: Export from molecule barrel**

In `packages/ui/src/molecules/index.ts` add (alphabetical position, after `LanguageSwitcher` is fine — just append a sorted line near `IdBadge`):

```ts
export * from './ListingCard';
```

- [ ] **Step 6: Export from package barrel**

In `packages/ui/src/index.ts`, after the `IdBadge` export block (around line 155–156), add:

```ts
export { ListingCard } from './molecules/ListingCard';
export type {
  ListingCardBadge,
  ListingCardOrientation,
  ListingCardProps,
  ListingCardStat,
  ListingCardStatus,
  StatTone,
} from './molecules/ListingCard';
```

- [ ] **Step 7: Build packages + verify**

Run: `pnpm build` (builds packages so apps can resolve the new export).
Then: `pnpm lint` — expected: 0 warnings.
Then: `pnpm typecheck` — expected: no NEW errors in `packages/ui/src/molecules/ListingCard/*` (pre-existing web errors are OK).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/molecules/ListingCard packages/ui/src/molecules/index.ts packages/ui/src/index.ts
git commit -m "feat(ui): add ListingCard molecule (generic, horizontal/vertical)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Shared filter types

**Files:**
- Create: `apps/web/src/features/listings/shared/listings-filter.types.ts`
- (Consumers updated in Tasks 4 & 5; old `ListingsPage.types.ts` deleted in Task 7.)

**Interfaces:**
- Produces: `ListingsFilterState`, `NumericRange` — consumed by Task 5 (`all` page container).

- [ ] **Step 1: Create the shared types file**

```ts
export interface NumericRange {
  min: string;
  max: string;
}

export interface ListingsFilterState {
  search: string;
  category: string;
  status: string;
  price: NumericRange;
  purchasePrice: NumericRange;
  estimatedProfit: NumericRange;
  roi: NumericRange;
  profitMargin: NumericRange;
  soldCount: NumericRange;
  watchCount: NumericRange;
  viewCount: NumericRange;
  quantity: NumericRange;
  sourceStock: NumericRange;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/listings/shared/listings-filter.types.ts
git commit -m "feat(listings): shared listings-filter types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: ListingCarousel 4-file split (uses ListingCard)

**Files:**
- Create: `apps/web/src/features/listings/carousel/ListingCarousel.types.ts`
- Create: `apps/web/src/features/listings/carousel/ListingCarousel.style.ts`
- Create: `apps/web/src/features/listings/carousel/ListingCarousel.component.tsx`
- Create: `apps/web/src/features/listings/carousel/ListingCarousel.container.tsx`
- Create: `apps/web/src/features/listings/carousel/index.ts`

**Interfaces:**
- Consumes: `ListingCard` (Task 1), `ListingDto` from `@repo/shared`.
- Produces: `ListingCarousel` component (props: `listings`, `onViewAll`, `viewAllLabel`, `showViewAll`) — consumed by Task 4 (overview).

- [ ] **Step 1: Create `ListingCarousel.types.ts`**

```ts
import type { ListingDto } from '@repo/shared';

export interface ListingCarouselProps {
  listings: ListingDto[];
  onViewAll: () => void;
  viewAllLabel: string;
  showViewAll: boolean;
}
```

- [ ] **Step 2: Create `ListingCarousel.style.ts`**

Move the carousel-mechanism styles (NOT the `Compact*` card styles — those are gone, replaced by the molecule). Source: `apps/web/src/features/listings/ListingsPage.style.ts` lines 531–683 (`CarouselWrapper`, `CarouselViewport`, `CarouselSlide`, `CarouselArrow`, `CarouselPagination`, `PaginationDot`, `CarouselTopBar`, `SliderEmpty`, `SliderEmptyText`). Copy verbatim into this file. Also add `ViewAllButton` here (copied from `ListingsPage.style.ts` lines 332–347 but **with the hover `text-decoration: underline;` line removed** — see CSS fix):

```ts
import styled from '@emotion/styled';

import { Text } from '@repo/ui';
// NOTE: feature style files import Text from '@repo/ui (see existing ListingsPage.style.ts header for the alias used).
// Use the SAME Text import + AppTheme import pattern as ListingsPage.style.ts. Copy those header imports verbatim.
```

`ViewAllButton` (underline removed):

```ts
export const ViewAllButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.brand.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-family: ${tkn('typography.fontFamily.body')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primaryHover')};
  }
`;
```

Also add `SliderEmptyText = styled(Text)``;` (matches original).

> **Implementer note:** Open `apps/web/src/features/listings/ListingsPage.style.ts`, copy the exact import header (the `tkn`, `AppTheme`, `UIText`/`Text` imports) and the styled components named above verbatim. Do NOT copy `CompactCard` or any `Compact*` styles.

- [ ] **Step 3: Create `ListingCarousel.component.tsx`**

Markup only. Renders one `ListingCard orientation="horizontal"` per recent listing in the viewport, plus arrows + pagination dots + the View All button. Maps `ListingDto` → `ListingCardProps` inline (presentation-only mapping is allowed since it's pure derivation with no hooks; if the linter complains, move mapping into the container and pass pre-mapped `cards: ListingCardProps[]`).

```tsx
import type { ListingDto } from '@repo/shared';
import { Icon, IdBadge, ListingCard, type ListingCardProps } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingCarousel.style';
import type { ListingCarouselProps } from './ListingCarousel.types';

export const ListingCarouselComponent: React.FC<ListingCarouselProps> = ({
  listings,
  onViewAll,
  viewAllLabel,
  showViewAll,
  currentSlide,
  onNext,
  onPrev,
  onGoTo,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  if (listings.length === 0) {
    return (
      <S.SliderEmpty>
        <Icon name="inventory" size={40} />
        <S.SliderEmptyText variant="body" weight="semibold">
          {t('listings.overview.emptyTitle')}
        </S.SliderEmptyText>
        <S.SliderEmptyText variant="body-sm" color="text.tertiary">
          {t('listings.overview.emptySubtitle')}
        </S.SliderEmptyText>
      </S.SliderEmpty>
    );
  }

  return (
    <S.CarouselWrapper>
      {showViewAll && (
        <S.CarouselTopBar>
          <S.ViewAllButton onClick={onViewAll}>{viewAllLabel}</S.ViewAllButton>
        </S.CarouselTopBar>
      )}
      <S.CarouselViewport>
        {listings.map((listing, index) => {
          const slideClass = index === currentSlide ? 'active' : index < currentSlide ? 'prev' : '';
          const card = toCardProps(listing, t);
          return (
            <S.CarouselSlide key={listing.id} className={slideClass} $isActive={index === currentSlide}>
              <ListingCard {...card} orientation="horizontal" />
            </S.CarouselSlide>
          );
        })}
      </S.CarouselViewport>
      {currentSlide > 0 && (
        <S.CarouselArrow $side="left" className="carousel-arrow" onClick={onPrev} aria-label="Previous">
          <Icon name="chevron-left" size={20} />
        </S.CarouselArrow>
      )}
      {currentSlide < listings.length - 1 && (
        <S.CarouselArrow $side="right" className="carousel-arrow" onClick={onNext} aria-label="Next">
          <Icon name="chevron-right" size={20} />
        </S.CarouselArrow>
      )}
      {listings.length > 1 && (
        <S.CarouselPagination>
          {listings.map((_, index) => (
            <S.PaginationDot key={index} $active={index === currentSlide} onClick={() => onGoTo(index)} />
          ))}
        </S.CarouselPagination>
      )}
    </S.CarouselWrapper>
  );
};
```

DTO→props mapping helper (pure function, lives in the component file or a `listingCardProps.ts` util — keep in component file for simplicity):

```ts
const toCardProps = (listing: ListingDto, t: (k: string) => string): ListingCardProps => {
  const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
  const profit = listing.estimatedProfit ?? 0;
  const roi = listing.roi ?? 0;
  return {
    title,
    imageUrl: listing.imageUrls?.[0],
    brand: listing.brand,
    primaryBadge: { id: listing.asin, storeType: 'amazon' },
    secondaryBadge: listing.ebayListingId ? { id: listing.ebayListingId, storeType: 'ebay' } : undefined,
    soldCount: listing.soldCount,
    watchCount: listing.watchCount,
    stats: [
      { label: t('listings.table.estimatedProfit'), value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, tone: profit >= 0 ? 'positive' : 'negative' },
      { label: t('listings.table.roi'), value: roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—', tone: roi >= 0 ? 'positive' : 'negative' },
      { label: t('listings.table.stock'), value: String(listing.quantity), tone: listing.quantity === 0 ? 'negative' : 'default' },
    ],
    status: { label: t(`listings.status.${listing.status.toLowerCase()}`), tone: 'active' },
  };
};
```

> **Note:** The component now takes `currentSlide`, `onNext`, `onPrev`, `onGoTo` as extra props from the container. Update `ListingCarousel.types.ts` to add these to the props interface (the container passes them). Add to `ListingCarouselProps`:

```ts
  currentSlide: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
```

- [ ] **Step 4: Create `ListingCarousel.container.tsx`**

Owns the slide state + recent-listings derivation. Passes everything to the component.

```tsx
import type { ListingDto } from '@repo/shared';
import React, { useCallback, useMemo, useState } from 'react';

import { ListingCarouselComponent } from './ListingCarousel.component';
import type { ListingCarouselProps } from './ListingCarousel.types';

export const ListingCarousel: React.FC<ListingCarouselProps> = ({ listings, onViewAll, viewAllLabel, showViewAll }) => {
  const recentListings = useMemo(
    () => [...listings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3),
    [listings]
  );

  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => setCurrentSlide(index), []);
  const nextSlide = useCallback(
    () => setCurrentSlide((prev) => Math.min(prev + 1, recentListings.length - 1)),
    [recentListings.length]
  );
  const prevSlide = useCallback(() => setCurrentSlide((prev) => Math.max(prev - 1, 0)), []);

  return (
    <ListingCarouselComponent
      listings={recentListings}
      onViewAll={onViewAll}
      viewAllLabel={viewAllLabel}
      showViewAll={showViewAll}
      currentSlide={currentSlide}
      onNext={nextSlide}
      onPrev={prevSlide}
      onGoTo={goToSlide}
    />
  );
};
```

- [ ] **Step 5: Create `index.ts`**

```ts
export { ListingCarousel } from './ListingCarousel.container';
```

- [ ] **Step 6: Verify**

Run: `pnpm lint`, `pnpm typecheck` (no NEW errors in the new carousel files).
Note: the old `ListingCarousel.tsx` still exists and is still imported by the old `ListingsPage` — that's fine until Task 7. Do not delete yet.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/listings/carousel
git commit -m "feat(listings): split ListingCarousel into 4 files using ListingCard molecule

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: ListingsOverviewPage (slider + actions + add drawer)

**Files:**
- Create: `apps/web/src/features/listings/overview/ListingsOverviewPage.types.ts`
- Create: `apps/web/src/features/listings/overview/ListingsOverviewPage.style.ts`
- Create: `apps/web/src/features/listings/overview/ListingsOverviewPage.component.tsx`
- Create: `apps/web/src/features/listings/overview/ListingsOverviewPage.container.tsx`
- Create: `apps/web/src/features/listings/overview/index.ts`

**Interfaces:**
- Consumes: `ListingCarousel` (Task 3), `AddListingsDrawer` (`features/listings/add-listings/drawer`), `useGetListingsQuery` (`features/listings/api/listings.api`), `EbayAccountGuard` (`@/components/EbayAccountGuard`), `useLocale` (`@/utils/useLocale`).
- Produces: `ListingsOverviewPage` — consumed by Task 6 (router).

- [ ] **Step 1: Create `ListingsOverviewPage.types.ts`**

```ts
import type { ListingDto, ListingJobDto } from '@repo/shared';

export interface ListingsOverviewPageProps {
  listings: ListingDto[];
  isAddDrawerOpen: boolean;
  onAddListing: () => void;
  onAddDrawerClose: () => void;
  onViewAll: () => void;
  onViewJobs: () => void;
}
```

- [ ] **Step 2: Create `ListingsOverviewPage.style.ts`**

Move from `ListingsPage.style.ts`: `TwoColumnLayout`, `SliderColumn`, `SliderContent`, `AddColumn`, `AddCardStack` (with the `.other-actions-card { flex: 1; min-height: 0; }` rule). Copy verbatim with their import header. Also keep `Container` (the page wrapper, if present in original — copy it).

> **Implementer note:** Open `apps/web/src/features/listings/ListingsPage.style.ts`, copy its import header and the named styled components above verbatim into this file. Leave the `Compact*` styles behind (they're gone). Leave `Carousel*` styles behind (moved in Task 3). Leave filter/table styles behind (move to `all` page in Task 5).

- [ ] **Step 3: Create `ListingsOverviewPage.component.tsx`**

Markup only. `PageHeader` (title `listings.overview.title`, subtitle `listings.overview.subtitle` with count = `listings.length`, actions = "Add New Listing" primary button) + `TwoColumnLayout` (carousel left, QuickActionCard + SettingsCard right). Only `useTranslation` hook.

```tsx
import { Button, Icon, PageHeader, QuickActionCard, SettingsActionRow, SettingsCard, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListingCarousel } from '../carousel';
import * as S from './ListingsOverviewPage.style';
import type { ListingsOverviewPageProps } from './ListingsOverviewPage.types';

export const ListingsOverviewPageComponent: React.FC<ListingsOverviewPageProps> = ({
  listings,
  isAddDrawerOpen,
  onAddListing,
  onAddDrawerClose,
  onViewAll,
  onViewJobs,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: listings.length })}
        actions={
          <Button variant="primary" onClick={onAddListing}>
            <Text>{t('listings.actions.addNewList')}</Text>
          </Button>
        }
      />
      <S.TwoColumnLayout>
        <S.SliderColumn>
          <S.SliderContent>
            <ListingCarousel
              listings={listings}
              onViewAll={onViewAll}
              viewAllLabel={t('listings.actions.viewAll')}
              showViewAll={listings.length > 3}
            />
          </S.SliderContent>
        </S.SliderColumn>
        <S.AddColumn>
          <S.AddCardStack>
            <QuickActionCard
              variant="brand"
              title={t('listings.addSection.title')}
              subtitle={t('listings.addSection.subtitle')}
              onClick={onAddListing}
            />
            <SettingsCard variant="section" className="other-actions-card" header={{ title: t('listings.otherActions.title') }}>
              <SettingsActionRow
                label={t('listings.otherActions.jobsTitle')}
                subtitle={t('listings.otherActions.jobsSubtitle')}
                onClick={onViewJobs}
              />
            </SettingsCard>
          </S.AddCardStack>
        </S.AddColumn>
      </S.TwoColumnLayout>
    </S.Container>
  );
};
```

> `Icon` import is unused above — remove it from the import list if the linter flags it. (Kept for parity; remove if unused.)

- [ ] **Step 4: Create `ListingsOverviewPage.container.tsx`**

Logic only. Fetch listings, own add drawer, handlers. `onViewAll` → `localeNavigate('/listings/all')`. `onViewJobs` → `localeNavigate('/listings/jobs')`. `handleAddSuccess` → `localeNavigate('/listings/jobs')`. Wrap in `EbayAccountGuard` + render `AddListingsDrawer`.

```tsx
import { useGetListingsQuery } from '../api/listings.api';
import { AddListingsDrawer } from '../add-listings/drawer';
import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';
import { useUI } from '@repo/ui';
import React, { useState } from 'react';

export const ListingsOverviewPage: React.FC = () => {
  const { localeNavigate } = useLocale();
  const { data: listings = [], isLoading } = useGetListingsQuery(undefined, { refetchOnMountOrArgChange: true });
  useUI(); // ensures UI context wiring parity (optional — remove if unused)

  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  // loading handled globally via useLoading in the original; replicate:
  // import { useLoading } from '@repo/ui'; const { } = useLoading(isLoading);

  return (
    <EbayAccountGuard>
      <ListingsOverviewPageComponent
        listings={listings}
        isAddDrawerOpen={isAddDrawerOpen}
        onAddListing={() => setIsAddDrawerOpen(true)}
        onAddDrawerClose={() => setIsAddDrawerOpen(false)}
        onViewAll={() => localeNavigate('/listings/all')}
        onViewJobs={() => localeNavigate('/listings/jobs')}
      />
      <AddListingsDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onSuccess={() => localeNavigate('/listings/jobs')}
      />
    </EbayAccountGuard>
  );
};
```

> **Implementer note:** Mirror the loading pattern from the original `ListingsPage.container.tsx`: `import { useLoading, useUI } from '@repo/ui';` and `useLoading(isLoading);`. Drop the unused `useUI()` call above and use `useLoading(isLoading)` instead. Keep imports clean — `pnpm lint` (max-warnings 0) will fail on unused imports.

- [ ] **Step 5: Create `index.ts`**

```ts
export { ListingsOverviewPage } from './ListingsOverviewPage.container';
```

- [ ] **Step 6: Verify**

Run: `pnpm lint`, `pnpm typecheck` (no NEW errors in overview files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/listings/overview
git commit -m "feat(listings): add ListingsOverviewPage (/listings)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: ListingsAllPage (filters + DataTable grid-default + table toggle)

**Files:**
- Create: `apps/web/src/features/listings/all/ListingsAllPage.types.ts`
- Create: `apps/web/src/features/listings/all/ListingsAllPage.style.ts`
- Create: `apps/web/src/features/listings/all/ListingsAllPage.component.tsx`
- Create: `apps/web/src/features/listings/all/ListingsAllPage.container.tsx`
- Create: `apps/web/src/features/listings/all/index.ts`

**Interfaces:**
- Consumes: `ListingsFilterState` (Task 2), `ListingCard` (Task 1), `DataTable`/`ViewMode` (`@repo/ui`), `useGetListingsQuery`, `useEndListingsMutation`, `useDeleteListingsMutation` (`features/listings/api/listings.api`), `EbayAccountGuard`.
- Produces: `ListingsAllPage` — consumed by Task 6 (router).

- [ ] **Step 1: Create `ListingsAllPage.types.ts`**

Copy the full `ListingsPageProps` interface from `apps/web/src/features/listings/ListingsPage.types.ts` (lines 27–79), but:
- Remove `onViewAll`, `viewMode`, `onAddListing`, `isAddDrawerOpen`, `onAddDrawerClose`, `onEndListings` (not used here — add flow is overview-only; `onEndListings` was unused in the component anyway).
- Add `tableView: ViewMode;` and `onTableViewChange: (mode: ViewMode) => void;` (import `ViewMode` from `@repo/ui`).
- Keep `ListingsViewMode` type OUT (deleted). Import `ListingsFilterState`/`NumericRange` from `../shared/listings-filter.types`.

```ts
import type { ListingDto } from '@repo/shared';
import { type BulkAction, type TableColumn, type ViewMode } from '@repo/ui';

export interface ListingsAllPageProps {
  listings: ListingDto[];
  onSelectionChange: (ids: string[]) => void;
  columns: TableColumn<ListingDto>[];
  selectedRows: ListingDto[];
  bulkActions?: BulkAction<ListingDto>[];
  onDownload?: () => void;
  tableView: ViewMode;
  onTableViewChange: (mode: ViewMode) => void;
  pagination: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  columnOptions: { key: string; label: string; alwaysVisible?: boolean }[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  filters: import('../shared/listings-filter.types').ListingsFilterState;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCategoryChange: (value: string | number) => void;
  categoryOptions: { value: string | number; label: string }[];
  onStatusChange: (value: string | number) => void;
  statusOptions: { value: string | number; label: string }[];
  numericFilters: {
    key: string;
    label: string;
    min: string;
    max: string;
    onMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
}
```

- [ ] **Step 2: Create `ListingsAllPage.style.ts`**

Move from `ListingsPage.style.ts`: `Container`, `FilterBarWrapper`, `FilterBar`, `FilterBarRow`, `SearchWrapper`, `SelectWrapper`, `FilterActions`, `ResultCount`, `AdvancedDivider`, `AdvancedHeader`, `NumericFilterGrid`, `NumericFilterField`, `NumericFilterLabel`, `NumericRangeRow`, `RangeSeparator`, `MetricValue`, `StatMain`, `CompactText`, `ProductCell`, `ProductImageWrapper`, `ProductImage`, `ProductMainInfo`, `ProductTitle`, `ProductBrand`, `ProductMeta`, `StockValue`, `StatusBadge`, `StockLabel`, `StockInfo` — i.e. every styled component still referenced by the filter bar, the table column `render` functions, and the grid card. Copy verbatim with the import header.

> **Implementer note:** The table column `render` functions (moved into the container in Step 4) reference many of these (`ProductCell`, `MetricValue`, `StatusBadge`, etc.). Copy ALL styled components that those `render` functions reference. The grid card no longer uses `ListingCard`/`CardStatsRow`/`StatItem` etc. (those are replaced by the `ListingCard` molecule), so you can drop the old `ListingCard`, `CardImageSection`, `CardContent`, `CardTitleRow`, `CardTitle`, `CardBrand`, `CardBadgeRow`, `CardStatsRow`, `StatItem`, `StatLabel`, `StatValue`, `CardFooter`, `StockInfo`, `StockLabel` ONLY IF nothing else references them. To be safe, copy them too — unused styled exports are not a lint error; dead code can be pruned in a follow-up. Prefer copying too much over breaking a `render`.

- [ ] **Step 3: Create `ListingsAllPage.component.tsx`**

Markup only. `PageHeader` (title + subtitle count, **no actions**) + filter bar + `DataTable` with `viewMode={tableView}`, `onViewModeChange={onTableViewChange}`, and a `renderGridCard` that renders `<ListingCard orientation="vertical" />`.

```tsx
import type { ListingDto } from '@repo/shared';
import {
  Button,
  DataTable,
  Icon,
  ListingCard,
  type ListingCardProps,
  SearchField,
  Select,
  Text,
  TextInput,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingsAllPage.style';
import type { ListingsAllPageProps } from './ListingsAllPage.types';

export const ListingsAllPageComponent: React.FC<ListingsAllPageProps> = ({
  listings,
  onSelectionChange,
  columns,
  selectedRows,
  bulkActions,
  onDownload,
  tableView,
  onTableViewChange,
  pagination,
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  sortColumn,
  sortDirection,
  onSort,
  filters,
  onSearchChange,
  onCategoryChange,
  categoryOptions,
  onStatusChange,
  statusOptions,
  numericFilters,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  advancedOpen,
  onToggleAdvanced,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (listing: ListingDto) => {
    const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
    const profit = listing.estimatedProfit ?? 0;
    const roi = listing.roi ?? 0;
    const card: ListingCardProps = {
      title,
      imageUrl: listing.imageUrls?.[0],
      brand: listing.brand,
      primaryBadge: { id: listing.asin, storeType: 'amazon' },
      secondaryBadge: listing.ebayListingId ? { id: listing.ebayListingId, storeType: 'ebay' } : undefined,
      soldCount: listing.soldCount,
      watchCount: listing.watchCount,
      stats: [
        { label: t('listings.table.price'), value: `$${listing.price.toFixed(2)}` },
        { label: t('listings.table.estimatedProfit'), value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, tone: profit >= 0 ? 'positive' : 'negative' },
        { label: t('listings.table.roi'), value: roi !== null ? `${roi.toFixed(1)}%` : '—', tone: roi >= 0 ? 'positive' : 'negative' },
      ],
      status: { label: t(`listings.status.${listing.status.toLowerCase()}`), tone: 'active' },
    };
    return <ListingCard key={listing.id} {...card} orientation="vertical" />;
  };

  return (
    <S.Container>
      <PageHeader title={t('listings.overview.title')} subtitle={t('listings.overview.subtitle', { count: resultCount })} />
      <S.FilterBarWrapper>
        <S.FilterBar>
          <S.FilterBarRow>
            <S.SearchWrapper>
              <SearchField value={filters.search} onChange={onSearchChange} placeholder={t('listings.filters.searchPlaceholder')} size="medium" />
            </S.SearchWrapper>
            <S.SelectWrapper>
              <Select value={filters.category} onChange={onCategoryChange} options={categoryOptions} placeholder={t('listings.filters.allCategories')} size="small" fullWidth />
            </S.SelectWrapper>
            <S.SelectWrapper>
              <Select value={filters.status} onChange={onStatusChange} options={statusOptions} placeholder={t('listings.filters.allStatuses')} size="small" fullWidth />
            </S.SelectWrapper>
            <S.FilterActions>
              <S.ResultCount variant="body-sm" color="text.tertiary">
                {t('listings.filters.resultCount', { count: resultCount })}
              </S.ResultCount>
              {hasActiveFilters && (
                <Button variant="text" size="small" onClick={onClearFilters}>
                  <Text>{t('listings.filters.clearAll')}</Text>
                </Button>
              )}
            </S.FilterActions>
          </S.FilterBarRow>
          <S.AdvancedDivider />
          <S.AdvancedHeader $isOpen={advancedOpen} onClick={onToggleAdvanced}>
            <Icon name="sliders-horizontal" size={16} />
            {t('listings.filters.advancedFilters')}
            <Icon name="chevron-down" size={16} />
          </S.AdvancedHeader>
          {advancedOpen && (
            <S.NumericFilterGrid>
              {numericFilters.map((field) => (
                <S.NumericFilterField key={field.key}>
                  <S.NumericFilterLabel variant="caption" weight="medium" color="text.secondary">
                    {field.label}
                  </S.NumericFilterLabel>
                  <S.NumericRangeRow>
                    <TextInput name={`${field.key}-min`} value={field.min} onChange={field.onMinChange} placeholder={t('listings.filters.min')} type="number" size="small" fullWidth />
                    <S.RangeSeparator variant="body-sm" color="text.tertiary">-</S.RangeSeparator>
                    <TextInput name={`${field.key}-max`} value={field.max} onChange={field.onMaxChange} placeholder={t('listings.filters.max')} type="number" size="small" fullWidth />
                  </S.NumericRangeRow>
                </S.NumericFilterField>
              ))}
            </S.NumericFilterGrid>
          )}
        </S.FilterBar>
      </S.FilterBarWrapper>
      <DataTable
        columns={columns}
        data={listings}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={(rows) => onSelectionChange(rows.map((r) => r.id))}
        emptyMessage={t('listings.overview.emptyTitle')}
        bulkActions={bulkActions}
        bulkActionsPlaceholder={t('listings.actions.bulkActions')}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        columnManagerLabel={t('translation:common.actions.filter')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.Container>
  );
};
```

> `PageHeader` import must be added to the `@repo/ui` import list (it is used). Ensure all used UI atoms are imported.

- [ ] **Step 4: Create `ListingsAllPage.container.tsx`**

Copy the logic from `apps/web/src/features/listings/ListingsPage.container.tsx` lines 1–736 with these deltas:

1. **Imports:** replace `import type { ListingsFilterState, ListingsViewMode } from './ListingsPage.types';` with `import type { ListingsFilterState } from '../shared/listings-filter.types';`. Replace `import { ListingsPageComponent } from './ListingsPage.component';` with `import { ListingsAllPageComponent } from './ListingsAllPage.component';`. Replace `import * as S from './ListingsPage.style';` with `import * as S from './ListingsAllPage.style';`. Add `import { type ViewMode } from '@repo/ui';`.
2. **Remove** the add-drawer state and handlers (`isAddDrawerOpen`, `handleAddListing`, `handleAddDrawerClose`, `handleAddSuccess`, the `<AddListingsDrawer />` render, the `AddListingsDrawer` import). Add flow is overview-only.
3. **Remove** `viewMode`/`setViewMode` state and `handleViewAll`.
4. **Add** `const [tableView, setTableView] = useState<ViewMode>('grid');` (default `'grid'`).
5. **Remove** `onAddListing`, `onViewAll`, `viewMode`, `isAddDrawerOpen`, `onAddDrawerClose`, `onEndListings` from the `<ListingsAllPageComponent ... />` props. **Add** `tableView={tableView}` and `onTableViewChange={setTableView}`.
6. Keep everything else verbatim: `DEFAULT_FILTERS`, filters, sort, pagination, columns (`allColumns`/`filteredColumns`), selection, bulk actions, CSV download, category/status options, numeric filters, `useGetListingsQuery`, `useEndListingsMutation`, `useDeleteListingsMutation`, success effects, `EbayAccountGuard` wrapper.

The return JSX becomes:

```tsx
return (
  <EbayAccountGuard>
    <ListingsAllPageComponent
      listings={paginatedListings}
      onSelectionChange={setSelectedListingIds}
      columns={filteredColumns}
      selectedRows={selectedRows}
      bulkActions={bulkActions}
      onDownload={handleDownload}
      tableView={tableView}
      onTableViewChange={setTableView}
      pagination={{
        count: filteredListings.length,
        page,
        rowsPerPage,
        onPageChange: setPage,
        onRowsPerPageChange: (val) => { setRowsPerPage(val); setPage(1); },
        labelRowsPerPage: t('translation:common.rowsPerPage'),
        labelInfo: t('translation:common.showing_info'),
      }}
      columnOptions={columnOptions}
      visibleColumnKeys={visibleColumnKeys}
      onToggleColumn={toggleColumn}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={handleSort}
      filters={filters}
      onSearchChange={handleSearchChange}
      onCategoryChange={handleCategoryChange}
      categoryOptions={categoryOptions}
      onStatusChange={handleStatusChange}
      statusOptions={statusOptions}
      numericFilters={numericFilters}
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      resultCount={filteredListings.length}
      advancedOpen={advancedOpen}
      onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
    />
  </EbayAccountGuard>
);
```

- [ ] **Step 5: Create `index.ts`**

```ts
export { ListingsAllPage } from './ListingsAllPage.container';
```

- [ ] **Step 6: Verify**

Run: `pnpm lint`, `pnpm typecheck` (no NEW errors in `all` files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/listings/all
git commit -m "feat(listings): add ListingsAllPage (/listings/all) with card-grid default + table toggle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Routing + nav active + breadcrumb + i18n

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/listings/index.ts`
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.component.tsx`
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.container.tsx`
- Modify: `packages/shared/src/i18n/resources/en/listings.json`
- Modify: `packages/shared/src/i18n/resources/tr/listings.json`

- [ ] **Step 1: Update `apps/web/src/features/listings/index.ts`**

Replace the `ListingsPage` re-export with the two new pages. Remove any `export { ListingsPage }` line and the `ListingCarousel` re-export if present (carousel is now internal to overview). Add:

```ts
export { ListingsOverviewPage } from './overview';
export { ListingsAllPage } from './all';
```

Keep the existing `AddListingsPage`, `ListingJobsPage`, `ListingJobDetailsPage`, `ProductsPage` exports.

- [ ] **Step 2: Update `apps/web/src/App.tsx`**

Change the import (line 13–19) from `ListingsPage` to the two new pages:

```ts
import {
  AddListingsPage,
  ListingAllPage,
  ListingJobDetailsPage,
  ListingJobsPage,
  ListingsOverviewPage,
  ProductsPage,
} from './features/listings';
```

> Fix the name to `ListingsAllPage` (not `ListingAllPage`) — match the export from Step 1.

Replace the route block (lines 55–59):

```tsx
<Route path="listings" element={<ListingsOverviewPage />} />
<Route path="listings/all" element={<ListingsAllPage />} />
<Route path="listings/jobs" element={<ListingJobsPage />} />
<Route path="listings/jobs/:jobId" element={<ListingJobDetailsPage />} />
<Route path="listings/products" element={<ProductsPage />} />
<Route path="listings/add" element={<AddListingsPage />} />
```

- [ ] **Step 3: Nav active state — `apps/web/src/layouts/AppLayout/AppLayout.component.tsx`**

Find the "eBay Listeleri" `NavItem` (around line 69). Change:

```tsx
$active={pathWithoutLocale === '/listings'}
```

to:

```tsx
$active={pathWithoutLocale === '/listings' || pathWithoutLocale === '/listings/all'}
```

- [ ] **Step 4: Breadcrumb — `apps/web/src/layouts/AppLayout/AppLayout.container.tsx`**

In the `breadcrumbItems` `useMemo` (around lines 78–88), inside the `pathWithoutLocale.startsWith('/listings')` branch, add a case for `/listings/all`:

```ts
if (pathWithoutLocale.startsWith('/listings')) {
  items.push({ label: t('translation:menu.listings'), path: '/listings' });
  if (pathWithoutLocale === '/listings/jobs') {
    items.push({ label: t('translation:menu.listingJobs') });
  } else if (pathWithoutLocale === '/listings/products') {
    items.push({ label: t('translation:menu.products') });
  } else if (pathWithoutLocale === '/listings/add') {
    items.push({ label: t('listings:listings.breadcrumb.addProducts') });
  } else if (pathWithoutLocale === '/listings/all') {
    items.push({ label: t('listings:listings.breadcrumb.allListings') });
  } else if (pathWithoutLocale === '/listings') {
    items.push({ label: t('translation:menu.ebayListings') });
  }
}
```

- [ ] **Step 5: i18n — `packages/shared/src/i18n/resources/en/listings.json`**

Add under `listings.breadcrumb` (next to `addProducts`):

```json
"allListings": "All Listings"
```

- [ ] **Step 6: i18n — `packages/shared/src/i18n/resources/tr/listings.json`**

```json
"allListings": "Tüm Listeler"
```

- [ ] **Step 7: Build + verify**

Run: `pnpm build` (rebuild shared package so the new i18n key is available).
Run: `pnpm lint`, `pnpm typecheck` (no NEW errors).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/features/listings/index.ts apps/web/src/layouts/AppLayout/AppLayout.component.tsx apps/web/src/layouts/AppLayout/AppLayout.container.tsx packages/shared/src/i18n/resources/en/listings.json packages/shared/src/i18n/resources/tr/listings.json
git commit -m "feat(listings): wire /listings overview + /listings/all routes, nav active, breadcrumb, i18n

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Delete old ListingsPage + old ListingCarousel

**Files:**
- Delete: `apps/web/src/features/listings/ListingsPage.container.tsx`
- Delete: `apps/web/src/features/listings/ListingsPage.component.tsx`
- Delete: `apps/web/src/features/listings/ListingsPage.style.ts`
- Delete: `apps/web/src/features/listings/ListingsPage.types.ts`
- Delete: `apps/web/src/features/listings/ListingCarousel.tsx`

- [ ] **Step 1: Grep for stale imports**

Run: `grep -rn "ListingsPage\|features/listings/ListingCarousel\|from './ListingCarousel'" apps/web/src` (use the Grep tool).
Expected: no imports of the deleted `ListingsPage` or the old single-file `ListingCarousel` remain. If any do, fix them first (they should all have been replaced in Tasks 4–6).

- [ ] **Step 2: Delete the files**

```bash
git rm apps/web/src/features/listings/ListingsPage.container.tsx apps/web/src/features/listings/ListingsPage.component.tsx apps/web/src/features/listings/ListingsPage.style.ts apps/web/src/features/listings/ListingsPage.types.ts apps/web/src/features/listings/ListingCarousel.tsx
```

- [ ] **Step 3: Verify**

Run: `pnpm lint`, `pnpm typecheck`. Expected: no NEW errors; ideally fewer than baseline (the deleted files carried some).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(listings): remove old single-file ListingsPage + ListingCarousel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: CSS fixes on overview (card height + bottom-border alignment + ViewAll underline)

**Files:**
- Modify: `apps/web/src/features/listings/overview/ListingsOverviewPage.style.ts`
- Modify: `apps/web/src/features/listings/carousel/ListingCarousel.style.ts`
- Modify: `packages/ui/src/molecules/ListingCard/ListingCard.style.ts` (if the height fix belongs on the card)

- [ ] **Step 1: Confirm ViewAll underline already removed**

In Task 3 the `ViewAllButton` was copied WITHOUT `text-decoration: underline;` on hover. Verify in `apps/web/src/features/listings/carousel/ListingCarousel.style.ts` — the `:hover` block must contain only `color: ${tkn('colors.brand.primaryHover')};`. If the underline slipped back in, remove it.

- [ ] **Step 2: Align carousel card bottom border with the other-actions card bottom border**

Run the app (`pnpm dev`) and open `/listings`. Observe the carousel card's bottom edge vs the right "Diğer İşlemler" card's bottom border. The structural equalizer (`TwoColumnLayout { align-items: stretch }` + `height: 100%` on both columns + `.other-actions-card { flex: 1 }`) already aligns the column bottoms; the visible mismatch comes from the `CarouselTopBar` + `CarouselPagination` taking vertical space that the `QuickActionCard` doesn't mirror.

Tune in `apps/web/src/features/listings/carousel/ListingCarousel.style.ts`:
- Give `CarouselTopBar` a fixed minimal height (e.g. `min-height` matching the `ViewAllButton` line height + padding) and `flex-shrink: 0`.
- Give `CarouselPagination` `flex-shrink: 0` (already) and a compact `padding-top`.
- In `packages/ui/src/molecules/ListingCard/ListingCard.style.ts`, bump the horizontal `Wrapper` `min-height` by one spacing step (e.g. add `min-height: ${tkn('spacing.xxl')};` or increase padding) so the card fills the viewport and its bottom edge meets the other-actions bottom border.

There is no numeric "correct" value — adjust by eye in the running app until the two bottom edges sit on the same horizontal line in both light and dark themes. Use only `tkn()` tokens.

- [ ] **Step 3: Verify visually**

Run: `pnpm dev`, open `/listings`, confirm:
- Carousel card bottom edge aligns horizontally with the right other-actions card bottom border.
- "Tümü" button has NO underline on hover.
- Card is slightly taller than before.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/listings/carousel/ListingCarousel.style.ts apps/web/src/features/listings/overview/ListingsOverviewPage.style.ts packages/ui/src/molecules/ListingCard/ListingCard.style.ts
git commit -m "style(listings): align overview card bottom border, remove ViewAll hover underline

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Full quality gate**

Run: `pnpm lint` — expected 0 warnings.
Run: `pnpm typecheck` — expected no NEW errors vs. baseline (pre-existing web errors are acceptable per CLAUDE.md).

- [ ] **Step 2: Manual browser run**

Run: `pnpm dev`. Log in, then verify:
- `/listings` shows the overview (carousel + actions). Nav "eBay Listeleri" is active.
- "Tümü" button navigates to `/listings/all` (URL changes). Nav "eBay Listeleri" stays active.
- `/listings/all` defaults to a **card grid** of all listings. The grid/table toggle switches to the table. Filters work in both views. Bulk actions, column manager, CSV, pagination work.
- From `/listings/all`, clicking nav "eBay Listeleri" returns to the overview (slider) — remount resets the view.
- Breadcrumb on `/listings/all` shows Home → eBay Listeleri → Tüm Listeler (or "All Listings").
- Add drawer opens only from the overview (button in header + QuickActionCard). `/listings/all` has no add button.

- [ ] **Step 3: Final commit (if any fixups)**

Only if Step 1–2 surfaced fixups. Otherwise no commit.

---

## Self-Review

**Spec coverage:**
- Routing split (`/listings`, `/listings/all`) → Task 6. ✓
- Remove `viewMode` local state → Tasks 4 & 5 (no `viewMode` in new pages). ✓
- "Tümü" navigates → Task 4 container `onViewAll`. ✓
- Navbar works (remount) → Task 6 (separate routes). ✓
- `/listings/all` card-grid default + table toggle → Task 5 (`tableView='grid'`, DataTable `ViewToggle`). ✓
- Filters + table structure preserved → Task 5 (moved verbatim). ✓
- `ListingCard` molecule, generic, no `@repo/shared` → Task 1. ✓
- `ListingCarousel` 4-file split, uses molecule → Task 3. ✓
- Add flow overview-only → Task 4 (owns drawer), Task 5 (no add). ✓
- Nav active for `/listings/all` → Task 6 Step 3. ✓
- Breadcrumb `/listings/all` → Task 6 Step 4 + i18n Step 5–6. ✓
- Card height + bottom-border alignment → Task 8 Step 2. ✓
- ViewAll hover underline removed → Task 3 Step 2 + Task 8 Step 1. ✓
- Delete old files → Task 7. ✓

**Placeholder scan:** The "tune by eye" in Task 8 Step 2 is intentional (empirical CSS, flagged in spec). All code blocks are complete. No TBD/TODO. The "copy verbatim from lines X–Y" instructions reference exact source locations — not placeholders.

**Type consistency:** `ListingCardProps` / `ListingCardStat` / `ListingCardBadge` / `ListingCardStatus` / `StatTone` defined in Task 1, consumed identically in Tasks 3 & 5. `ViewMode` imported from `@repo/ui` in Tasks 5 & 6. `ListingsFilterState` from `../shared/listings-filter.types` (Task 2) used in Task 5. Carousel props extended with `currentSlide`/`onNext`/`onPrev`/`onGoTo` consistently across Task 3 types, component, and container.
