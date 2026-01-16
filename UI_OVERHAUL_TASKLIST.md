# 🚀 TailAdmin UI Overhaul Task List

Bu dosya, projenin görünümünü TailAdmin standartlarına taşımak için yapılan geliştirmeleri takip eder.

## 🎨 1. Foundation (Tamamlandı)
- [x] Design Tokens: Renkler, Radius (16px cards), Shadowlar güncellendi.
- [x] Theme System: `designTokens.ts`, `themes.ts`, `tkn.ts` refaktör edildi.
- [x] Typography: `Outfit` fontu Google Fonts üzerinden eklendi ve varsayılan yapıldı.
- [x] Global CSS: Gereksiz Inter importları temizlendi.

## 🧪 2. Atoms (Temel Bileşenler)
- [x] **Button**: Hover states, micro-interactions ve loading animasyonları (TailAdmin stili).
- [x] **Badge**: Pill ve rectangular varyasyonları, semantic renkler.
- [x] **Input**: Border-radius, focus-ring ve placeholder iyileştirmesi.
- [x] **Checkbox & Radio**: Custom SVG tabanlı modern görünümler.
- [x] **Switch (Toggle)**: TailAdmin'in modern "Pill" tipi switch yapısı.
- [x] **Select**: Custom chevron ve modern dropdown görünümü.
- [x] **Textarea**: Yeni TailAdmin tarzı textarea bileşeni.
- [x] **Alert**: Success, Danger, Warning, Info varyasyonları ile modern uyarı kutuları.
- [x] **Breadcrumb**: Sayfa başlığı ve path gösterimi için TailAdmin breadcrumb yapısı.
- [x] **Modal**: Temiz ve modern modal yapısı.
- [x] **Dropdown**: Menü ve header aksiyonları için dropdown bileşeni.
- [x] **Tabs**: Underline ve Pill varyasyonları ile sekme yapısı.

## 🧩 3. Molecules & Layout
- [x] **Card (New)**: Mevcut Card'ın TailAdmin stiliyle yenilenmesi.
- [x] **FormGroup**: Label ve error mesajlarını içeren modern dikey layout.
- [x] **Table**: Seamless, borderless header ve hover satırları.
- [x] **Navigation items**: Sidebar'daki aktif/pasif/hover durumları.
- [x] **UI Cleanup**: Kullanılmayan `CollapsibleCard`, `SelectInput`, `TextareaInput`, `ToggleInput` vb. modüllerin silinmesi.

## 🖼️ 4. Pages & Features
- [x] **Dashboard Layout**: 290px Sidebar ve 80px Header grid yapısı.
- [x] **Store Settings**: Yeni bileşenlerin sayfaya entegrasyonu ve sayfa düzeninin TailAdmin ile uyumlu hale getirilmesi.

---
*Son Güncelleme: 16 Ocak 2026 19:15*
