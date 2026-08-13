# ☁️ Coolify Cloud'a Geçiş — Kendi Server'ını Bağlama

> **Kısa cevap: Evet, kendi server'ını Coolify Cloud'a bağlayabilirsin.** Coolify Cloud'a üye olduğunda Coolify'nin kendisi (dashboard, DB, queue, realtime) **Coolify'nin kendi sunucularında** çalışır — sen sadece bir "Server" (senin VPS'in) **bağlarsın**, uygulamalar o bağladığın VPS üzerinde deploy edilir.
>
> ### ⚠️ Bu, "başka projelerin de olduğu paylaşımlı bir VPS'i" kapsamaz
>
> Bir VPS'te self-hosted Coolify **zaten** çalışıyorsa ve o instance **başka proje(ler)i de** yönetiyorsa (senin mevcut Hostinger VPS'in gibi), o VPS'i Cloud'a **bağlama** — self-hosted'ın kendi proxy'si (Traefik, `coolify-proxy` container'ı) VPS'in 80/443 portlarını zaten dinliyor ve diğer projelerin routing'ini yapıyor. Cloud da o VPS'i "Server" olarak eklediğinde kendi proxy'sini aynı portlara oturtmaya çalışır → iki bağımsız Coolify instance'ı (self-hosted + Cloud) aynı Traefik config'ini kendi veritabanına göre periyodik olarak yeniden yazar, biri diğerinin routing kurallarını bilmediği için üzerine yazar → hem eski projelerin hem yeni app'in routing'i rastgele aralıklarla bozulur (bilinen, çözülmemiş bir Coolify sorunu — [GitHub Issue #7720](https://github.com/coollabsio/coolify/issues/7720)).
>
> **Bu doküman şu senaryo için geçerli:** elinde/alacağın **başka hiçbir projenin barınmadığı, tek amaçlı (dedicated)** bir server var (yeni bir VPS, ya da üzerinde SADECE self-hosted Coolify kurulu — başka app yok — bir VPS). Örn. **production'ı** ayrı, tek amaçlı bir server'da Cloud üzerinden kurmak istiyorsan bu akış geçerli.
>
> Mevcut paylaşımlı Hostinger VPS'inde **UAT/test ortamı** kurmak için bunun yerine → [`docs/deployment-guide.md`](./deployment-guide.md) (aynı VPS'teki mevcut self-hosted Coolify'a yeni bir app olarak eklenir, hiçbir şey kaldırılmaz).

DB resource oluşturma / env var girme / domain-SSL gibi tekrar eden adımlar için [`docs/deployment-guide.md`](./deployment-guide.md)'ye referans veriyorum — Coolify Cloud'un dashboard'u self-hosted ile **birebir aynı arayüz** (aynı açık kaynak kod, sadece nerede çalıştığı farklı), o yüzden o adımları tekrar yazmıyorum.

---

## 🏗️ Self-hosted ile Cloud arasındaki fark

```
SELF-HOSTED (şu an):
  VPS ──────────────────────────────────────────
   ├── Coolify dashboard/DB/queue (coolify-* container'lar)
   ├── Traefik proxy (coolify-proxy)
   └── Deploy ettiğin app'ler (sellerhill-api, sellerhill-web, ...)
  ────────────────────────────────────────────────
  Tek makine hem paneli hem app'leri taşıyor.

COOLIFY CLOUD (hedef):
  Coolify'nin altyapısı ─────────────  Senin VPS'in ──────────────
   ├── Dashboard                       ├── Traefik proxy (Coolify Cloud kurar)
   ├── DB (proje/env-var kayıtları)    └── Deploy ettiğin app'ler
   └── Deploy tetikleyici (SSH ile)        (sellerhill-api, sellerhill-web, ...)
  ────────────────────────────────       ────────────────────────────
  Panel Coolify'de, app'ler senin VPS'inde. Aradaki bağlantı SSH.
```

**Önemli sonuç:** Coolify Cloud'un DB'si (proje adı, env var'lar, domain ayarları, deploy geçmişi) **self-hosted'takinden tamamen ayrı**. Yani mevcut self-hosted panelde girdiğin hiçbir ayar Cloud'a otomatik taşınmaz — env var'ları, domain'i, DB bağlantı bilgilerini **Cloud panelinde yeniden gireceksin** (Adım 4-6). Uygulamanın kendisi (Docker image, kod) değişmiyor; sadece "kim orkestre ediyor" değişiyor.

---

## ⚠️ Ön kontrol — kaldırmadan önce

Self-hosted Coolify'ı kaldırmak (Adım 2), Coolify'nin **kendi yönettiği** kaynakları siler: `/data/coolify` dizini (compose dosyaları + Coolify'nin oluşturduğu volume/DB verisi dahil) ve `coolify-*` container'ları.

Kaldırmadan önce şunu netleştir:

- [ ] Bu VPS'te şu an **tutmak istediğin veri var mı?** (örn. self-hosted panelden oluşturduğun Postgres resource'unda gerçek test siparişleri/kullanıcılar var mı?)
  - Varsa: `docker exec -it <postgres_container_id> pg_dump -U sellerhill_user sellerhill_db > backup.sql` ile önce yedek al, kendi bilgisayarına indir (`scp root@VPS_IP:/root/backup.sql .`).
  - Yoksa (sadece deneme/kurulum amaçlıysa): direkt Adım 2'ye geç, kayıp önemli değil.
- [ ] Şu an bu domain/subdomain **canlı trafik alıyor mu?** Alıyorsa DNS'i yeni kuruluma yönlendirene kadar kısa bir kesinti olacağını hesaba kat (UAT ortamı için genelde sorun değil).

---

## 💰 Maliyet notu

Coolify Cloud "bring your own server" modeli: panel Coolify'de barınıyor, sen kendi VPS'ini bağlıyorsun.

- **$5/ay** → 2 bağlı server'a kadar
- Ek her server **+$3/ay**
- Yıllık ödemede **%20 indirim**
- Senin tarafında ek maliyet: sadece mevcut Hostinger VPS faturası (zaten ödüyordun)

Yani tek VPS bağlayacaksan aylık ek maliyet **$5** (Coolify Cloud aboneliği) + zaten ödediğin VPS ücreti. Güncel fiyat için [coolify.io/pricing](https://coolify.io/pricing) kontrol et — bu rakamlar değişebilir.

---

## Adım 1: Coolify Cloud'a Üye Ol

1. [app.coolify.io](https://app.coolify.io) (veya coolify.io üzerinden "Cloud" → "Get Started") adresinden hesap oluştur.
2. Bir ödeme planı seç (yukarıdaki maliyet notuna bak).
3. Cloud dashboard'una giriş yap — arayüz self-hosted ile **birebir aynı**.

---

## Adım 2: Mevcut Self-Hosted Coolify'ı VPS'ten Kaldır

```bash
ssh root@SIZIN_VPS_IP

# 1) Coolify'nin kendi container'larını durdur ve sil
sudo docker stop -t 0 coolify coolify-realtime coolify-db coolify-redis coolify-proxy coolify-sentinel
sudo docker rm coolify coolify-realtime coolify-db coolify-redis coolify-proxy coolify-sentinel

# 2) Coolify'nin kendi volume'larını sil (panel verisi — app verisi değil)
sudo docker volume rm coolify-db coolify-redis

# 3) Coolify network'ünü sil
sudo docker network rm coolify

# 4) Coolify veri dizinini sil (compose dosyaları + resource verisi burada)
sudo rm -rf /data/coolify

# 5) (opsiyonel) Coolify image'larını da temizlemek istersen
docker images | grep -E "coollabsio/coolify|coolify-helper|soketi" | awk '{print $3}' | xargs -r docker rmi
```

> ⚠️ Bu komutlar **sadece `coolify-*` adlı container'ları ve `/data/coolify` dizinini** hedefler — resmi Coolify uninstall prosedürü budur. Ama `/data/coolify` altında Coolify'nin yönettiği Postgres/Redis resource verisi de bulunduğu için, Adım "Ön kontrol"deki yedeği almadan bu adımı çalıştırma.
>
> Kaldırma bitince VPS'te sadece çıplak Docker kalır (varsa başka bağımsız container'lar etkilenmez).

---

## Adım 3: VPS'i Coolify Cloud'a "Server" Olarak Bağla

1. Cloud dashboard → **"Servers"** → **"+ Add Server"**
2. Bilgileri gir:
   - **Name:** `sellerhill-prod` (veya tercih ettiğin isim — bu server'da ne çalıştıracaksan ona göre adlandır)
   - **IP Address:** VPS'inin IP'si
   - **User:** `root` (veya sudo yetkili bir kullanıcı)
   - **Port:** `22`
3. Coolify sana bir **public SSH key** gösterecek. Bunu VPS'te authorized_keys'e ekle:

   ```bash
   # VPS'te (root olarak):
   echo "COOLIFY_CLOUD_PUBLIC_KEY_BURAYA" >> ~/.ssh/authorized_keys
   ```

   (Alternatif: kendi private key'ini Coolify'ye yapıştırıp o key ile bağlanmasını da sağlayabilirsin — panelde iki seçenek de var.)
4. Panelde **"Validate Server"** / **"Check Connection"** tıkla. Coolify SSH ile bağlanıp Docker'ın kurulu olduğunu doğrular (yoksa kurar).
5. Bağlantı yeşil ✅ olunca server hazır.

---

## Adım 4: Proje + App'i Oluştur

`docs/deployment-guide.md`'nin **Adım 4**'ü ile aynı akış, tek fark artık Cloud panelindesin:

1. **"+ Add New"** → **"Project"** → ad: `sellerhill-prod` (ya da bu server ne için ise ona göre)
2. Proje altında **"+ Add New Resource"** → **"Docker Compose"**
3. Git repository bağla:
   - **Repository URL:** `https://github.com/ttakci/sellerhill.git`
   - **Branch / Compose File:** production için `main` + `docker-compose.production.yml`, test/UAT için `UAT` + `docker-compose.test.yml` — bkz. `deployment-guide.md`'nin başındaki karşılaştırma tablosu
   - Deploy Key/Access Token gerekiyorsa ekle (repo private ise)
4. Servislere domain ata — `deployment-guide.md` Adım 4.3 ile aynı mantık: **sadece `web` servisine domain ver**, `api`'ye verme.

---

## Adım 5-8: DB Resource, Env Var'lar, Domain/SSL, İlk Deploy

Bu adımlar `docs/deployment-guide.md`'nin **Adım 3, 5 (5.4 Grafana dahil), 6, 7**'siyle bire bir aynı — o dokümanı adım adım takip et, tek fark panelin Cloud'da olması. Özetle:

| Adım | Ne yapılacak | Referans |
|---|---|---|
| PostgreSQL + Redis resource oluştur | Coolify DB resource'ları aç (compose içinde DEĞİL) | `deployment-guide.md` Adım 3 |
| Env var'ları gir | `DATABASE_URL`, `REDIS_HOST/PORT`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS` | `deployment-guide.md` Adım 5.1 |
| eBay kimlikleri | Production ise gerçek eBay prod kimlikleri, test/UAT ise sandbox | `deployment-guide.md` Adım 5.2 |
| Keepa, Amazon encryption key, SMTP vb. | Aynı env var'lar | `deployment-guide.md` Adım 5.3 |
| `GRAFANA_ADMIN_USER/PASSWORD` | Zorunlu — Loki/Promtail/Grafana compose'un içinde | `deployment-guide.md` Adım 5.4 |
| DNS A kaydı | domain → server IP | `deployment-guide.md` Adım 6 |
| SSL (Let's Encrypt) | `web` servisi → Domains → HTTPS aç | `deployment-guide.md` Adım 6 |
| İlk deploy | **"Deploy"** tıkla, logları izle | `deployment-guide.md` Adım 7 |
| Doğrulama | `curl https://<domain>/api/v1/health` | `deployment-guide.md` Adım 7 |

---

## 🔄 Sonraki güncellemeler

```bash
git push origin main   # production için (ya da UAT için: git push origin UAT)
```

Coolify Cloud panelinde **"Redeploy"** — ya da **"Watch Paths" → `*`** açarsan her push'ta otomatik deploy olur (`deployment-guide.md`'deki "Otomatik Deploy" ile aynı).

---

## 🐛 Sorun Giderme (Cloud'a özel)

| Sorun | Çözüm |
|---|---|
| **Server "Validate" adımında başarısız** | VPS'te firewall 22 portunu Coolify Cloud'un IP'lerine açık mı kontrol et (Coolify docs'ta güncel IP listesi var). `ssh root@VPS_IP` kendi makinenden çalışıyor mu diye test et. |
| **Deploy sırasında "port 80/443 already in use"** | Adım 2'deki uninstall tam yapılmamış demektir — `docker ps -a` ile eski `coolify-proxy` container'ının gerçekten silindiğini doğrula. |
| **Eski self-hosted panele hâlâ erişebiliyorum** | Adım 2'yi çalıştırdıysan panel açılmamalı (`coolify` container silindi). Tarayıcı cache'i olabilir, farklı sekmede dene. |
| **GRAFANA_ADMIN_PASSWORD hatası, container başlamıyor** | `docker-compose.test.yml`'de bu değişken zorunlu (`:?`) — Cloud panelinde env var olarak eklemeyi unutma. |
| Diğer tüm sorunlar (migration, 502, Playwright, DBeaver bağlantısı) | `deployment-guide.md`'nin "Sorun Giderme" tablosu aynen geçerli — komutlar (`docker ps`, `docker compose logs -f api`, vb.) VPS'te değişmedi. |

---

## 📌 Checklist

- [ ] Bu server **başka hiçbir projeyi barındırmıyor** (paylaşımlıysa bu dokümanı KULLANMA — bkz. giriş uyarısı)
- [ ] Mevcut self-hosted panelde tutulması gereken veri varsa yedeklendi
- [ ] Coolify Cloud hesabı açıldı, plan seçildi
- [ ] Server'da self-hosted Coolify kaldırıldı (Adım 2 komutları çalıştırıldı) — YALNIZCA daha önce self-hosted kuruluysa
- [ ] `docker ps -a` ile eski `coolify-*` container'ların gerçekten gittiği doğrulandı
- [ ] Server, Coolify Cloud'a "Server" olarak eklendi ve **Validate** yeşil
- [ ] Proje oluşturuldu, repo bağlandı: doğru branch + compose dosyası seçildi (production: `main`+`docker-compose.production.yml`, test/UAT: `UAT`+`docker-compose.test.yml`)
- [ ] PostgreSQL + Redis DB resource'ları oluşturuldu, çalışıyor
- [ ] Domain sadece `web` servisine atandı
- [ ] Tüm zorunlu env var'lar girildi (`GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` dahil)
- [ ] eBay redirect URI güncellendi (doğru ortam: sandbox ya da production)
- [ ] DNS A kaydı eklendi, SSL aktif
- [ ] İlk deploy başarılı, `/api/v1/health` "ok" dönüyor
- [ ] Uygulama tarayıcıda açılıyor, doğru branch'teki değişiklikler görünüyor
