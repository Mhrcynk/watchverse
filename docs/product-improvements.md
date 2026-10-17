# Mobil ürün iyileştirmeleri — 16 Ekim 2026

Bu paket ürün değerlendirmesindeki uygulanabilir arayüz ve kod önerilerini kapsar. Staging, imzalı derleme ve gerçek cihaz kabul testleri yerine geçmez. Canlı webi kapatma işi kullanıcının önceki kararı gereği sona bırakılmıştır.

## Uygulananlar

- Ana gezinme dört sekme: Ana Sayfa, Keşfet, Kütüphanem, Evrenler.
- Koleksiyonlar bağımsız ekrana taşındı; Keşfet'ten açılır. Platformlar ve uzun öneri satırları Keşfet'teki ayrı öneriler ekranından açılır.
- Ana sayfa devam kartları, kendi listesinden öneri akışı, evrenler ve takvim erişimine odaklanır. Ana sayfayı açmak platform/öneri listelerinin bütün isteklerini başlatmaz.
- Her iki yapım detayında “Buraya kadar izledim”: sezon ve bölüm seçimi, değişiklik sayısı önizlemesi, önceki işaretleri koruma ve geri alma. TMDB yolunda yalnızca yayın tarihi bilinen/yayınlanmış bölümler seçilir. Katalog yolunda katalogdaki mevcut yayınlanmış bölüm haritası kullanılır.
- Geçmiş toplu işaretleme ve onun geri alması tarih bazlı istatistikleri değiştirmez. Bu, eski bütün kayıtların tarihlerini yeniden oluşturduğu anlamına gelmez; mevcut istatistikler olay tabanlı ayrıntılı izleme günlüğü değildir.
- Dosyadan veya koddan yedek uygulamadan önce yapım/bölüm/liste sayıları, yeni yedeklerde oluşturma tarihi ve çözülemeyen eski kayıtlar gösterilir. Hesap ve diğer cihazlara yansıyacağı açıklanır. Geçerli olmayan JSON yedek olarak kabul edilmez. Cihaza ait bildirim kimliği başka yedekten alınmaz.
- Ana sayfa, kütüphane ve profilde yerel yazım/bulut eşitleme ayrımı görünür. “Kaydedildi”, bekleyen bütün checkpoint yazımları bittikten sonra gösterilir; başarısızlıkta tekrar deneme vardır.
- Özellik bayrağı kapalıyken bildirim açma adımları hem profilden hem başlangıç kartından gizlenir. Kullanıcıya dönük ara sunucu kurulum metinleri temizlendi.
- Kütüphane ve içindeki özel liste kartları tek dikey FlatList ile sanallaştırılır; dikey ScrollView içine gömülmez. Sütunlar ölçülen içerik genişliğine göre değişir.
- TMDB GET istekleri URL bazında devam eden isteği paylaşır. Her deneme için 12 saniyelik süre sınırı; ağ/429/5xx hatalarında en fazla bir tekrar vardır. Diğer 4xx cevapları tekrar edilmez. Mevcut çevrimdışı önbellek dönüşü korunur; bellek önbelleği 200 kayıtla sınırlandırılır.
- Puan/not paneli ve sezon işaretleme/geri alma davranışı iki detay ekranında ortak bileşenlere taşındı.
- İlk mobil sürüm Türkçe kalır. Kullanılmayan metinden İngilizceye çeviri motoru ve sözlüğü çıkarıldı. Önceden çalışan bir dil seçici kaldırılmadı; dil zaten Türkçeye sabitti.
- Sosyal akış, mesajlaşma, rozet veya ücretli yapay zekâ servisi eklenmedi. Mevcut arkadaşlık ve istatistikler korundu.

## Boyut ölçümü ve güvenli küçültme planı

`npm run measure:sync` ile saf UTF-8 JSON üzerinde yapay örnekler:

| Bölüm kimliği | Sayaç olayı | JSON baytı |
|---:|---:|---:|
| 1.000 | 1.000 | 208.714 |
| 5.000 | 5.000 | 1.062.154 |
| 10.000 | 10.000 | 2.128.954 |

Bunlar bellek, gecikme, maliyet veya PostgreSQL `jsonb` saklama boyutu ölçümü değildir. Notlar, yapım metadatası, farklı cihaz saatleri ve gerçek işlem geçmişi ek maliyet oluşturabilir. 2 MB sunucu sınırı nedeniyle uzun süreli yoğun kullanım yayın öncesi ayrı bir kabul kapısıdır.

Silme kayıtları gelişigüzel atılmadı. Güvenli küçültme için sonraki protokolde:

1. Sayaçlar cihaz/alan başına artış-azalış toplamlarıyla sınırlandırılmalı; tekrar gönderim tek işlem sayılmalı.
2. Sunucu onaylı yeni eşitleme dönemi tanımlanmalı. Eski dönemden gelen cihazın sessizce eski veriyi birleştirmesi yerine kontrollü yeniden temellendirme gerekir.
3. Silme kaydı ancak eski dönemin kabulü kapandıktan ve kurtarma yolu doğrulandıktan sonra budanmalı.
4. Uzun süre çevrimdışı kalan cihaz, eski yedek, eski uygulama ve yeni sunucu birlikte test edilmeli.
5. Yeni biçim eski istemcilerce yazılamamalı; sürümlü geçiş ve geri dönüş planı staging'de denenmeli.

Bu protokol geçişi bu arayüz paketiyle yapılmadı; yapılmış gibi kabul edilmemeli.

## Doğrulama

- `npm run test:sync`: mevcut 36 eşitleme testi ve yeni ürün testleri birlikte çalışır; mevcut CI girişine dahildir.
- `npm run test:product`: istek birleştirme, tekrar sınırı, zaman aşımı, geçmiş bölüm seçimi, yedek önizlemesi, checkpoint durumu ve tarihi bilinmeyen izlemelerin istatistikleri.
- `npm run typecheck`, `npm run lint`, `npm run test:audit`, `npm run test:database`, `npm run test:worker`.
- iOS/Android `expo export`: derlenebilirlik kontrolü; imzalı mağaza derlemesi değildir.

## Gerçek cihazda kabul listesi

- Telefon/tablette dört sekme, Koleksiyonlar'a giriş/geri dönüş ve ekran döndürme.
- Büyük kütüphanede arama yazarken klavyenin/fokusun korunması, son karta erişim, sıralama ve sekmeye yeniden dokunarak başa dönme.
- Çok sezonlu dizide geçmiş ilerleme, yayınlanmamış bölüm seçimi reddi, önizleme ve geri alma.
- İşlem sırasında hesap değişimi ve ekranı kapatma; geç gelen yanıtın işaretleme yapmaması.
- Dosya/kod yedeği, bozuk dosya, eski tarihsiz yedek ve kayıt hatasında görünür durum.
- Yavaş/açılıp kapanan ağ, aynı yapımın eşzamanlı istekleri, zaman aşımı ve çevrimdışı önbellek.
- Ekran okuyucu, büyük yazı, küçük telefon ve yatay tablet yerleşimi.

Son yerel kontrol sonucu: 43 eşitleme/ürün testi, 3 Worker testi, PGlite veritabanı denetimi ve arayüz mantık kontrolleri geçti. TypeScript ve lint 0 hata/0 uyarı ile tamamlandı. Son kaynak durumundan iOS ve Android Metro/Hermes paketleri üretildi. Fiziksel cihazda görsel/etkileşim doğrulaması yapılmadı.
