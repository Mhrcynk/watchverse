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
  3. Afiş ve Türkçe özetleri ekler, kataloğu kaydeder, siteyi yeniden yayınlar.
- Uygulama açıldığında güncel kataloğu çeker; değişiklik varsa "Katalog güncellendi" der.
- İzleme ilerlemen telefonunda kalır; GitHub'a hiçbir kişisel bilgi gitmez. Telefon değiştirirken Profil → Yedek kodu'nu kullan.

## İlk kurulum (bir kez)

1. GitHub'da `watchverse` adında **herkese açık** bir depo aç ve kodu yükle.
2. Depoda **Settings → Secrets and variables → Actions → New repository secret**: adı `TMDB_TOKEN`, değeri TMDB'deki "API Read Access Token".
3. **Settings → Pages → Source: GitHub Actions**.
4. **Actions → Katalogu güncelle → Run workflow** ile ilk yayını başlat. Birkaç dakika sonra site açılır.
5. iPhone'da Safari ile siteyi aç → Paylaş → **Ana Ekrana Ekle**. Android'de Chrome → menü → **Ana ekrana ekle**.

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
