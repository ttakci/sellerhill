# Frontend Rules Enforcement — Design Spec

**Date:** 2026-07-06
**Status:** Approved (brainstorming complete)
**Branch:** `UAT` → refactor work on a dedicated branch (suggested: `refactor/frontend-rules`)

## Motivation

Frontend kodları tutarlı olarak belirlenen kuralları ihlal ediyor. Mevcut enforcement sadece 5 görsel kuralı (renk/spacing/inline-style/styled-typography/bare-text-in-button) kapsıyor. Yapısal kurallar (logic→container, styled→.style.ts, types→.types.ts) dokümante edilmiş ama zorlanmıyor. Doküman tek başına yetmiyor; agentlar ve insanlar atlıyor.

Bu spec dosya organizasyonunu sıkılaştırır, 3 katmanlı enforcement kurar, mevcut kod tabanını refactor planlar.

## Scope

**In scope:**
- 4 yeni structural ESLint kuralı
- 1 PreToolUse hook (Node script, Write|Edit|MultiEdit)
- 1 manuel skill + CLAUDE.md güncellemesi
- Mevcut kod tabanında ihlal taraması ve tam refactor
- `frontend-rules.md` silinmesi (içerik skill'e taşınır)

**Out of scope:**
- `apps/api/**` (backend)
- `apps/web/src/features/landing/**` (muaf bırakıldı)
- `api/*.ts` RTK Query endpoint dosyaları (kendi düzenleri)
- Tasarım sistemi token genişletmeleri, Yeni UI primitives
- `tkn()` tip güvenliği güçlendirme (ayrı spec)
- husky pre-commit partial lint (öneri, şimdi değil)

## Bölüm 1 — Dosya Organizasyonu Kuralları

Her feature ve atom/molecule için 4 dosya deseni:

| Dosya | İçerik | Yasaklı |
|---|---|---|
| `[Name].component.tsx` | Sadece JSX markup + `useTranslation` + `useTheme` | `useState/useEffect/useMemo`, RTK Query, helperlar, event handlerlar, `styled(...)` |
| `[Name].container.tsx` | Tüm logic | `styled(...)`, JSX markup (sadece `<Component ...props />` geçer) |
| `[Name].style.ts` | Tüm `styled(...)` tanımları | JSX, logic |
| `[Name].types.ts` | `interface`, `type`, `enum` | implementasyon |

### Kapsam
- **Feature'lar** (`apps/web/src/features/**`) — 4 dosya deseni zorunlu
- **Atoms/Molecules** (`packages/ui/src/atoms|molecules/**`) — aynı kurallara tabi, **container dosyası yok**
  - `Button.component.tsx`, `Button.style.ts`, `Button.types.ts` mevcut
  - Logic barındıran atom/molecule = kötü koku; logic parent'a taşınmalı veya molecule'a yükseltilmeli
  - `useState`/`useEffect` atom/molecule'da yasak

### İstisnalar (muaf dosyalar)
- `apps/web/src/**/api/*.ts(x)` — RTK Query endpoints
- `apps/web/src/app/store.ts`
- `apps/web/src/features/landing/**`
- `apps/api/**`
- `*.config.{ts,js,mjs,cjs}`

## Bölüm 2 — Mekanizma Detayları

### 2.1 ESLint — 4 yeni yapısal kural

Dosya: `packages/ui/src/eslint-plugin/index.js` genişletilecek.

| Kural | Mantık | Hata Mesajı |
|---|---|---|
| `styled-only-in-style-files` | `styled(...)` çağrısı; dosya adı `.style.ts(x)` değilse VE `packages/ui/src/atoms\|molecules` içinde değilse hata. `.container.tsx`, `.component.tsx`, `.types.ts` hepsi kapsanır. | `styled() must be in *.style.ts. Move to [Name].style.ts` |
| `types-only-in-types-files` | `interface`/`type`/`enum` declaration; dosya adı `.types.ts` değilse VE import edilmemişse hata | `Type declarations must be in *.types.ts` |
| `logic-only-in-container` | `.component.tsx` dosyasında `useState`/`useEffect`/`useMemo`/`useCallback`/`useQuery`/`useMutation`/`dispatch`/`useSelector`/`useNavigate` çağrısı varsa hata. İzinli: `useTranslation`, `useTheme`. | `Logic hook detected in *.component.tsx. Move to *.container.tsx` |
| `no-styled-in-container` | `.container.tsx` içinde `styled(...)` çağrısı | `styled() not allowed in *.container.tsx. Move to *.style.ts` |

### 2.2 PreToolUse Hook (Node script)

Dosya: `.claude/hooks/pretooluse-frontend-rules.js`
Kayıt: `.claude/settings.json` içinde `PreToolUse` → matcher `Write|Edit|MultiEdit`.

**Mantık:**
1. stdin'den JSON oku → `tool_name`, `tool_input.file_path`, `tool_input.content` (Write) veya `tool_input.new_string`/`old_string` (Edit)
2. Path filtreleri:
   - `apps/web/src/` veya `packages/ui/src/atoms/` veya `packages/ui/src/molecules/` değilse → exit 0
   - `features/landing/`, `apps/api/`, `*.config.*`, `app/store.ts`, `**/api/` → exit 0
3. İçerik + dosya adı çapraz kontrolü:
   - `.component.tsx` + regex `/useState\(|useEffect\(|use(Memo|Callback|Query|Mutation|Selector|Navigate)\(|dispatch\(/` → reject
   - `.component.tsx` + `/styled\(/` → reject
   - `.container.tsx` + `/styled\(/` → reject
   - `.style.ts(x)` değil + `/styled\(/` (component/container/types içinde) → reject
   - `.types.ts` değil + `/^(export\s+)?(interface|type|enum)\s+[A-Z]/` → reject
4. Reject için `exit 2` + stderr'e `Violation: <kural> — <file>:<özet>` yaz. Claude geri bildirimi stderr'den alır.
5. Kabul için `exit 0`.

**Cross-platform:** Sadece Node API (`fs`, `path`, `process`). Bash/PowerShell yok.

### 2.3 Skill (manuel)

Dosya: `.claude/skills/frontend-rules/SKILL.md` (yeni dizin, mevcut `frontend-rules/` boş — kullan).
İçerik: mevcut `.claude/skills/frontend-rules.md` dosyasının güncellenmiş hali. Kullanım: `/skill frontend-rules` veya agent inisiyatifi.

### 2.4 CLAUDE.md güncellemesi

- Kural 6 ("Container/Component Split (strict)") netleştirilecek — atom/molecule istisnası, antipattern örnekleri
- "Frontend Rules" bölümü eklenecek (fast-reference tablosu)
- `frontend-rules.md`'nin içeriği buraya taşınacak
- Eski `frontend-rules.md` silinecek

## Bölüm 3 — Refactor Planı

### 3.1 Tarama

İlk adım: mevcut kod tabanını tara, ihlal envanteri çıkar.

- Hedef glob: `apps/web/src/features/**/*.{ts,tsx}` + `packages/ui/src/{atoms,molecules}/**/*.{ts,tsx}`
- Muaf: `landing/**`, `**/api/**`, `app/store.ts`, `*.config.*`
- Her dosyayı 4 kurala göre sınıflandır
- Çıktı: tablo (feature → ihlal sayısı → kural bazında breakdown)

### 3.2 Refactor prensipleri (feature başına)

1. **Style ihlalleri önce** — `styled(...)` → `.style.ts`'e taşı (en mekanik)
2. **Type ihlalleri** — `interface`/`type` → `.types.ts`'e taşı, import'ları güncelle
3. **Logic ihlalleri** — `.component.tsx`'teki hook/handler/format → `.container.tsx`'e taşı. Component props arayüzünü genişletme; logic container'da kalmalı
4. **Container'da styled ihlalleri** — `.style.ts`'e taşı
5. Her feature sonrası: `pnpm typecheck && pnpm lint && pnpm build`

### 3.3 Refactor sırası

| # | Hedef | Neden bu sırada |
|---|---|---|
| 1 | `dashboard` | En aktif |
| 2 | `settings` | Aktif (Plan 5 sonrası) |
| 3 | `store-settings` | Reference module — örneklenecek |
| 4 | `orders` | Karmaşık logic |
| 5 | `listings`, `listing-settings-groups` | Benzer yapı |
| 6 | `amazon` | Modal + sayfa |
| 7 | `ebay` | |
| 8 | `auth`, `profile` | Küçük |
| 9 | `packages/ui` (atoms/molecules) | Tek geçiş |

### 3.4 Doğrulama kapıları

- Her feature sonrası: `pnpm typecheck && pnpm lint && pnpm build`
- Tüm refactor sonrası: `pnpm dev:web` + manuel smoke test (login, dashboard, orders, settings)
- Lint `--max-warnings 0` zaten commit öncesi aktif → failure block

## Bölüm 4 — Öneriler (ayrı kararla)

1. **husky pre-commit partial lint** — sadece değişen dosyaları lintle, hız kazancı
2. **`tkn()` tip güvenliği** — `ThemePath` union güçlendirme (ayrı spec)
3. **knip dead-code taraması** — refactor yan ürünü unused styled/type temizliği
4. **`api/` için ayrı kurallar** — endpoint naming, tag formatı (ayrı iş)
5. **Feedback memory** — refactor sırasında user'tan gelen düzeltmeler memory'ye kaydedilecek

## Bölüm 5 — Sistem Mimarisine Genel Bakış

```
Katman 1 — Hard enforcement (agent yazarken):
  ├─ .claude/hooks/pretooluse-frontend-rules.js (Node, Write|Edit|MultiEdit)
  └─ .claude/settings.json (hook config)

Katman 2 — CI / pre-commit enforcement:
  └─ packages/ui/src/eslint-plugin/index.js
      └─ +4 yeni kural

Katman 3 — Dokümantasyon:
  ├─ CLAUDE.md (netleştirilmiş dosya organizasyonu)
  └─ .claude/skills/frontend-rules/SKILL.md

Silinecek:
  └─ .claude/skills/frontend-rules.md

İş sırası:
  1. ESLint kuralları + hook + skill + CLAUDE.md (altyapı)
  2. Tarama → ihlal envanteri
  3. Refactor (sıralama yukarıda)
  4. Doğrulama: typecheck + lint + build + manuel smoke test
```

## Riskler ve Azaltıcılar

| Risk | Azaltıcı |
|---|---|
| Hook false-positive (regex yaml/markdown'i yakalasa) | Path filtreleri sıkı; `apps/web/src/` ve `packages/ui/src/{atoms,molecules}/` dışına çıkma |
| ESLint `logic-only-in-container` hook adlarını kaçırır | Liste güncel tutulacak (`useQuery`, `useMutation`, `dispatch`, vs.) |
| Büyük refactor bir feature'ı bozabilir | Her feature sonrası typecheck + lint + build kapısı; feature-feature commit |
| Atom/molecule'da gerçekten state gerekirse | Muafiyet yok; tasarım yeniden düşünülmeli (parent'a taşı veya molecule'e yükselt) |
| `tkn()` path string'leri yanlış olabilir | Bu spec dışı; ileride tip güvenliği ayrı çalışma |

## Kabul Kriterleri

- [ ] 4 yeni ESLint kuralı `.eslintrc.json`'da `error` seviyesinde aktif
- [ ] PreToolUse hook kayıtlı ve `apps/web/src/features/` dış dosyalarda çalışmıyor (test)
- [ ] `frontend-rules.md` silinmiş, içeriği SKILL.md ve CLAUDE.md'de
- [ ] Tüm feature'lar + atom/molecule taraması tam, ihlal envanteri çıkmış
- [ ] Refactor tamamlanmış, `pnpm validate` yeşil
- [ ] `pnpm dev:web` ile uygulama açılıyor, manuel smoke test geçiyor
- [ ] Hook demo: agent `.component.tsx`'e `useState` yazmayı denediğinde reddediyor

## Sonraki Adım

Spec onayının ardından `superpowers:writing-plans` skill'i uygulamalı plan çıkarır. Plan parça parça, her feature bir task grubu olarak yürütülür.
