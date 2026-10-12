# WatchVerse

Sevdiğin film ve dizi evrenlerinde nerede kaldığını hatırlatan, sıradaki hikâyeni doğru sırayla öneren mobil uygulama. iPhone, iPad ve Android telefon/tablet için tek kod tabanı.

- **25 evren, 726 yapım:** Marvel, DC, Star Wars, Wizarding World, Orta Dünya, Game of Thrones, The Boys, Invincible, Stranger Things, Alien, Predator, MonsterVerse, Planet of the Apes, Jurassic Park, The Matrix, Avatar, Terminator, Transformers, Star Trek, The Walking Dead, Mission: Impossible, James Bond, John Wick, Rocky & Creed, Pirates of the Caribbean
- **Rotalar ve modlar:** her evrende ayrı süreklilikler (ör. MCU, X-Men, Sony); "Ana hikâye / Önerilen / Tümü" modları; "Önerilen / Yayın sırası / Kronolojik" sıralama
- **Bölüm takibi:** sezon sezon, tek tek bölüm işaretleme; "sezonu tamamladım"
- **Ön koşullar:** "Bundan önce" listesi ve hazırlık yüzdesi; "Büyük hikâyeye hazırlan"
- **Spoiler koruması**, izleme listesi, izleme geçmişi, rozetler, yedek kodu
- Hesap yok, sunucu yok, reklam yok. İlerleme cihazda saklanır.

## Çalıştırma

Gerekenler: Node.js 20 veya üstü.

```bash
npm install
npx expo start
```

Telefonuna **Expo Go** uygulamasını kur, terminaldeki QR kodu okut. Tarayıcıda görmek için `npx expo start --web`.

Tip kontrolü: `npm run typecheck`

## Afişler (TMDB)

Uygulama afişleri The Movie Database'den gösterir. Eşleştirmeyi bir kez yapman yeterli:

1. https://www.themoviedb.org adresinde ücretsiz hesap aç → Ayarlar → API → **API Read Access Token** değerini kopyala.
2. Proje klasöründe (PowerShell):
   ```powershell
   $env:TMDB_TOKEN="buraya_token"; npm run posters
   ```
3. Betik `src/data/catalog.json` dosyasına afiş yollarını ve eksik Türkçe özetleri yazar. `scripts/tmdb-report.json` içindeki zayıf eşleşmeleri kontrol et; yanlış olanı `scripts/tmdb-overrides.json` ile düzelt: `{ "yapim-id": "movie:12345" }`

Token uygulamanın içine girmez; görseller doğrudan `image.tmdb.org` adresinden yüklenir. Eşleşmesi olmayan yapımlar evren renginde kapakla görünür.

## Klasör yapısı

```
src/app/            ekranlar (Expo Router: her dosya bir sayfa)
  (tabs)/           Ana Sayfa, Evrenler, Keşfet, Profil
  universe/[id]     evren sayfası
  title/[id]        yapım sayfası, bölüm takibi
  onboarding        ilk kurulum
  credits           kaynaklar, haklar, gizlilik
src/components/     ortak arayüz parçaları
src/lib/            katalog, kayıt, hesaplamalar, tema
src/data/           catalog.json
scripts/            TMDB eşleştirme
```

## Kataloğu güncelleme

Katalog `src/data/catalog.json` dosyasıdır. Yeni bir yapım eklemek için aynı alanlarla bir kayıt ekle (`id`, `u`, `title`, `year`, `type`, `minutes`, `episodes`, `ep`, `branch`, `phase`, `release`, `tier`, `deps` …). Eklemeden sonra `npm run posters` ile görselini eşleştir.

## Yayın

Adım adım rehber: [YAYIN-REHBERI.md](YAYIN-REHBERI.md) · Mağaza metinleri: [MAGAZA-METINLERI.md](MAGAZA-METINLERI.md) · Gizlilik: [GIZLILIK-POLITIKASI.md](GIZLILIK-POLITIKASI.md)
