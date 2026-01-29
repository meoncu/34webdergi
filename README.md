# Panze Studio - Modern Dergi Arşiv Uygulaması

Bu proje, harici bir web sitesinden (örn: Altınoluk) makaleleri Playwright ile çekip Firebase Firestore'da arşivleyen ve kullanıcıların modern bir arayüzle okumasını sağlayan bir Next.js 15 uygulamasıdır.

## 🚀 Teknolojiler
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons.
- **Backend:** Next.js Server Actions & API Routes, Playwright (Scraping).
- **Veritabanı & Auth:** Firebase Firestore, Firebase Admin SDK, Firebase Auth (Google Login).
- **Güvenlik:** Crypto-JS (Hassas veri şifreleme).

## 🛠️ Kurulum

1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Firebase Kurulumu:**
   - [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun.
   - Firestore ve Authentication (Google Login) servislerini aktifleştirin.
   - Proje ayarlarından SDK bilgilerini alın.
   - Service Account anahtarını (JSON) indirin.

3. **Çevresel Değişkenler (.env.local):**
   ```env
   # Firebase Client
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...

   # Firebase Admin
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   # Encryption
   ENCRYPTION_KEY=sizin-ozel-anahtariniz
   ```

4. **Uygulamayı Başlatın:**
   ```bash
   npm run dev
   ```

## 📂 Klasör Yapısı
- `/app`: Sayfalar ve API rotaları.
- `/components`: UI bileşenleri (design tokens ve layout).
- `/lib`: Firebase, Scraping ve Şifreleme mantığı.
- `/types`: TypeScript arayüzleri.

## 🛡️ Güvenlik ve Performans
- Site şifreleri Firestore'da AES-256 ile şifreli tutulur.
- Scraping işlemleri sunucu tarafında Playwright ile izole bir şekilde çalışır.
- Okuma modunda XSS koruması için HTML temizleme uygulanabilir.
- Resimler ve içerikler için `next/image` ve lazy loading kullanılır.
