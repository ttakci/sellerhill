# Zonds

**eBay–Amazon dropshipping yönetim platformu.** Listing yönetimi, otomatik fiyatlandırma, sipariş senkronizasyonu ve Amazon sipariş takibi.

React 18 + NestJS 10 monorepo. pnpm workspace, PostgreSQL 16, Redis 7.

---

## Gereksinimler

| Araç | Minimum Sürüm |
|------|---------------|
| [Node.js](https://nodejs.org/) | 18+ |
| [pnpm](https://pnpm.io/) | 8.x |
| [Docker](https://www.docker.com/) | 20+ (PostgreSQL ve Redis için) |
| [Git](https://git-scm.com/) | 2.x |

---

## Kurulum

### 1. Repoyu Klonla

```bash
git clone <repo-url> zonds
cd zonds
```

### 2. Bağımlılıkları Yükle

```bash
pnpm install
```

### 3. Docker Servislerini Başlat (PostgreSQL, Redis, pgAdmin)

```bash
pnpm docker:up
```

Bu komut şu servisleri ayağa kaldırır:

| Servis | Port | Açıklama |
|--------|------|----------|
| PostgreSQL 16 | `5432` | Veritabanı |
| Redis 7 | `6379` | Job queue & cache |
| pgAdmin 4 | `5050` | Veritabanı yönetim UI |

> pgAdmin'e `http://localhost:5050` adresinden erişebilirsiniz.
> Giriş: `admin@zonds.com` / `admin123`

### 4. Ortam Değişkenlerini Ayarla

**API (.env):**

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` dosyasını açıp aşağıdaki alanları doldurun:

| Değişken | Açıklama | Zorunlu mu? |
|----------|----------|-------------|
| `DATABASE_HOST` | PostgreSQL host (default: `localhost`) | ✅ |
| `DATABASE_PORT` | PostgreSQL port (default: `5432`) | ✅ |
| `DATABASE_NAME` | Veritabanı adı | ✅ |
| `DATABASE_USER` | DB kullanıcı adı | ✅ |
| `DATABASE_PASSWORD` | DB şifresi | ✅ |
| `JWT_SECRET` | JWT imzalama anahtarı (min 32 karakter) | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token anahtarı (min 32 karakter) | ✅ |
| `REDIS_HOST` | Redis host (default: `localhost`) | ✅ |
| `REDIS_PORT` | Redis port (default: `6379`) | ✅ |
| `EBAY_CLIENT_ID` | eBay OAuth Client ID | ✅ |
| `EBAY_CLIENT_SECRET` | eBay OAuth Client Secret | ✅ |
| `EBAY_ENVIRONMENT` | `sandbox` veya `production` | ✅ |
| `AMAZON_ENCRYPTION_KEY` | 64 karakter hex (AES-256-GCM) | ✅ |
| `SCRAPER_API_KEY` | ScraperAPI anahtarı | ⬜ |
| `KEEPA_API_KEY` | Keepa API anahtarı | ⬜ |
| `SMTP_HOST` | Email SMTP host | ⬜ |
| `SMTP_USER` | SMTP kullanıcı adı | ⬜ |
| `SMTP_PASSWORD` | SMTP şifresi | ⬜ |

> **Not:** Yeni kurulumlarda `DATABASE_NAME`, `DATABASE_USER` ve `DATABASE_PASSWORD` değerlerini `docker-compose.yml` ile eşleştirin:
> - DB: `zonds_db`, User: `zonds_user`, Password: `zonds_password_change_in_production`

**Web (.env):**

```bash
cp apps/web/.env.example apps/web/.env
```

Frontend `.env` varsayılan değerlerle çalışır, değiştirmeniz gerekmez.

### 5. Veritabanı Migration'larını Çalıştır

```bash
pnpm migrate
```

Tablolar ve seed verileri otomatik olarak oluşturulur.

### 6. Uygulamayı Başlat

```bash
pnpm dev
```

Bu komut sırasıyla:
1. `packages/shared`, `packages/ui` paketlerini build eder
2. API (`apps/api`) ve Web (`apps/web`) uygulamalarını paralel başlatır

---

## Erişim Adresleri

| Servis | URL |
|--------|-----|
| Frontend (Web) | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| API Dokümantasyonu (Swagger) | http://localhost:3000/api/docs |
| pgAdmin | http://localhost:5050 |

---

## Diğer Komutlar

### Geliştirme

```bash
pnpm dev              # Tüm uygulamaları başlat (api + web)
pnpm dev:web          # Sadece frontend
pnpm dev:api          # Sadece backend
```

### Build

```bash
pnpm build            # Tüm paket ve uygulamaları build et
```

### Kod Kalitesi

```bash
pnpm lint             # ESLint kontrolü (max-warnings 0)
pnpm lint:fix         # ESLint otomatik düzeltme
pnpm format           # Prettier ile formatla
pnpm typecheck        # TypeScript tip kontrolü
pnpm validate         # lint + typecheck (pre-commit'te çalışır)
```

### Docker

```bash
pnpm docker:up        # Servisleri başlat
pnpm docker:down      # Servisleri durdur
pnpm docker:logs      # Logları takip et
pnpm docker:clean     # Container ve volumeleri sil
```

### Migration

```bash
pnpm migrate          # Migration'ları çalıştır
```

---

## Proje Yapısı

```
zonds/
├── apps/
│   ├── api/                  # NestJS backend
│   └── web/                  # React + Vite frontend
├── packages/
│   ├── shared/               # Domain tipleri, DTO'lar, Zod şemaları, i18n
│   ├── ui/                   # Design system (Atomic Design)
│   └── mcp/                  # Stub (boş)
├── docker/
│   └── postgres/
│       └── init.sql          # PostgreSQL init script
├── docker-compose.yml        # PostgreSQL 16, Redis 7, pgAdmin
├── CLAUDE.md                 # AI asistan rehberi
└── README.md
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 18, Vite 5, Redux Toolkit + RTK Query, Emotion CSS-in-JS |
| **Backend** | NestJS 10, raw PostgreSQL (`pg`), BullMQ job queues (Redis), JWT auth |
| **Ortak** | TypeScript, Zod validasyon, i18n (EN + TR) |
| **Altyapı** | Docker (PostgreSQL 16, Redis 7), pnpm workspace monorepo |

---

## Lisans

MIT
