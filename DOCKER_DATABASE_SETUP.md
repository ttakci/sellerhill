# Docker & Database Setup

## 📦 Servisler

Docker Compose ile çalışan servisler:

- **PostgreSQL** (Port: 5432) - Ana veritabanı
- **Redis** (Port: 6379) - Cache/Session storage (opsiyonel)
- **pgAdmin** (Port: 5050) - Database yönetim arayüzü

## 🚀 Hızlı Başlangıç

### 1. Docker Servislerini Başlat

```bash
# Tüm servisleri başlat
docker-compose up -d

# Sadece PostgreSQL başlat
docker-compose up -d postgres

# Logları izle
docker-compose logs -f

# Servisleri durdur
docker-compose down

# Servisleri durdur ve verileri sil
docker-compose down -v
```

### 2. Database Bağlantısı

**.env** dosyası zaten yapılandırılmış durumda:

```env
DATABASE_URL=postgresql://zonds_user:zonds_password_change_in_production@localhost:5432/zonds_db
```

### 3. pgAdmin'e Erişim

1. Tarayıcıda aç: http://localhost:5050
2. Login bilgileri:
   - Email: `admin@zonds.com`
   - Password: `admin123`

3. Yeni sunucu ekle:
   - Host: `postgres` (veya `host.docker.internal` Windows/Mac için)
   - Port: `5432`
   - Database: `zonds_db`
   - Username: `zonds_user`
   - Password: `zonds_password_change_in_production`

## 📊 Database Schema

### Users Tablosu
```sql
- id (UUID, PK)
- first_name (VARCHAR)
- last_name (VARCHAR)
- email (VARCHAR, UNIQUE)
- password_hash (TEXT)
- email_verified (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### eBay Accounts Tablosu
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users)
- seller_id (VARCHAR)
- marketplace_id (VARCHAR)
- access_token (TEXT)
- refresh_token (TEXT)
- access_token_expires_at (TIMESTAMP)
- status (VARCHAR: active|revoked|error)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

UNIQUE: (seller_id, marketplace_id)
```

## 🔧 Kullanışlı Komutlar

### PostgreSQL CLI'ya Bağlan
```bash
docker exec -it zonds_postgres psql -U zonds_user -d zonds_db
```

### Database Backup
```bash
docker exec zonds_postgres pg_dump -U zonds_user zonds_db > backup.sql
```

### Database Restore
```bash
docker exec -i zonds_postgres psql -U zonds_user -d zonds_db < backup.sql
```

### Redis CLI'ya Bağlan
```bash
docker exec -it zonds_redis redis-cli
```

### Container Loglarını İzle
```bash
# PostgreSQL
docker-compose logs -f postgres

# Redis
docker-compose logs -f redis

# pgAdmin
docker-compose logs -f pgadmin
```

## 🧪 Test Kullanıcısı

Otomatik olarak oluşturulan test kullanıcısı:

- **Email**: `test@example.com`
- **Password**: `Test123!`

## 📝 Notlar

- **Production**: `.env` dosyasındaki şifreleri mutlaka değiştirin!
- **Volumes**: `docker-compose down -v` ile veriler silinir, dikkatli kullanın
- **Network**: Tüm servisler `zonds_network` bridge network'ünde çalışır
- **Health Checks**: PostgreSQL ve Redis için health check yapılandırılmış
- **Auto-restart**: Container'lar otomatik yeniden başlar (unless-stopped)

## 🔐 Güvenlik

Production ortamında:
1. Tüm şifreleri değiştirin
2. pgAdmin'i kapatın veya şifre koyun
3. PostgreSQL portunu dışarıya kapatın
4. SSL/TLS sertifikaları ekleyin
5. Network izolasyonu yapın

## 🐛 Sorun Giderme

### Port zaten kullanımda hatası
```bash
# Kullanılan portları kontrol et
netstat -ano | findstr :5432
netstat -ano | findstr :6379
netstat -ano | findstr :5050

# Alternatif portlar kullan (docker-compose.yml'i düzenle)
```

### Container başlamıyor
```bash
# Container durumunu kontrol et
docker-compose ps

# Detaylı logları incele
docker-compose logs postgres
docker-compose logs redis

# Container'ı yeniden oluştur
docker-compose up -d --force-recreate postgres
```

### Database bağlantı hatası
```bash
# PostgreSQL'in hazır olup olmadığını kontrol et
docker exec zonds_postgres pg_isready -U zonds_user

# Manuel bağlantı testi
docker exec -it zonds_postgres psql -U zonds_user -d zonds_db -c "SELECT version();"
```
