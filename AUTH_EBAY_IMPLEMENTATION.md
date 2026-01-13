# Auth + eBay Integration Feature

Bu iterasyonda eklenen özellikler:

## ✅ Tamamlanan Özellikler

### Backend (NestJS)
- ✅ **Auth Module**
  - User registration (JWT tokens ile)
  - User login
  - Get authenticated user (`/auth/me`)
  - JWT strategy ve guard
  - In-memory user storage (production'da DB entegrasyonu için hazır)

- ✅ **eBay Module**
  - eBay OAuth2 Authorization Code Grant flow
  - Multiple account support (bir user birden fazla mağaza bağlayabilir)
  - Consent URL generation
  - OAuth callback handling
  - Token exchange ve refresh
  - In-memory account storage (production'da DB entegrasyonu için hazır)

- ✅ **Dashboard Module**
  - Auth-protected endpoint
  - Boş response (gelecek özellikler için hazır)

### Frontend (React)
- ✅ **Auth Pages**
  - Register page (TextInput molecule ile form validation)
  - Login page (TextInput molecule ile form validation)
  - Token storage (localStorage)
  - Auto-redirect after auth

- ✅ **eBay Connect**
  - Connect eBay account butonu
  - OAuth redirect flow
  - Connected accounts sayısı gösterimi

- ✅ **Dashboard**
  - Auth-protected route
  - User greeting
  - eBay connect butonu
  - Auto-redirect to login if unauthorized

- ✅ **UI Components**
  - TextInput molecule (Controller-wrapped Input + Label + Error)
  - Atomic Design pattern (Atom → Molecule)

### Shared Package
- ✅ **Auth Domain**
  - Types, DTOs, constants
  - Zod schemas (TextInput molecule ile otomatik form validation)
  - i18n (EN, TR)

- ✅ **eBay Domain**
  - Types, DTOs, constants
  - Marketplace support (US, UK, DE, FR, IT, ES)
  - i18n (EN, TR)

- ✅ **Dashboard Domain**
  - i18n (EN, TR)

## 🚀 Kullanım

### 1. Dependencies Install
```bash
pnpm install
```

### 2. Environment Variables

Backend `.env` dosyası oluştur (apps/api/.env):
```env
# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# eBay OAuth
EBAY_CLIENT_ID=your-ebay-app-id
EBAY_CLIENT_SECRET=your-ebay-cert-id
EBAY_REDIRECT_URI=http://localhost:3000/api/v1/ebay/callback
EBAY_ENVIRONMENT=SANDBOX

# Frontend
FRONTEND_URL=http://localhost:5173
```

### 3. Build Shared Package
```bash
pnpm --filter @repo/shared build
```

### 4. Run Development Servers
```bash
# Terminal 1 - Backend
pnpm --filter api dev

# Terminal 2 - Frontend
pnpm --filter web dev
```

## 📋 API Endpoints

### Auth
- `POST /api/v1/auth/register` - Kullanıcı kaydı
- `POST /api/v1/auth/login` - Kullanıcı girişi
- `GET /api/v1/auth/me` - Mevcut kullanıcı bilgisi (Auth required)

### eBay
- `GET /api/v1/ebay/connect-url` - OAuth consent URL (Auth required)
- `GET /api/v1/ebay/callback` - OAuth callback (eBay'den redirect)
- `GET /api/v1/ebay/accounts` - Bağlı hesaplar (Auth required)

### Dashboard
- `GET /api/v1/dashboard` - Dashboard data (Auth required)

## 🔐 Auth Flow

1. User → `/register` veya `/login`
2. Backend → JWT tokens üret
3. Frontend → Tokens'ı localStorage'a kaydet
4. Frontend → `/dashboard`'a yönlendir
5. Her API isteğinde → `Authorization: Bearer {token}` header ekle

## 🏪 eBay Connect Flow

1. User → Dashboard'da "Connect eBay Account" butonuna tıklar
2. Frontend → `/ebay/connect-url` endpoint'ini çağırır
3. Backend → eBay consent URL üretir (state parameter ile CSRF koruması)
4. Frontend → User'ı eBay'e redirect eder
5. User → eBay'de authorize eder
6. eBay → Backend callback endpoint'ine redirect eder (`/ebay/callback`)
7. Backend → Authorization code'u token'a çevirir
8. Backend → Seller bilgilerini alır
9. Backend → Account'u kaydeder
10. Backend → Frontend'e success redirect yapar
11. Frontend → Dashboard'a yönlendirir

## 🗂️ Folder Structure

```
packages/shared/src/
├── domain/
│   ├── auth/          # Auth types, DTOs, constants
│   └── ebay/          # eBay types, DTOs, constants
├── schemas/
│   └── auth/          # Zod validation schemas
└── i18n/resources/
    ├── en/
    │   ├── auth.json
    │   ├── ebay.json
    │   └── dashboard.json
    └── tr/
        ├── auth.json
        ├── ebay.json
        └── dashboard.json

apps/api/src/modules/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   └── dto/
├── ebay/
│   ├── ebay.controller.ts
│   ├── ebay.service.ts
│   ├── ebay-oauth.service.ts
│   └── ebay.module.ts
└── dashboard/
    ├── dashboard.controller.ts
    ├── dashboard.service.ts
    └── dashboard.module.ts

apps/web/src/features/
├── auth/
│   ├── api/authApi.ts
│   ├── RegisterPage/
│   └── LoginPage/
├── ebay/
│   ├── api/ebayApi.ts
│   └── EbayConnectPage/
└── dashboard/
    ├── api/dashboardApi.ts
    └── DashboardPage/
```

## 📝 Notes

- **In-Memory Storage**: Şu an hem user'lar hem de eBay accounts in-memory Map'te tutuluyor. Production'da PostgreSQL/MongoDB entegrasyonu gerekli.
- **Token Refresh**: Refresh token endpoint henüz implement edilmedi.
- **Email Verification**: Email verification akışı bu iterasyonda yok.
- **Password Reset**: Forgot password özelliği bu iterasyonda yok.
- **eBay Token Refresh**: Access token'lar 2 saat sonra expire olur, otomatik refresh mekanizması henüz yok.
- **Multiple Marketplaces**: Şu an sadece EBAY_US destekleniyor, ama altyapı tüm marketplaces için hazır.

## 🔜 Sonraki Adımlar

1. Database entegrasyonu (PostgreSQL/Prisma)
2. Refresh token endpoint
3. Email verification
4. Password reset flow
5. eBay token auto-refresh
6. Connected accounts listesi UI
7. Disconnect eBay account
8. Multiple marketplace desteği (UK, DE, FR, IT, ES)
9. Amazon integration
10. Dashboard metrics ve analytics

---

**Architecture Pattern**: ARCHITECTURE.md ve LLM_RULES.md'ye %100 uygun şekilde implement edildi.

**Form Pattern**: TextInput molecule kullanımı ile Controller pattern enforced (RULE 7)
- ✅ Single line per field (Label + Input + Error)
- ✅ Automatic error display
- ✅ Type-safe field name binding
