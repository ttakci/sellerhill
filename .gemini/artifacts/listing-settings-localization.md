# Listing Settings Groups - Localization Keys

## English (en/listing-settings.json)

```json
{
  "title": "Listing Settings Groups",
  "subtitle": "Manage and assign strategy templates to your product listings for automated optimization.",
  "createNewGroup": "Create New Group",
  "editGroup": "Edit Listing Group",
  "backToList": "Back to Groups",
  "connectorSubtitle": "AMAZON TO EBAY CONNECTOR",
  
  "groupDetails": "Group Details",
  "groupName": "Group Name",
  "groupNamePlaceholder": "e.g., Premium Electronics",
  "description": "Description",
  "descriptionPlaceholder": "Enter group internal notes...",
  
  "repricingStrategy": "Repricing Strategy",
  "addPriceRange": "Add Price Range",
  "removePriceRange": "Remove Price Range",
  "minPrice": "Min Price ($)",
  "maxPrice": "Max Price ($)",
  "profitMargin": "Profit Margin (%)",
  "fixedProfit": "Fixed Profit ($)",
  "priceRangeLabel": "Price Range {{index}}",
  
  "stock": "Stock",
  "defaultQuantity": "Default Quantity",
  "autoRestock": "Auto-restock on sale",
  "autoRestockDescription": "Automatically restock items when they are sold",
  
  "fees": "Fees",
  "ebayFee": "eBay Fee",
  "ebayFeePercent": "eBay Fee (%)",
  "fixedFee": "Fixed Fee",
  "fixedFeeAmount": "Fixed Fee ($)",
  "tax": "Tax",
  "taxPercent": "Tax (%)",
  
  "templates": "Template",
  "customTemplate": "Custom",
  "predefinedTemplate": "Predefined",
  "selectTemplate": "Select Template",
  "selectTemplatePlaceholder": "Choose a predefined template...",
  "htmlEditor": "HTML Editor",
  "templatePlaceholder": "Enter your custom HTML template...",
  "templateVariablesHelp": "Use variables like {{product_title}}, {{product_price}}, {{product_image}}, {{product_description}}",
  
  "preview": "Preview",
  "livePreview": "Live Preview",
  "darkModePreview": "Dark Mode Preview",
  "desktopView": "Desktop View",
  "mobileView": "Mobile View",
  "renderingPreview": "Rendering preview...",
  
  "saveChanges": "Save Changes",
  "saving": "Saving...",
  "cancel": "Cancel",
  "delete": "Delete",
  "deleteGroup": "Delete Group",
  "confirmDelete": "Are you sure you want to delete this group?",
  "confirmDeleteMessage": "This action cannot be undone. Products using this group will need to be reassigned.",
  "deleteSuccess": "Group deleted successfully",
  "deleteFailed": "Failed to delete group",
  
  "productsCount_one": "{{count}} product",
  "productsCount_other": "{{count}} products",
  "noProducts": "No products",
  
  "statusActive": "Active",
  "statusDraft": "Draft",
  "statusInactive": "Inactive",
  
  "emptyState": {
    "title": "No Listing Groups Yet",
    "description": "Create your first group to start organizing your listings",
    "action": "Create New Group"
  },
  
  "predefinedTemplates": {
    "modernMinimalist": "Modern Minimalist",
    "modernMinimalistDesc": "Clean and professional design with focus on product details",
    "premiumElectronics": "Premium Electronics",
    "premiumElectronicsDesc": "High-end design for electronics with technical specifications",
    "ecommerceClassic": "E-commerce Classic",
    "ecommerceClassicDesc": "Traditional layout with clear sections and call-to-action"
  },
  
  "validation": {
    "nameRequired": "Group name is required",
    "nameMinLength": "Group name must be at least 3 characters",
    "nameMaxLength": "Group name must not exceed 100 characters",
    "minPrice": "Minimum price must be greater than 0",
    "maxPrice": "Maximum price must be greater than 0",
    "maxPriceGreaterThanMin": "Maximum price must be greater than minimum price",
    "profitRequired": "Either profit margin or fixed profit is required",
    "profitMarginRange": "Profit margin must be between 0 and 100",
    "fixedProfitMin": "Fixed profit must be 0 or greater",
    "minQuantity": "Quantity must be at least 1",
    "maxQuantity": "Quantity must not exceed 9999",
    "maxFeePercent": "Fee percentage cannot exceed 100%",
    "minFeePercent": "Fee percentage must be 0 or greater",
    "minFixedFee": "Fixed fee must be 0 or greater",
    "maxTaxPercent": "Tax percentage cannot exceed 100%",
    "minTaxPercent": "Tax percentage must be 0 or greater",
    "templateRequired": "Template content is required",
    "templateMinLength": "Template must be at least 10 characters",
    "predefinedTemplateRequired": "Please select a predefined template",
    "minOnePriceRange": "At least one price range is required",
    "maxPriceRanges": "Maximum 10 price ranges allowed",
    "overlappingPriceRanges": "Price ranges cannot overlap"
  },
  
  "errors": {
    "loadFailed": "Failed to load listing groups",
    "saveFailed": "Failed to save changes",
    "createFailed": "Failed to create group",
    "updateFailed": "Failed to update group",
    "deleteFailed": "Failed to delete group",
    "templateLoadFailed": "Failed to load predefined templates",
    "unauthorized": "You don't have permission to perform this action",
    "notFound": "Listing group not found",
    "networkError": "Network error. Please check your connection.",
    "unknownError": "An unexpected error occurred"
  },
  
  "success": {
    "created": "Listing group created successfully",
    "updated": "Listing group updated successfully",
    "deleted": "Listing group deleted successfully",
    "saved": "Changes saved successfully"
  },
  
  "tooltips": {
    "editGroup": "Edit group",
    "deleteGroup": "Delete group",
    "addPriceRange": "Add another price range",
    "removePriceRange": "Remove this price range",
    "toggleDarkMode": "Toggle dark mode preview",
    "switchToDesktop": "Switch to desktop view",
    "switchToMobile": "Switch to mobile view",
    "copyTemplate": "Copy template HTML",
    "resetTemplate": "Reset to default template"
  },
  
  "help": {
    "repricingStrategy": "Define multiple price ranges with different profit margins. Products will be priced according to their cost range.",
    "profitMargin": "Percentage-based profit calculated from the product cost.",
    "fixedProfit": "Fixed dollar amount added to the product cost.",
    "ebayFee": "eBay's final value fee percentage (typically 10-15%).",
    "fixedFee": "eBay's fixed listing fee (typically $0.30).",
    "tax": "Sales tax percentage for your location.",
    "customTemplate": "Write your own HTML template with custom styling.",
    "predefinedTemplate": "Choose from professionally designed templates.",
    "templateVariables": "Use {{product_title}}, {{product_price}}, {{product_image}}, {{product_description}}, {{product_specs}} in your template."
  }
}
```

---

## Turkish (tr/listing-settings.json)

```json
{
  "title": "Listeleme Ayarları Grupları",
  "subtitle": "Otomatik optimizasyon için ürün listelerinize strateji şablonları yönetin ve atayın.",
  "createNewGroup": "Yeni Grup Oluştur",
  "editGroup": "Listeleme Grubunu Düzenle",
  "backToList": "Gruplara Dön",
  "connectorSubtitle": "AMAZON'DAN EBAY'E BAĞLAYICI",
  
  "groupDetails": "Grup Detayları",
  "groupName": "Grup Adı",
  "groupNamePlaceholder": "örn., Premium Elektronik",
  "description": "Açıklama",
  "descriptionPlaceholder": "Grup iç notlarını girin...",
  
  "repricingStrategy": "Yeniden Fiyatlandırma Stratejisi",
  "addPriceRange": "Fiyat Aralığı Ekle",
  "removePriceRange": "Fiyat Aralığını Kaldır",
  "minPrice": "Min Fiyat ($)",
  "maxPrice": "Maks Fiyat ($)",
  "profitMargin": "Kâr Marjı (%)",
  "fixedProfit": "Sabit Kâr ($)",
  "priceRangeLabel": "Fiyat Aralığı {{index}}",
  
  "stock": "Stok",
  "defaultQuantity": "Varsayılan Miktar",
  "autoRestock": "Satışta otomatik yeniden stokla",
  "autoRestockDescription": "Ürünler satıldığında otomatik olarak yeniden stokla",
  
  "fees": "Ücretler",
  "ebayFee": "eBay Ücreti",
  "ebayFeePercent": "eBay Ücreti (%)",
  "fixedFee": "Sabit Ücret",
  "fixedFeeAmount": "Sabit Ücret ($)",
  "tax": "Vergi",
  "taxPercent": "Vergi (%)",
  
  "templates": "Şablon",
  "customTemplate": "Özel",
  "predefinedTemplate": "Öntanımlı",
  "selectTemplate": "Şablon Seç",
  "selectTemplatePlaceholder": "Öntanımlı bir şablon seçin...",
  "htmlEditor": "HTML Editörü",
  "templatePlaceholder": "Özel HTML şablonunuzu girin...",
  "templateVariablesHelp": "{{product_title}}, {{product_price}}, {{product_image}}, {{product_description}} gibi değişkenler kullanın",
  
  "preview": "Önizleme",
  "livePreview": "Canlı Önizleme",
  "darkModePreview": "Karanlık Mod Önizlemesi",
  "desktopView": "Masaüstü Görünümü",
  "mobileView": "Mobil Görünüm",
  "renderingPreview": "Önizleme oluşturuluyor...",
  
  "saveChanges": "Değişiklikleri Kaydet",
  "saving": "Kaydediliyor...",
  "cancel": "İptal",
  "delete": "Sil",
  "deleteGroup": "Grubu Sil",
  "confirmDelete": "Bu grubu silmek istediğinizden emin misiniz?",
  "confirmDeleteMessage": "Bu işlem geri alınamaz. Bu grubu kullanan ürünlerin yeniden atanması gerekecek.",
  "deleteSuccess": "Grup başarıyla silindi",
  "deleteFailed": "Grup silinemedi",
  
  "productsCount_one": "{{count}} ürün",
  "productsCount_other": "{{count}} ürün",
  "noProducts": "Ürün yok",
  
  "statusActive": "Aktif",
  "statusDraft": "Taslak",
  "statusInactive": "Pasif",
  
  "emptyState": {
    "title": "Henüz Listeleme Grubu Yok",
    "description": "Listelerinizi organize etmeye başlamak için ilk grubunuzu oluşturun",
    "action": "Yeni Grup Oluştur"
  },
  
  "predefinedTemplates": {
    "modernMinimalist": "Modern Minimalist",
    "modernMinimalistDesc": "Ürün detaylarına odaklanan temiz ve profesyonel tasarım",
    "premiumElectronics": "Premium Elektronik",
    "premiumElectronicsDesc": "Teknik özelliklerle elektronik için üst düzey tasarım",
    "ecommerceClassic": "E-ticaret Klasik",
    "ecommerceClassicDesc": "Net bölümler ve harekete geçirici mesajlarla geleneksel düzen"
  },
  
  "validation": {
    "nameRequired": "Grup adı gereklidir",
    "nameMinLength": "Grup adı en az 3 karakter olmalıdır",
    "nameMaxLength": "Grup adı 100 karakteri geçmemelidir",
    "minPrice": "Minimum fiyat 0'dan büyük olmalıdır",
    "maxPrice": "Maksimum fiyat 0'dan büyük olmalıdır",
    "maxPriceGreaterThanMin": "Maksimum fiyat minimum fiyattan büyük olmalıdır",
    "profitRequired": "Kâr marjı veya sabit kâr gereklidir",
    "profitMarginRange": "Kâr marjı 0 ile 100 arasında olmalıdır",
    "fixedProfitMin": "Sabit kâr 0 veya daha büyük olmalıdır",
    "minQuantity": "Miktar en az 1 olmalıdır",
    "maxQuantity": "Miktar 9999'u geçmemelidir",
    "maxFeePercent": "Ücret yüzdesi %100'ü geçemez",
    "minFeePercent": "Ücret yüzdesi 0 veya daha büyük olmalıdır",
    "minFixedFee": "Sabit ücret 0 veya daha büyük olmalıdır",
    "maxTaxPercent": "Vergi yüzdesi %100'ü geçemez",
    "minTaxPercent": "Vergi yüzdesi 0 veya daha büyük olmalıdır",
    "templateRequired": "Şablon içeriği gereklidir",
    "templateMinLength": "Şablon en az 10 karakter olmalıdır",
    "predefinedTemplateRequired": "Lütfen öntanımlı bir şablon seçin",
    "minOnePriceRange": "En az bir fiyat aralığı gereklidir",
    "maxPriceRanges": "Maksimum 10 fiyat aralığına izin verilir",
    "overlappingPriceRanges": "Fiyat aralıkları örtüşemez"
  },
  
  "errors": {
    "loadFailed": "Listeleme grupları yüklenemedi",
    "saveFailed": "Değişiklikler kaydedilemedi",
    "createFailed": "Grup oluşturulamadı",
    "updateFailed": "Grup güncellenemedi",
    "deleteFailed": "Grup silinemedi",
    "templateLoadFailed": "Öntanımlı şablonlar yüklenemedi",
    "unauthorized": "Bu işlemi gerçekleştirme yetkiniz yok",
    "notFound": "Listeleme grubu bulunamadı",
    "networkError": "Ağ hatası. Lütfen bağlantınızı kontrol edin.",
    "unknownError": "Beklenmeyen bir hata oluştu"
  },
  
  "success": {
    "created": "Listeleme grubu başarıyla oluşturuldu",
    "updated": "Listeleme grubu başarıyla güncellendi",
    "deleted": "Listeleme grubu başarıyla silindi",
    "saved": "Değişiklikler başarıyla kaydedildi"
  },
  
  "tooltips": {
    "editGroup": "Grubu düzenle",
    "deleteGroup": "Grubu sil",
    "addPriceRange": "Başka bir fiyat aralığı ekle",
    "removePriceRange": "Bu fiyat aralığını kaldır",
    "toggleDarkMode": "Karanlık mod önizlemesini aç/kapat",
    "switchToDesktop": "Masaüstü görünümüne geç",
    "switchToMobile": "Mobil görünüme geç",
    "copyTemplate": "Şablon HTML'ini kopyala",
    "resetTemplate": "Varsayılan şablona sıfırla"
  },
  
  "help": {
    "repricingStrategy": "Farklı kâr marjlarıyla birden fazla fiyat aralığı tanımlayın. Ürünler maliyet aralıklarına göre fiyatlandırılacaktır.",
    "profitMargin": "Ürün maliyetinden hesaplanan yüzde bazlı kâr.",
    "fixedProfit": "Ürün maliyetine eklenen sabit dolar tutarı.",
    "ebayFee": "eBay'in nihai değer ücreti yüzdesi (genellikle %10-15).",
    "fixedFee": "eBay'in sabit listeleme ücreti (genellikle $0.30).",
    "tax": "Konumunuz için satış vergisi yüzdesi.",
    "customTemplate": "Özel stil ile kendi HTML şablonunuzu yazın.",
    "predefinedTemplate": "Profesyonel olarak tasarlanmış şablonlardan seçim yapın.",
    "templateVariables": "Şablonunuzda {{product_title}}, {{product_price}}, {{product_image}}, {{product_description}}, {{product_specs}} kullanın."
  }
}
```

---

## Usage in Components

### Example: Container Component

```typescript
import { useTranslation } from 'react-i18next';

export const ListingSettingsPageContainer = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('listingSettings.title')}</h1>
      <p>{t('listingSettings.subtitle')}</p>
      <Button>{t('listingSettings.createNewGroup')}</Button>
    </div>
  );
};
```

### Example: Validation Schema

```typescript
import { z } from 'zod';
import { TFunction } from 'i18next';

export const listingSettingsGroupSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(1, t('listingSettings.validation.nameRequired'))
      .min(3, t('listingSettings.validation.nameMinLength'))
      .max(100, t('listingSettings.validation.nameMaxLength')),
    // ... other fields
  });
```

### Example: Pluralization

```typescript
// English: "1 product" or "5 products"
// Turkish: "1 ürün" or "5 ürün"
<Text>{t('listingSettings.productsCount', { count: productCount })}</Text>
```

---

## File Locations

```
packages/shared/src/i18n/resources/
├── en/
│   └── listing-settings.json
└── tr/
    └── listing-settings.json
```

---

## Notes

1. **Namespace**: Use `listingSettings` namespace for all keys
2. **Nested Keys**: Use dot notation for organization (e.g., `validation.nameRequired`)
3. **Pluralization**: Use `_one` and `_other` suffixes for countable items
4. **Variables**: Use `{{variable}}` syntax for dynamic content
5. **Consistency**: Match key names with StoreSettings pattern
6. **Tooltips**: Provide helpful tooltips for all icon buttons
7. **Help Text**: Include contextual help for complex fields
8. **Error Messages**: Specific, actionable error messages
9. **Success Messages**: Confirm successful actions
10. **Empty States**: Friendly, actionable empty state messages
