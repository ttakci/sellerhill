# Stok 0 Sorunu - Debug Rehberi

## Sorun

Ürün başarıyla listelendi ancak stok miktarı 0 olarak görünüyor.

## Olası Nedenler

### 1. Keepa API Başarısız Oldu

- Keepa API 400 hatası verdi
- ScraperAPI fallback verisi kullanıldı
- ScraperAPI'den gelen stok bilgisi 0 veya eksik olabilir

### 2. Amazon Stoğu Kullanıcı Tercihinden Az

```typescript
// Stok Hesaplama Mantığı
const userPreferredStock = group.stock?.defaultQuantity || 1;
const amazonStock = product.stock ?? 0;
const quantity = amazonStock >= userPreferredStock ? userPreferredStock : 0;
```

**Örnek Senaryolar:**

- User Preferred: 5, Amazon Stock: 3 → eBay Quantity: 0 ❌
- User Preferred: 5, Amazon Stock: 10 → eBay Quantity: 5 ✅
- User Preferred: 1, Amazon Stock: 3 → eBay Quantity: 1 ✅

### 3. Keepa Stok Çıkarma Hatası

Keepa API'den stok bilgisi doğru çıkarılamadı.

## Debug Adımları

### 1. Logları Kontrol Edin

Şu log mesajlarını arayın:

```
[KeepaService] Keepa data for <ASIN>: price=X, stock=Y
[ListingStrategyService] Stock calculation for <ASIN>: Amazon stock=X, User preferred=Y, Final quantity=Z
```

### 2. Keepa API Yanıtını İnceleyin

Eğer Keepa başarılı olduysa:

```
[ListingProcessorService] Keepa data received: price=29.99 USD, stock=10
```

Eğer Keepa başarısız olduysa:

```
[KeepaService] Keepa API error for <ASIN>: Request failed with status code 400
[ListingProcessorService] Failed to fetch Keepa data for <ASIN>. Using ScraperAPI price/stock as fallback.
```

### 3. Listing Settings Group Kontrolü

Database'de kontrol edin:

```sql
SELECT id, name, stock FROM listing_settings_groups WHERE user_id = '<USER_ID>';
```

`stock` field'ı şu formatta olmalı:

```json
{
  "defaultQuantity": 5,
  "autoSync": true
}
```

### 4. ScraperAPI Stok Verisi

Eğer Keepa başarısız olduysa, ScraperAPI'den gelen stok verisini kontrol edin:

```
[ScraperApiService] ScraperAPI response for <ASIN>: ...
```

ScraperAPI stok çıkarma mantığı:

```typescript
stock: product.availability?.quantity ||
  product.buybox_winner?.availability?.quantity ||
  (product.availability?.status?.includes('In Stock') ? 10 : 0);
```

## Çözümler

### Çözüm 1: User Preferred Stock'u Azaltın

Eğer Amazon'da az stok varsa, listing settings group'taki `defaultQuantity` değerini düşürün.

**Örnek:**

- Mevcut: `defaultQuantity: 10`
- Yeni: `defaultQuantity: 1` veya `defaultQuantity: 3`

### Çözüm 2: Keepa API Sorununu Çözün

Keepa API 400 hatası alıyorsanız:

1. **API Key Kontrolü**: `.env` dosyasında `KEEPA_API_KEY` doğru mu?
2. **Token Limiti**: Keepa dashboard'da kalan token sayınızı kontrol edin
3. **ASIN Geçerliliği**: ASIN Amazon.com'da mevcut mu?
4. **Domain ID**: Doğru domain kullanılıyor mu? (1 = amazon.com)

### Çözüm 3: Stok Mantığını Değiştirin (Opsiyonel)

Eğer overselling riskini kabul ediyorsanız, mantığı değiştirebilirsiniz:

```typescript
// Mevcut (Güvenli - Overselling yok)
const quantity = amazonStock >= userPreferredStock ? userPreferredStock : 0;

// Alternatif 1 (Daha esnek - Mevcut stoğu kullan)
const quantity = Math.min(amazonStock, userPreferredStock);

// Alternatif 2 (En esnek - Her zaman listele)
const quantity = userPreferredStock;
```

⚠️ **Uyarı**: Alternatif mantıklar overselling riskini artırır!

## Test Senaryosu

### Senaryo 1: Keepa Başarılı, Yeterli Stok

```
ASIN: B08N5WRWNW
Keepa Stock: 15
User Preferred: 5
→ Beklenen: eBay Quantity = 5 ✅
```

### Senaryo 2: Keepa Başarılı, Yetersiz Stok

```
ASIN: B08N5WRWNW
Keepa Stock: 2
User Preferred: 5
→ Beklenen: eBay Quantity = 0 ❌
```

### Senaryo 3: Keepa Başarısız, ScraperAPI Fallback

```
ASIN: B08N5WRWNW
Keepa: FAILED (400)
ScraperAPI Stock: 10
User Preferred: 5
→ Beklenen: eBay Quantity = 5 ✅
```

## Hızlı Kontrol Komutu

API loglarında son eklenen ürünün stok bilgisini görmek için:

```bash
# Windows PowerShell
Get-Content -Path "api.log" -Tail 100 | Select-String "Stock calculation"

# Linux/Mac
tail -100 api.log | grep "Stock calculation"
```

## Sonraki Adımlar

1. ✅ Debug logging eklendi
2. 🔄 Yeni bir ürün ekleyin
3. 📊 Logları kontrol edin:
   - Keepa API başarılı mı?
   - Amazon stock ne kadar?
   - User preferred stock ne kadar?
   - Final quantity neden 0?
4. 🔧 Gerekirse `defaultQuantity` değerini ayarlayın

## Önerilen Ayarlar

**Yüksek Hacimli Satış İçin:**

```json
{
  "defaultQuantity": 1 // Her zaman 1 adet listele
}
```

**Orta Hacimli Satış İçin:**

```json
{
  "defaultQuantity": 3 // 3 adet varsa listele
}
```

**Düşük Hacimli/Premium Ürünler İçin:**

```json
{
  "defaultQuantity": 10 // Sadece bol stoklu ürünleri listele
}
```
