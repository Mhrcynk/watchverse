# WatchVerse

Sevdiğin film ve dizi evrenlerinde nerede kaldığını hatırlatan, sıradaki hikâyeni doğru sırayla öneren kişisel uygulama. Telefonda ve tablette, ana ekrana eklenen bir web uygulaması olarak çalışır.

- **25 evren, 726 yapım:** Marvel, DC, Star Wars, Wizarding World, Orta Dünya, Game of Thrones, The Boys, Invincible, Stranger Things, Alien, Predator, MonsterVerse, Planet of the Apes, Jurassic Park, The Matrix, Avatar, Terminator, Transformers, Star Trek, The Walking Dead, Mission: Impossible, James Bond, John Wick, Rocky & Creed, Pirates of the Caribbean
- **Rotalar ve modlar:** her evrende ayrı süreklilikler (ör. MCU, X-Men, Sony); "Ana hikâye / Önerilen / Tümü" modları; "Önerilen / Yayın sırası / Kronolojik" sıralama
- **Bölüm takibi:** sezon sezon, tek tek bölüm işaretleme; "sezonu tamamladım"
- **Ön koşullar:** "Bundan önce" listesi ve hazırlık yüzdesi; "Büyük hikâyeye hazırlan"
- **Spoiler koruması**, izleme listesi, izleme geçmişi, rozetler, yedek kodu
- **Kendi kendine güncellenir:** haftada bir yeni bölüm, sezon ve yapımlar eklenir; uygulamada "Yeni eklenenler" bölümünde görünür.
- Hesap yok, reklam yok. İlerleme yalnızca telefonda saklanır.

## Nasıl çalışıyor

- Kod ve katalog GitHub'da durur. Uygulama GitHub Pages üzerinden ücretsiz yayınlanır: `https://<kullanıcı-adın>.github.io/watchverse/`
- Her pazartesi sabahı GitHub'da kendiliğinden bir görev çalışır (`.github/workflows/update.yml`):
  1. Katalogdaki her dizi için yayınlanmış yeni bölüm ve sezonlara bakar.
  2. `scripts/sources.json` içindeki seriler, anahtar kelimeler ve yapım şirketlerinden son 6 ayda yayınlanmış, katalogda olmayan film ve dizileri bulur.
  3. Afiş, Türkçe özet, Türkiye'deki platform, fragman ve yakında çıkacakları ekler; kataloğu kaydeder, siteyi yeniden yayınlar ve istersen bildirim gönderir.
- Uygulama açıldığında güncel kataloğu çeker; değişiklik varsa "Katalog güncellendi" der.
- İzleme ilerlemen telefonunda kalır; GitHub'a hiçbir kişisel bilgi gitmez. Telefon değiştirirken Profil → Yedek kodu'nu kullan.

## İlk kurulum (bir kez)

1. GitHub'da `watchverse` adında **herkese açık** bir depo aç ve kodu yükle.
2. Depoda **Settings → Secrets and variables → Actions → New repository secret**: adı `TMDB_TOKEN`, değeri TMDB'deki "API Read Access Token".
3. **Settings → Pages → Source: GitHub Actions**.
4. **Actions → Katalogu güncelle → Run workflow** ile ilk yayını başlat. Birkaç dakika sonra site açılır.
5. iPhone'da Safari ile siteyi aç → Paylaş → **Ana Ekrana Ekle**. Android'de Chrome → menü → **Ana ekrana ekle**.

## Tüm film ve diziler (ara sunucu, bir kez)

Uygulama her film ve diziyi TMDB'den arar. TMDB anahtarı uygulamaya girmez; ücretsiz bir Cloudflare Worker anahtarı saklar ve istekleri iletir (`worker/index.js`). Kurulumu GitHub görevi kendisi yapar:

1. https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap aç.
2. Sağ üst profil → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** şablonu → Continue → Create. Çıkan anahtarı kopyala.
3. Cloudflare ana sayfasında sağdaki **Account ID** değerini kopyala.
4. GitHub'da iki secret ekle: `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID`.
5. **Actions → Katalogu güncelle → Run workflow.** Görev sunucuyu kurar ve uygulamayı ona bağlar.

Bundan sonra bildirimler için kod kopyalamaya gerek kalmaz: Profil → Bildirimler → Bildirimleri aç yeterli. Her sabah takip ettiğin dizilerde yeni bölüm çıktıysa bildirim gelir (`.github/workflows/daily.yml`).

## Bildirimler (isteğe bağlı, bir kez)

1. GitHub'da **Settings → Secrets and variables → Actions → New repository secret**: adı `VAPID_PRIVATE_KEY`, değeri sana ayrıca verilen gizli anahtar.
2. iPhone'da uygulamayı **ana ekrandaki simgeden** aç → Profil → Bildirimler → **Bildirimleri aç** → izin ver.
3. Çıkan kodu kopyala; yeni secret: adı `PUSH_SUBSCRIPTION`, değeri bu kod. (Takip ettiğin evrenleri değiştirirsen kodu yeniden alıp güncelle.)

Haftalık güncellemede takip ettiğin evrenlere yeni bölüm, sezon ya da yapım eklenirse bildirim gelir.

## Uygulamada neler var

- Evren listeleri: Ana hikâye · Çıkış sırası · Kronolojik · Tümü; etiket, platform ve "Neden?" açıklaması
- Bir yapıma uzun basınca oraya kadar olanların hepsini izlendi işaretleme
- Yakında: takip ettiğin evrenlerde çıkış tarihi belli yeni bölüm, sezon ve filmler
- Keşfet: tüm film ve dizilerde arama, popüler, Türk dizileri ve filmleri, platformlara göre listeler
- Kütüphanem: izliyorum / izleyeceğim / bitirdim; dizilerde bölüm bölüm takip, yeni bölüm uyarısı
- Fragman, 5 yıldızlı puan ve kısa not; Profil'de "En sevdiklerin"
- Dosyaya yedek (iCloud Drive) ve haftalık yedek hatırlatması

## Yanlış eklenen yapım olursa

- Bir daha eklenmesin: `scripts/update-ignore.json` içine `"movie:123"` ya da `"tv:456"` yaz (numara yapımın TMDB adresindedir) ve kaydı `src/data/catalog.json`'dan sil.
- Afiş yanlışsa: `scripts/tmdb-overrides.json` içine `"yapim-id": "movie:12345"` ya da `"none"`.

## Bilgisayarda denemek

Gerekenler: Node.js 20 veya üstü.

```bash
npm install
npx expo start --web        # tarayıcıda
npx expo start --tunnel     # telefonda Expo Go ile
```

Güncelleyiciyi elle denemek (PowerShell):

```powershell
$env:TMDB_TOKEN="<token>"; npm run update -- --dry
```

`--dry` hiçbir şeyi kaydetmeden ne ekleneceğini gösterir.

## Klasör yapısı

```
src/app/            ekranlar (her dosya bir sayfa)
src/components/     ortak arayüz parçaları
src/lib/            katalog, kayıt, hesaplamalar, tema, katalog güncelleme
src/data/           catalog.json
scripts/            update-catalog (haftalık güncelleme), resolve-tmdb (afiş), pwa (ana ekrana eklenebilir site)
.github/workflows/  haftalık görev
```
