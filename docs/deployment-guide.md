# 🚀 Coolify ile Test Ortamı Deployment Rehberi

> Bu rehber, Hostinger VPS üzerinde Coolify kullanarak Zonds projesini test ortamına almak için hazırlanmıştır.

---

## 📋 VPS Gereksinimleri

Hostinger VPS'inizin şu minimum özellikleri karşılaması gerekiyor:

| Kaynak | Minimum | Önerilen | Neden |
|--------|---------|----------|-------|
| **RAM** | 4 GB | 8 GB | Playwright Chromium ~1GB, Build ~2GB |
| **CPU** | 2 core | 4 core | Build ve Playwright paralel çalışır |
| **Disk** | 40 GB SSD | 80 GB SSD | Docker imajları + PostgreSQL verisi |
| **OS** | Ubuntu 22.04/24.04 | Ubuntu 24.04 | Coolify desteği en iyi bu |

> ⚠️ **1 vCPU / 4GB RAM** olan en ucuz Hostinger planı _çalışır_ ama build sırasında yavaş olur. 2 vCPU / 8GB önerilir.

---

## Adım 1: Coolify Kurulumu (VPS'te)

SSH ile VPS'e bağlanın:

```bash
ssh root@SIZIN_VPS_IP
```

Coolify'ı tek komutla kurun:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Kurulum 5-10 dakika sürer. Bittikten sonra:

1. Tarayıcıda `http://SIZIN_VPS_IP:8000` adresini açın
2. Admin hesap oluşturun (email + şifre)
3. Server kaydı otomatik yapılır

> 🔐 **Güvenlik:** Coolify kurulumu sonrası `https` ve firewall ayarlarını Coolify arayüzünden yapacaksınız.

---

## Adım 2: Deployment Dosyalarını Push'layın

Aşağıdaki dosyalar repo'ya eklenmiş olmalıdır. Eğer eklenmemişse `development` branch'inde bu dosyaların var olduğunu kontrol edin:

| Dosya | Açıklama |
|-------|----------|
| `.dockerignore` | Docker build'ten hariç tutulacaklar |
| `Dockerfile.api` | NestJS API + Playwright Chromium |
| `Dockerfile.web` | Vite build → nginx statik serve |
| `docker-compose.production.yml` | Tüm servislerin tanımı |
| `nginx.conf` | Web serving + API proxy + SPA routing |
| `docker/api-entrypoint.sh` | DB migration → API başlat |

`dotenv` bağımlılığı `apps/api/package.json`'a eklenmiş olmalıdır.

Push işlemi:

```bash
# Lokal makinenizde
pnpm install               # dotenv'i lockfile'a ekle
git add .
git commit -m "feat: add Docker deployment configuration for Coolify"
git push origin development
```

---

## Adım 3: Coolify'da Proje Oluşturma

### 3.1 Yeni Proje

1. Coolify dashboard'da **"+ Add New"** → **"Project"**
2. Proje adı: `zonds`
3. Proje altında **"+ Add New Resource"** → **"Docker Compose"**

### 3.2 Git Repository Bağlama

- **Repository URL:** Git repo URL'niz (GitHub/GitLab)
- **Branch:** `development` (veya `main`)
- **Compose File:** `docker-compose.production.yml`
- Eğer private repo: **Deploy Key** veya **Access Token** ekleyin

### 3.3 Build Ayarları

- **Docker Build Context:** `.` (root) — zaten compose dosyasında tanımlı

---

## Adım 4: Ortam Değişkenlerini Ayarlama

Coolify UI'da Docker Compose servisini seçin → **"Environment Variables"** sekmesine gidin.

### Zorunlu Değişkenler

Bunları koymazsanız container başlamaz:

```env
# PostgreSQL
POSTGRES_PASSWORD=BURAYA_GÜÇLÜ_BİR_ŞİFRE_YAZIN

# JWT (en az 32 karakter, rastgele)
JWT_SECRET=buraya-32-karakterlik-rastgele-bir-secret-yazin
JWT_REFRESH_SECRET=buraya-baska-32-karakterlik-secret-yazin
```

JWT secret üretmek için:

```bash
# Lokal makinenizde çalıştırın, çıkan değeri yapıştırın
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### API Değişkenleri

Test ortamı için boş bırakılabilir ama eBay bağlantısı çalışmaz:

```env
# eBay OAuth (test ortamı için sandbox kullanın)
EBAY_CLIENT_ID=your_sandbox_client_id
EBAY_CLIENT_SECRET=your_sandbox_client_secret
EBAY_REDIRECT_URI=http://SIZIN_DOMAIN/api/v1/ebay/callback
EBAY_RUNAME=your_runame
EBAY_ENVIRONMENT=sandbox

# Keepa
KEEPA_API_KEY=your_keepa_key

# Amazon şifreleme (32 byte hex)
AMAZON_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS (domain belirledikten sonra güncelleyin)
CORS_ORIGIN=http://SIZIN_DOMAIN
FRONTEND_URL=http://SIZIN_DOMAIN
```

### Opsiyonel Değişkenler

```env
# Email (kayıt/onay için)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASSWORD=app_password
SMTP_FROM=your@gmail.com

# Web portu (varsayılan 80)
WEB_PORT=80
```

---

## Adım 5: Domain ve SSL

### Domain Yönlendirme

1. Hostinger (veya domain sağlayıcınız) panelinde DNS ayarlarına gidin
2. VPS IP'nize bir A kaydı ekleyin:
   ```
   A    test.zonds.com    →    SIZIN_VPS_IP
   ```

### Coolify'da Domain ve SSL

1. Coolify UI → `web` servisini seçin
2. **"Configuration"** → **"Domains"** alanına: `test.zonds.com`
3. **"HTTPS"** → **"Let's Encrypt"** aktif edin
4. Coolify otomatik SSL sertifikası alır

`api` servisine ayrı domain gerekmez — nginx web servisi üzerinden `/api/` path'ini API'ye proxy'ler.

> 📌 Domain değişikliğinden sonra `CORS_ORIGIN` ve `FRONTEND_URL` env var'larını güncellemeyi unutmayın!
>
> Örnek: `CORS_ORIGIN=https://test.zonds.com` ve `FRONTEND_URL=https://test.zonds.com`

---

## Adım 6: İlk Deploy

Her şey hazır olduğunda:

1. Coolify UI'da **"Deploy"** butonuna basın
2. İlk build 5-15 dakika sürebilir (Playwright Chromium indiriyor)
3. Logları **"Logs"** sekmesinden takip edin

### Beklenen Build Sırası

```
1. PostgreSQL başlar → healthcheck geçer
2. Redis başlar → healthcheck geçer
3. API build olur → migration çalışır → sunucu başlar
4. Web build olur → nginx başlar → uygulama erişilebilir
```

Başarılı olduğunda `http://test.zonds.com` (veya VPS IP) üzerinden uygulamaya erişebilirsiniz.

### Deploy'u Doğrulama

```bash
# API health check
curl http://SIZIN_VPS_IP/api/health

# Beklenen yanıt: {"status":"ok"}
```

---

## 🔄 Güncelleme (Yeni Deploy)

Kod değiştiğinde:

1. `git push` yapın
2. Coolify UI'da **"Redeploy"** butonuna basın
3. Coolify otomatik yeniden build eder

### Otomatik Deploy

Coolify → Servis → **"Configuration"** → **"Watch Paths"** → `*` ekleyin

Her push'ta otomatik deploy başlar.

---

## 🏗️ Mimari Özeti

```
Internet → Coolify Traefik (SSL) → nginx (web:80)
                                    ├── /        → React SPA (statik dosyalar)
                                    └── /api/*   → NestJS API (api:3000)
                                                    ├── PostgreSQL (postgres:5432)
                                                    ├── Redis (redis:6379)
                                                    └── Playwright Chromium
```

### Servisler ve Portlar

| Servis | İç Port | Dış Erişim | Açıklama |
|--------|---------|------------|----------|
| web (nginx) | 80 | Domain üzerinden | React SPA + API proxy |
| api (NestJS) | 3000 | Yok (sadece iç) | REST API |
| postgres | 5432 | Yok (sadece iç) | PostgreSQL 16 |
| redis | 6379 | Yok (sadece iç) | Redis 7 |

### Docker Volume'lar

| Volume | Amaç |
|--------|------|
| `postgres_data` | Veritabanı verisi (kalıcı) |
| `redis_data` | Redis verisi (kalıcı) |
| `browser_state` | Playwright session dosyaları |

---

## 🐛 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| **Build OOM (out of memory)** | VPS en az 4GB RAM olmalı. Swap ekleyin (aşağıya bakın) |
| **Migration başarısız** | API loglarını kontrol edin. `DATABASE_URL` doğru mu? PostgreSQL healthy mi? |
| **502 Bad Gateway** | API container'ı çalışıyor mu? `docker ps` ile kontrol edin |
| **CORS hatası** | `CORS_ORIGIN` env var'ını domain'inize göre güncelleyin |
| **Playwright hatası** | `playwright install --with-deps` loglarını kontrol edin |
| **İlk deploy çok yavaş** | Normaldir. Playwright Chromium ~400MB indirir. Sonraki deploy'lar Docker cache kullanır |
| **SSL sertifikası alınamıyor** | Domain DNS kaydının VPS IP'ye yöneldiğinden emin olun. 5-10 dakika bekleyin |

### Swap Ekleme (RAM yetmiyorsa)

```bash
# VPS'te çalıştırın
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Kalıcı yapmak için
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Faydalı Komutlar (VPS'te)

```bash
# Container durumunu gör
docker ps

# API loglarını izle
docker logs -f <api_container_id>

# Tüm servis loglarını izle
cd /data/coolify/compose/<project-id>
docker compose logs -f

# Database'e bağlan
docker exec -it <postgres_container_id> psql -U zonds_user -d zonds_db

# Container içine gir (debug için)
docker exec -it <api_container_id> sh

# Manuel migration çalıştır
docker exec -it <api_container_id> node dist/scripts/migrate.js

# Disk kullanımını kontrol et
docker system df

# Temizlik (dangling images, unused containers)
docker system prune -f
```

---

## 📌 Adım Adım Checklist

Bu checklist'i takip ederek hiçbir adımı atlamadığınızdan emin olun:

- [ ] VPS en az 4GB RAM, 2 vCPU, 40GB SSD
- [ ] VPS'te Ubuntu 22.04/24.04 kurulu
- [ ] Coolify kuruldu (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`)
- [ ] Coolify admin hesap oluşturuldu
- [ ] Repo'da deployment dosyaları push'landı
- [ ] Coolify'da yeni proje oluşturuldu
- [ ] Docker Compose resource eklendi (repo bağlandı)
- [ ] `docker-compose.production.yml` compose dosyası olarak seçildi
- [ ] Ortam değişkenleri ayarlandı (en azından: POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET)
- [ ] DNS A kaydı eklendi (domain → VPS IP)
- [ ] Coolify'da domain ayarlandı (web servisine)
- [ ] Let's Encrypt SSL aktif edildi
- [ ] CORS_ORIGIN ve FRONTEND_URL domain'e göre güncellendi
- [ ] İlk deploy başarılı oldu
- [ ] `http(s)://domain/api/health` endpoint'inden "ok" yanıtı alındı
- [ ] Uygulama tarayıcıda açılıyor
