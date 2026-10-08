# Yayın rehberi — App Store ve Google Play

Bu proje Expo ile hazırlandı. iOS ve Android paketleri bulutta **EAS Build** ile üretilir; Mac ya da Xcode gerekmez.

## 0. Bir kez yapılacaklar

| Hesap | Ücret | Not |
|---|---|---|
| Apple Developer Program | yıllık 99 USD | developer.apple.com/programs — onay birkaç gün sürebilir |
| Google Play Console | tek sefer 25 USD | play.google.com/console — kimlik doğrulaması istenir |
| Expo hesabı | ücretsiz | expo.dev — ücretsiz planda aylık sınırlı bulut derlemesi var |
| TMDB hesabı | ücretsiz | afiş eşleştirmesi için (README) |

**Önemli — Google Play:** 13 Kasım 2023'ten sonra açılan kişisel geliştirici hesaplarında, uygulama herkese açılmadan önce **en az 12 test kullanıcısıyla 14 gün kesintisiz kapalı test** zorunlu. Takvimini buna göre planla. Şirket (kuruluş) hesabında bu şart yok.

## 1. Kimlikleri kontrol et — ilk yüklemeden sonra değiştirilemez

`app.json` içinde:
- `ios.bundleIdentifier` ve `android.package`: şu an `com.mihracyanik.watchverse`. Değiştireceksen **ilk derlemeden önce** değiştir.
- `version`: mağazada görünen sürüm (1.0.0). Derleme numaralarını EAS otomatik artırır.

`GIZLILIK-POLITIKASI.md` içindeki iletişim adresini doldur ve metni herkese açık bir adreste yayınla (GitHub Pages, Notion herkese açık sayfa ya da kendi siten). Her iki mağaza da bu adresi ister.

## 2. Afişleri eşleştir

README'deki adımlarla `npm run posters` çalıştır. Bunu yapmazsan uygulama evren renginde kapaklarla çalışır; mağaza için afişli hali çok daha iyi görünür.

## 3. Bilgisayarda deneme

```bash
npm install
npx expo start
```
Telefonundaki Expo Go ile QR kodu okut. iPad'de de aynı şekilde dene: kenar çubuğu, ızgaralar ve yatay kullanım.

## 4. EAS kurulumu

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # projeyi Expo hesabına bağlar, app.json'a projectId ekler
```

## 5. Test sürümü (isteğe bağlı ama önerilir)

```bash
npx eas-cli@latest build --profile preview --platform android
```
Çıkan APK bağlantısını Android telefonuna gönder, kur, dene.

iPhone'da gerçek cihaz testi için `--platform ios` ile **TestFlight** kullan (6. adım).

## 6. Mağaza derlemesi

```bash
npx eas-cli@latest build --profile production --platform all
```
- iOS ilk derlemede Apple hesabına giriş ister; sertifikaları EAS kendisi oluşturur.
- Android'de imzalama anahtarını EAS üretir ve saklar. **Bu anahtarı kaybetme**: `npx eas-cli@latest credentials` ile yedeğini indir.

## 7. App Store'a gönderim

1. App Store Connect → Uygulamalar → **+** → Yeni uygulama. Ad: `WatchVerse: İzleme Sırası`, birincil dil: Türkçe, paket kimliği: `com.mihracyanik.watchverse`.
2. Oluşan uygulamanın **Apple ID** numarasını `eas.json` → `submit.production.ios.ascAppId` alanına, Apple hesabının e-postasını `appleId` alanına yaz.
3. Gönder:
   ```bash
   npx eas-cli@latest submit --platform ios --latest
   ```
4. Derleme TestFlight'a düşer (10–30 dk). Kendi telefonunda TestFlight ile dene.
5. App Store Connect'te `MAGAZA-METINLERI.md` içindeki metinleri, `store/` klasöründeki ekran görüntülerini, gizlilik formunu ("Veri toplanmıyor") ve inceleme notunu gir.
6. **İncelemeye gönder.** İnceleme genelde 1–3 gün sürer.

## 8. Google Play'e gönderim

1. Play Console → Uygulama oluştur. Ad, varsayılan dil Türkçe, "Uygulama", "Ücretsiz".
2. İlk yüklemeyi elle yap: Play Console → Test → **Kapalı test** → yeni sürüm → EAS'in ürettiği `.aab` dosyasını yükle (EAS derleme sayfasından indirilir).
3. Otomatik gönderim için bir **Google servis hesabı anahtarı** oluştur (Play Console → Kurulum → API erişimi), JSON dosyasını `secrets/google-play-service-account.json` olarak kaydet. Sonraki sürümler:
   ```bash
   npx eas-cli@latest submit --platform android --latest
   ```
4. Mağaza girişi, veri güvenliği, içerik derecelendirmesi, hedef kitle formlarını `MAGAZA-METINLERI.md`'ye göre doldur.
5. Kişisel hesapsan: kapalı teste en az 12 kişiyi ekle, 14 gün bekle, sonra **Üretim erişimi için başvur**.

## 9. Sonraki güncellemeler

- Kod ya da katalog değişikliği → `build --profile production` → `submit`.
- Yalnızca JavaScript/veri değişikliklerini mağaza onayı beklemeden göndermek için ileride `expo-updates` (EAS Update) eklenebilir.

## Bilinen riskler

- **Görsel hakları:** Afişlerin hakları stüdyolara aittir. TMDB API'si bunların gösterilmesine izin veriyor; yine de Apple inceleme sırasında soru sorabilir. İnceleme notu bu durumu açıklıyor. Ret gelirse afişleri kapatıp evren renkli kapaklarla devam etmek mümkün (uygulama zaten bu şekilde çalışabiliyor).
- **Marka adları:** Marvel, Star Wars gibi adlar yalnızca yapımları tanımlamak için kullanılıyor; logo kullanılmıyor. Uygulama adı ve ikonu hiçbir markayı çağrıştırmıyor.
- **Katalog güncelliği:** 2026 yapımlarının bölüm sayıları ve tarihleri yayın sonrası değişebilir; her sürümde kontrol et.
