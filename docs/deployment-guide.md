# 🚀 Coolify ile Test/UAT Ortamı Deployment Rehberi

> Bu rehber, Hostinger VPS üzerindeki **self-hosted Coolify** ile SellerHill'in **UAT/test** ortamını (yeniden) kurmak için hazırlanmıştır. Aynı adımlar **birebir aynı arayüzle** Coolify Cloud'da da geçerli — self-hosted/Cloud farkı sadece panelin nerede çalıştığı, DB resource/env var/domain iş akışı değişmiyor. Cloud'u ne zaman/nasıl kullanacağınla ilgili notlar → [`docs/coolify-cloud-migration.md`](./coolify-cloud-migration.md) (örn. production'ı ayrı, bağımsız bir server üzerinde Cloud'a taşımak — **bu VPS gibi başka projelerin de barındığı paylaşımlı bir server'ı Cloud'a bağlamak önerilmez**, bkz. o dokümandaki proxy çakışması notu).
>
> **Branch / compose eşleşmesi — karıştırma:**
>
> | | UAT / Test | Production |
> |---|---|---|
> | **Branch** | `UAT` | `main` |
> | **Compose dosyası** | `docker-compose.test.yml` | `docker-compose.production.yml` |
> | **eBay ortamı** | sandbox (compose içinde sabit `EBAY_ENVIRONMENT: sandbox`) | production |
>
> **Mimari özeti:** Tek domain (same-origin). `web` (nginx) React SPA'yı serve eder ve `/api/*` isteklerini API'ye proxy'ler. **PostgreSQL ve Redis compose içinde değil** — Coolify'nin ayrı Database resource'ları olarak yönetilir (otomatik backup, port derdi yok, app'ten bağımsız lifecycle). **Grafana/Loki/Promtail (log takibi) ise compose'un İÇİNDE** — ayrı resource açmana gerek yok, aşağıda ayrıca anlatılıyor.

---

## 🏗️ Mimari (önce bunu anla)

```
Internet → Coolify Traefik (otomatik SSL) → nginx (web:80)
                                            ├── /          → React SPA (statik)
                                            └── /api/*     → NestJS API (api:3000)
                                                              ├── PostgreSQL  ← Coolify DB resource
                                                              ├── Redis       ← Coolify DB resource
                                                              └── Playwright Chromium (imajda gömülü)

Log takibi (compose İÇİNDE, ayrı Coolify resource DEĞİL):
  api → api_logs volume → Promtail → Loki → Grafana (domain'i yok, SSH tunnel ile açılır)
```

### nginx neden var?

nginx'in iki işi var ve bu yüzden kalıyor:

1. **React statik dosyalarını serve etmek + SPA routing** (`/assets`, `try_files` fallback)
2. **`/api` path'ini API'ye proxy'lemek** — böylece tarayıcı ile API **aynı domain** altında olur (same-origin)

Same-origin olunca **CORS tamamen ortadan kalkar**: tarayıcı same-origin isteklerde `Origin` header göndermez, API de `!origin` durumunda izin verir. İkinci bir domain, `CORS_ORIGIN` ayarı, cross-origin cookie/OAuth derdi yok.

> SSL ve domain routing'i Coolify'nin kendi Traefik'i üstlenir — nginx bunu yapmaz, sadece SPA serve + /api proxy yapar.

### PostgreSQL / Redis neden compose içinde değil?

| Sebep | Compose içinde DB | Coolify DB resource |
|-------|-------------------|---------------------|
| **Backup** | Kendin çözeceksin | ✅ Coolify otomatik scheduled backup (S3) |
| **Port / network** | Manuel expose → sıkıntı | ✅ Internal network, port expose yok |
| **App rebuild** | DB de etkilenir | ✅ DB dokunulmaz, kesintisiz |
| **DB'ye bakmak (DBeaver)** | Compose'a port gömmek | ✅ Resource panelinde tek toggle |
| **Lifecycle** | Hepsinin birbirine bağımlı | ✅ Ayrı |

Solo dev için en kritik kazanım **otomatik backup**. DB çöküp veri kaybı olduğunda elle backup alan olmaz.

### Grafana / Loki / Promtail neden ayrı bir Coolify resource'u değil?

Postgres/Redis'in aksine, log takip yığını (**Loki + Promtail + Grafana**) `docker-compose.test.yml` / `docker-compose.production.yml` dosyalarının **içinde tanımlı** — ayrı bir Coolify Database/resource açmana gerek YOK, app'i deploy ettiğinde otomatik gelirler.

Sebep: bunlar Postgres/Redis gibi "kalıcı veri + otomatik backup" isteyen servisler değil — kendi (stateless sayılabilecek, kısa retention'lı) volume'larını compose içinde tanımlıyorlar (`loki_data`, `grafana_data`, `promtail_positions`) ve log verisi zaten 7 gün retention ile kendini temizliyor (bkz. `CLAUDE.md` → "Observability — log tracing").

| Servis | Nerede tanımlı | Domain gerekir mi? |
|---|---|---|
| Loki | compose (internal, `coolify` network) | Hayır |
| Promtail | compose (internal) | Hayır — `api_logs` volume'unu tail eder |
| Grafana | compose (internal) | **Hayır (default)** — SSH tunnel ile erişilir (bkz. Adım 6.3). İstersen ayrı domain de verebilirsin |

Zorunlu tek şey: app'i oluştururken `GRAFANA_ADMIN_PASSWORD` env var'ını girmek (Adım 5.4) — yoksa `grafana` container'ı başlamaz.

### Servisler ve portlar

| Servis | İç port | Dış erişim | Açıklama |
|--------|---------|------------|----------|
| `web` (nginx) | 80 | **Domain üzerinden** (tek domain) | React SPA + API proxy |
| `api` (NestJS) | 3000 | Yok (sadece iç, nginx üzerinden) | REST API + Playwright |
| PostgreSQL | 5432 | Opsiyonel (inspect için açılır) | Coolify DB resource |
| Redis | 6379 | Opsiyonel (inspect için açılır) | Coolify DB resource |

### Kalıcı volume'lar

| Volume | Nerede | Amaç |
|--------|--------|------|
| (Coolify yönetir) | PostgreSQL resource | DB verisi + otomatik backup |
| (Coolify yönetir) | Redis resource | Redis append-only verisi |
| `browser_state` | app (compose) | Playwright/Amazon session cookie'leri |

> ⚠️ `browser_state` (Amazon session'ları) Coolify DB backup'ına **dahil edilmez**. Kaybolursa tüm Amazon hesaplarına yeniden login gerekir. Şimdilik "persist et, kaybolursa re-login" yeterli; ileride backup stratejisine eklenebilir.

---

## 📋 VPS Gereksinimleri

| Kaynak | Minimum | Önerilen | Neden |
|--------|---------|----------|-------|
| **RAM** | 4 GB | 8 GB | Playwright Chromium ~1GB, Build ~2GB |
| **CPU** | 2 core | 4 core | Build ve Playwright paralel çalışır |
| **Disk** | 40 GB SSD | 80 GB SSD | Docker imajları + DB verisi + backup'lar |
| **OS** | Ubuntu 22.04/24.04 | Ubuntu 24.04 | Coolify desteği en iyi bu |

> ⚠️ **1 vCPU / 4GB RAM** planı _çalışır_ ama build sırasında yavaş olur. 2 vCPU / 8GB önerilir.

---

## Adım 1: Coolify Kurulumu (VPS'te)

> ⏭️ **VPS'te zaten çalışan bir Coolify varsa bu adımı atla** — tek Coolify instance'ı aynı VPS'te birden fazla projeyi/app'i barındırabilir. Yeni bir test/UAT app'i eklemek için doğrudan Adım 4'e geç.

```bash
ssh root@SIZIN_VPS_IP
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Kurulum 5-10 dakika sürer. Sonra:

1. Tarayıcıda `http://SIZIN_VPS_IP:8000` adresini açın
2. Admin hesap oluşturun (email + şifre)
3. Server kaydı otomatik yapılır

> 🔐 Kurulum sonrası `https` ve firewall ayarlarını Coolify arayüzünden yapacaksınız (Adım 6).

---

## Adım 2: Deployment Dosyaları (repo'da zaten mevcut)

> Bu adım **tek seferlik/geçmiş** bir kurulum işiydi — aşağıdaki dosyalar repo'da zaten var, tekrar oluşturmana gerek yok. Sadece varlıklarını biliyor ol:

| Dosya | Açıklama |
|-------|----------|
| `.dockerignore` | Docker build'ten hariç tutulacaklar |
| `Dockerfile.api` | NestJS API + Playwright Chromium |
| `Dockerfile.web` | Vite build → nginx statik serve |
| `docker-compose.test.yml` | Test/UAT: `api` + `web` + Loki/Promtail/Grafana (DB servisleri YOK) |
| `docker-compose.production.yml` | Production: aynısı, production env değerleriyle |
| `nginx.conf` | SPA serve + `/api` proxy + SPA routing |
| `docker/api-entrypoint.sh` | DB migration → API başlat |

Yapman gereken tek şey, deploy etmeden önce **`UAT` branch'inin güncel olduğundan** emin olmak:

```bash
git checkout UAT
git merge development
git push origin UAT
```

---

## Adım 3: Coolify'da Veritabanı Resource'larını Oluşturun

> ⚠️ **Sıra önemli:** DB resource'larını app'ten ÖNCE oluşturup başlatın. App ilk deploy'da migration çalıştıracak, DB hazır olmalı.
>
> **Zaten `sellerhill-postgres` / `sellerhill-redis` adında eski kaynaklar varsa** ("nasıl kurduğumu unuttum" durumu) → aşağıya, "🔁 Var Olan Test/UAT App'ini Sıfırdan Kurma" bölümüne bak: ya sil-ve-yeniden-kur, ya da burada farklı bir isim (örn. `sellerhill-uat-postgres`) kullanıp eskisinin yanına yeni kur.

### 3.1 PostgreSQL

1. Coolify dashboard → **"+ Add New"** → **"Resources"** → **"PostgreSQL"**
2. Ayarlar:
   - **Name:** `sellerhill-postgres`
   - **Postgres User:** `sellerhill_user`
   - **Postgres Password:** güçlü bir şifre (kaydedin!)
   - **Postgres DB:** `sellerhill_db`
3. **Deploy** → container başlar, healthcheck geçer

### 3.2 Redis

1. **"+ Add New"** → **"Resources"** → **"Redis"**
2. Ayarlar:
   - **Name:** `sellerhill-redis`
   - Password belirleyin (veya boş bırakın — test için opsiyonel)
3. **Deploy**

### 3.3 Bağlantı bilgilerini kopyalayın

Her DB resource'unun **"Environment Variables"** / **"Connection"** panelinde iki tür connection bilgisi görünür:

- **Internal** (aynı Coolify server'ındaki app'ler için — BUNU kullanın)
- **Public** (dışarıdan erişim için)

Almanız gerekenler:

| Değişken | Nereden | Örnek |
|----------|---------|-------|
| `DATABASE_URL` | PostgreSQL resource → internal connection string | `postgresql://sellerhill_user:****@sellerhill-postgres:5432/sellerhill_db` |
| `REDIS_HOST` | Redis resource → internal hostname | `sellerhill-redis` |
| `REDIS_PORT` | Redis resource → port | `6379` |
| `REDIS_PASSWORD` | Redis resource → password (belirlediyseniz) | `****` |

> Bu değerleri Adım 5'te app'in env var'ları olarak gireceğiz. Coolify tüm resource'ları aynı Docker network'üne (`coolify`) koyar, bu yüzden app internal hostname ile DB'lere ulaşır — port expose etmeden.

---

## Adım 4: Coolify'da App'i Oluşturun

### 4.1 Project + Resource

1. **"+ Add New"** → **"Project"** → ad: `sellerhill`
2. Proje altında **"+ Add New Resource"** → **"Docker Compose"**

### 4.2 Git Repository Bağlama

- **Repository URL:** `https://github.com/ttakci/sellerhill.git`
- **Branch:** **`UAT`** (test/UAT için) — production kuruyorsan `main`
- **Compose File:** **`docker-compose.test.yml`** (test/UAT için) — production kuruyorsan `docker-compose.production.yml`
- Private repo ise **Deploy Key** / **Access Token** ekleyin

> `UAT` branch'i `development`'tan merge edilerek güncel tutuluyor — en son kod için önce `git checkout UAT && git merge development && git push origin UAT` (proje kökünden, VPS'te değil).

### 4.3 Servislere Domain Atama (sadece `web`)

Coolify compose app'inizde iki servis görünür: `api` ve `web`.

- **`web` servisini seçin** → **"Configuration"** → **"Domains"** → `sellerhill.takci.cloud` (kendi domaininiz)
- **`api` servisine domain VERMEYİN** — internal kalacak, nginx üzerinden `/api` ile ulaşılır

---

## Adım 5: Ortam Değişkenlerini Ayarlama

Coolify UI'da compose servisini seçin → **"Environment Variables"** sekmesi.

### 5.1 Zorunlu — çalışmazsa container başlamaz

```env
# Database (Adım 3.3'ten kopyalayın)
DATABASE_URL=postgresql://sellerhill_user:SIFRE@sellerhill-postgres:5432/sellerhill_db
REDIS_HOST=sellerhill-redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Frontend (same domain)
FRONTEND_URL=https://sellerhill.takci.cloud
# CORS allowlist (comma-separated). Same-origin'da zorunlu değil ama best practice.
CORS_ORIGINS=https://sellerhill.takci.cloud

# JWT (en az 32 karakter, rastgele)
JWT_SECRET=
JWT_REFRESH_SECRET=
```

JWT secret üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.2 eBay (sandbox)

eBay sandbox Developer Portal'da **OAuth Redirect URL** olarak same-origin callback'i kaydedin:

```
https://sellerhill.takci.cloud/api/v1/ebay/callback
```

Sonra env var'lar:

```env
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REDIRECT_URI=https://sellerhill.takci.cloud/api/v1/ebay/callback
EBAY_RUNAME=
```

### 5.3 Diğer entegrasyonlar

```env
# Keepa — sole product data provider (metadata + price + stock)
KEEPA_API_KEY=
# Stale-driven refresh pipeline (all optional — defaults shown)
KEEPA_REFRESH_INTERVAL_MINUTES=720
KEEPA_REFRESH_BATCH_SIZE=50
KEEPA_REFRESH_SCHEDULER_CRON=* * * * *
KEEPA_REFRESH_WORKER_CONCURRENCY=1
KEEPA_REFRESH_QUARANTINE_MINUTES=1440
KEEPA_REFRESH_MAX_FAILURES=5

# Amazon (32 byte hex — AES-256-GCM)
AMAZON_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Email (SMTP)
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

### 5.4 Log takibi (Grafana) — zorunlu, yoksa container başlamaz

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=güçlü-bir-şifre
```

`docker-compose.test.yml`/`docker-compose.production.yml` içinde `GRAFANA_ADMIN_PASSWORD` `:?` ile zorunlu işaretli — girilmezse compose ayağa kalkarken hata verir. `GRAFANA_ADMIN_USER` girilmezse `admin` default'u kullanılır. Loki ve Promtail için ekstra env var gerekmiyor.

> Not: Same-origin (tek domain) olduğu için tarayıcı `/api` isteklerinde `Origin` header göndermez → CORS devreye girmez. Yine de `CORS_ORIGINS`'i web domaininize set etmek best practice — API artık bu env var'ı okuyor (virgülle ayrılmış liste), hardcode kaldırıldı.

---

## Adım 6: Domain ve SSL

### DNS

Domain sağlayıcınızın panelinde A kaydı ekleyin:

```
A    sellerhill.takci.cloud    →    SIZIN_VPS_IP
```

### Coolify'da SSL

1. `web` servisi → **"Configuration"** → **"Domains"** → `sellerhill.takci.cloud` (ya da hangi domain/subdomain'i kullanıyorsan)
2. **"HTTPS"** → **"Let's Encrypt"** aktif edin
3. Coolify otomatik SSL sertifikası alır (1-2 dakika)

### 6.3 (Opsiyonel) Grafana'ya erişim

Default'ta Grafana'nın domaini yok — hiç kurulum yapmadan SSH tunnel ile açılır:

```bash
ssh -L 3001:localhost:3001 root@SIZIN_VPS_IP
# sonra kendi tarayıcında: http://localhost:3001  (kullanıcı/şifre = Adım 5.4)
```

> Grafana container'ın iç portu `3000`'dir; yukarıdaki `3001` sadece örnek yerel port — istersen değiştir (`ssh -L 3001:localhost:3000 ...` gibi container'ın gerçek iç portunu hedeflemen gerekebilir, Coolify'nin ürettiği port mapping'e bak).
>
> Sürekli tarayıcıdan erişmek istersen `grafana` servisine de bir Coolify domain atayabilirsin (örn. `grafana.sellerhill.takci.cloud`) — ama bu paneli internete açar; mutlaka güçlü `GRAFANA_ADMIN_PASSWORD` kullan (`GF_AUTH_ANONYMOUS_ENABLED` zaten compose'da `false`).

---

## Adım 7: İlk Deploy

1. DB resource'larının (Postgres + Redis) **çalıştığından** emin olun (Adım 3)
2. App → **"Deploy"**
3. İlk build 5-15 dakika sürebilir (Playwright Chromium indirir)
4. Logları **"Logs"** sekmesinden takip edin

### Beklenen Build Sırası

```
1. web build olur (Vite) → nginx başlar
2. api build olur → entrypoint: migration çalışır → sunucu başlar
3. nginx /api isteklerini api:3000'e proxy'lemeye başlar
```

> Migration "DB connection refused" hatası verirse ve `restart: unless-stopped` ile retry ediyorsa: DB resource'larının gerçekten çalıştığını kontrol edin, `DATABASE_URL`'in **internal** connection string olduğundan emin olun.

### Doğrulama

```bash
# API health check (domain üzerinden, same-origin)
curl https://sellerhill.takci.cloud/api/v1/health
# Beklenen: {"status":"ok"}  (veya uygulamanızın health endpoint'i)
```

---

## Adım 8: DB ve Redis'i İnceleyin (DBeaver / Redis GUI)

> Test ortamında DB/Redis'e bakmak için iki yol var. **Test için "port expose" en kolayıdır; prod'da SSH tunnel tercih edilir.**

### 8.1 PostgreSQL → DBeaver

**Seçenek A — Port expose (test için en basit):**

1. Coolify → PostgreSQL resource (`sellerhill-postgres`) → **"Configuration"**
2. **"Publicly accessible"** / port mapping'i açın → Coolify bir host port'u map'ler (örn. `VPS_IP:32145`)
3. DBeaver → New Connection:
   - Host: `SIZIN_VPS_IP`
   - Port: Coolify'nin verdiği port (örn. `32145`)
   - Database: `sellerhill_db`, User: `sellerhill_user`, Password: (Adım 3.1)

> ⚠️ Bu DB'yi internete açar. **Sadece test** için, güçlü şifreyle. Prod'da kapalı tutun.

**Seçenek B — CLI (port açmadan, VPS'te):**

```bash
docker exec -it <postgres_container_id> psql -U sellerhill_user -d sellerhill_db
```

### 8.2 Redis → Redis GUI / CLI

**Port expose:** Redis resource → **"Publicly accessible"** açın → `VPS_IP:PORT`.

- **RedisInsight** veya **Another Redis Desktop Manager**: host `VPS_IP`, port Coolify portu, password (varsa)
- **CLI:**

```bash
docker exec -it <redis_container_id> redis-cli
# password belirlediyseniz:
# AUTH <password>
```

### 8.3 BullMQ Kuyruklarını Görme

Kuyruklar Redis'te `bull:<queueName>:*` key prefix'iyle tutulur. Aktif kuyruklar:

- `bull:order-sync:*` — eBay order sync
- `bull:amazon-tracking:*` — Amazon order tracking

redis-cli ile:

```bash
# Tüm BullMQ key'leri
KEYS bull:*

# Bir kuyruktaki bekleyen job'lar
LRANGE bull:order-sync:wait 0 -1

# Kuyruk istatistikleri
HGETALL bull:order-sync:meta
```

> İleride görsel bir kuyruk paneli istersen `@bull-board/nestjs` eklenebilir (şu an kurulu değil).

---

## 🔁 Var Olan Test/UAT App'ini Sıfırdan Kurma

"Nasıl kurduğumu unuttum, baştan yapacağım" durumundaysan — DB'nin yeni olması zaten sorun değilse — iki yol var:

### Seçenek A — Eskisini sil, temiz kur

1. Coolify → eski test app'inin bulunduğu proje → **"Delete"** (app + varsa domain kaydı silinir)
2. Eski `sellerhill-postgres` / `sellerhill-redis` DB resource'larını da sil (Coolify → **Resources**)
3. Bu dokümanın **Adım 3**'ünden itibaren sıfırdan başla (aynı isimleri tekrar kullanabilirsin)

> ⚠️ Geri alınamaz — eski test DB'sinde bir şey varsa kalıcı silinir. Test/UAT ortamı için genelde sorun değil (zaten "db falan yeni olmalı" diyorsun).

### Seçenek B — Eskisini silmeden, yanına yeni kur

Eskisi hâlâ çalışır durumda kalır, yeni kurulum doğrulanınca eskisini kaldırırsın:

1. Adım 4.1'de **farklı bir proje adı** (örn. `sellerhill-uat-v2`)
2. Adım 3'te **farklı DB resource isimleri** (örn. `sellerhill-uat-postgres-v2`, `sellerhill-uat-redis-v2`)
3. Adım 4.3 / 6.1'de **farklı bir domain** (örn. `uat2.sellerhill.takci.cloud` — DNS'e yeni A kaydı eklemen gerekir)
4. Yeni kurulum çalıştığını doğrulayınca eskisini Seçenek A'daki gibi sil

> İkisi aynı VPS'te, aynı Coolify instance'ında sorunsuz yan yana durur — proxy (Traefik) domain bazlı routing yaptığı için farklı domain/subdomain'ler çakışmaz.

---

## 🔄 Güncelleme (Yeni Deploy)

```bash
git checkout UAT
git merge development   # en son kodu UAT'a al
git push origin UAT
```

Coolify UI → **"Redeploy"**. DB resource'ları **dokunulmaz** — sadece app rebuild olur, veri kaybı yok.

### Otomatik Deploy

Coolify → Servis → **"Configuration"** → **"Watch Paths"** → `*` ekleyin. Her push'ta otomatik deploy.

---

## 🐛 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| **Migration: DB connection refused** | DB resource çalışıyor mu? `DATABASE_URL` **internal** mi (hostname `sellerhill-postgres`, yoksa public IP değil)? App ile DB aynı Coolify server'ında mı? |
| **502 Bad Gateway** | `api` container'ı çalışıyor mu? `docker ps`. nginx `/api` → `api:3000` proxy'si için her ikisi de up olmalı |
| **Build OOM** | VPS en az 4GB RAM + swap ekleyin (aşağıya bakın) |
| **SSL alınamıyor** | DNS A kaydının VPS IP'ye yöneldiğinden emin olun, 5-10 dk bekleyin |
| **Playwright hatası** | `playwright install --with-deps` loglarını kontrol edin (Dockerfile.api) |
| **İlk deploy yavaş** | Normal. Playwright Chromium ~400MB. Sonraki deploy'larda Docker cache |
| **DBeaver bağlanamıyor** | PostgreSQL resource'ta "Publicly accessible" açık mı? Port doğru mu? Şifre doğru mu? |
| **`grafana` container'ı başlamıyor / restart loop** | `GRAFANA_ADMIN_PASSWORD` env var'ı girilmiş mi kontrol et (Adım 5.4) — compose'da zorunlu (`:?`) olarak işaretli. |
| **Grafana'da veri/dashboard görünmüyor** | Loki/Promtail container'ları çalışıyor mu (`docker ps`)? Promtail `api_logs` volume'unu tail ediyor — API loglama gerçekten yapıyor mu (`docker compose logs -f api`)? |

### Swap Ekleme (RAM yetmiyorsa)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Faydalı Komutlar (VPS'te)

```bash
# Container'lar
docker ps

# App logları
cd /data/coolify/compose/<project-id>
docker compose logs -f api

# DB'ye gir
docker exec -it <postgres_container_id> psql -U sellerhill_user -d sellerhill_db

# Redis'e gir
docker exec -it <redis_container_id> redis-cli

# API container içine gir (debug)
docker exec -it <api_container_id> sh

# Manuel migration
docker exec -it <api_container_id> node dist/scripts/migrate.js

# Disk
docker system df
docker system prune -f
```

---

## 📌 Adım Adım Checklist

- [ ] VPS: en az 4GB RAM, 2 vCPU, 40GB SSD, Ubuntu 22.04/24.04
- [ ] Coolify kuruldu (ya da zaten kuruluysa Adım 1 atlandı), admin hesap var
- [ ] Eski test/UAT app'i varsa: Seçenek A (sil-yeniden kur) ya da B (yanına yeni kur) netleştirildi
- [ ] Repo'da deployment dosyaları push'landı, **`UAT` branch** güncel (`git merge development` sonrası push edildi)
- [ ] Coolify'da **PostgreSQL resource** oluşturuldu + çalışıyor
- [ ] Coolify'da **Redis resource** oluşturuldu + çalışıyor
- [ ] `DATABASE_URL`, `REDIS_HOST/PORT` internal connection bilgileri alındı
- [ ] Coolify'da app (Docker Compose) oluşturuldu, repo bağlandı — branch **`UAT`**, compose **`docker-compose.test.yml`**
- [ ] Domain SADECE `web` servisine atandı (`api`'ye verilmedi)
- [ ] Env var'lar ayarlandı: `DATABASE_URL`, `REDIS_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`
- [ ] **`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` girildi** (yoksa `grafana` container'ı başlamaz)
- [ ] eBay sandbox redirect URI = `https://<domain>/api/v1/ebay/callback`
- [ ] DNS A kaydı eklendi (domain → VPS IP)
- [ ] Let's Encrypt SSL aktif
- [ ] İlk deploy başarılı
- [ ] `https://<domain>/api/v1/health` → "ok" yanıtı
- [ ] Uygulama tarayıcıda açılıyor
- [ ] (Opsiyonel) DBeaver ile DB'ye bağlandı
- [ ] (Opsiyonel) Redis GUI / CLI ile kuyruklar görüldü
- [ ] (Opsiyonel) Grafana'ya SSH tunnel ile bağlanıldı, log akışı görüldü
