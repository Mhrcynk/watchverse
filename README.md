# WatchVerse

Film ve dizi takibi için Expo / React Native uygulaması. Hedef platformlar yalnızca **Android ve iOS**; telefon ve tablet desteklenir. Web/PWA yayını bu çalışma dalında kaldırılmıştır.

## Geliştirme

Node 22.13+ ve npm kullanılır.

```sh
npm ci
npm run typecheck
npm run test:sync
node scripts/test-database.mjs
node --test scripts/test-worker.mjs
npm run test:audit
npm run lint
npx expo start --dev-client
```

Native paketler nedeniyle Expo Go yerine geliştirme derlemesi gerekir. `eas.json` geliştirme, önizleme ve mağaza profillerini tanımlar. `EAS_PROJECT_ID` gerçek Expo projesinin kimliğidir; imzalama ve mağaza hesapları ayrıca bağlanır.

Uygulama yapılandırması: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`. Bunlar istemciye açık değerlerdir; TMDB ve Supabase service-role anahtarları uygulamaya konulmaz. Katalog `/catalog.json` yoluyla Worker'dan alınır. Auth dönüşü `watchverse://auth/callback` adresidir.

Native bildirim gönderimi, teslim makbuzları ve cihaz testi henüz tamamlanmadığından bildirim etkinleştirme varsayılan olarak kapalıdır. Test edilmeden `EXPO_PUBLIC_NATIVE_PUSH_ENABLED=true` kullanılmamalıdır.

## Yayın durumu

Bu dal **mağaza yayınına hazır değildir**. Kanıtlar, eksikler ve sıralı yayın koşulları [docs/mobile-readiness.md](docs/mobile-readiness.md) dosyasındadır. Kaynaktan web yayın adımlarının kaldırılması GitHub Pages'teki mevcut yayını kendiliğinden silmez.
