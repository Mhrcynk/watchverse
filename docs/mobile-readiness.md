# Mobil yayın kanıtları — 16 Ekim 2026

Bu belge tamamlanma iddiası değildir. Yedi koşulun hiçbiri henüz uçtan uca kabul edilmiş değildir. Kod ve testler geliştirme dalındadır; canlı veritabanına uygulandıkları varsayılmamalıdır.

| Sıra | Koşul | Yapılan / mevcut kanıt | Kalan iş |
|---|---|---|---|
| 1 | İki cihaz çevrimdışı eşitleme | Son onaylı snapshot ile üçlü birleştirme; silme/ekleme, tekrar gönderim, özel liste ve 4.096 bölüm kombinasyonu test edildi. | Kalıcı atomik işlem günlüğü; uygulama kapanması/yazma hatası, üç cihaz ve gerçek ağ testleri. Snapshot ve yerel veri ayrı yazıldığı için çökme anında garanti yok. |
| 2 | Katalogda bölüm kimliği | Bölüm sırasını değiştiren katalog veya sezon güncellemesi reddediliyor; ekleme/silme/sıra değişimi test edildi. | Geçici koruma yerine sağlayıcının kalıcı bölüm kimlikleri; mevcut kayıtları doğrulanmış eski katalogla taşıma; numarası değişen/birleşen bölümler. |
| 3 | Eski istemci / yeni sunucu | v3 yazım sonrası eski RPC yazamıyor; CAS ve boş sürüm reddi PostgreSQL tabanlı yerel testten geçti. | İmzalı eski sürümle staging testi, anlaşılır zorunlu güncelleme ekranı, sürümlü migration ve rollback protokolü. Eski istemci güvenli biçimde reddedilir; tüm işlevleri çalışır denmiyor. |
| 4 | Hesap ve cihaz yetkisi | Native cihazın sahibi auth.uid() ile belirleniyor. Başka hesabın okuma/silme/kayıt değiştirmesi, anonim RPC, hesap silmede cihaz temizliği test edildi. Eski anonim Worker /sync ve /devices yolları 410 dönüyor. | Gerçek Supabase JWT ile entegrasyon, oturum değişiminde cihaz devri/iptali, paylaşım RPC yarışları ve bütün API yüzeyinin denetimi. |
| 5 | Yük ve maliyet | Henüz ölçülmedi. | Beklenen kullanıcı/istek yükü, güvenlik payı, gecikme/hata sınırı ve harcama tavanı belirlenmeli; staging'de ölçülmeli. Ücretsiz kota garantisi verilmez. |
| 6 | Yedek/başarısız yayın | PGlite snapshot'ı yeni veritabanına geri yüklendi; kayıt ve cihaz tokenı karşılaştırıldı. | Gerçek Supabase yedeği/PITR, kurtarma süresi/veri kaybı sınırı; staging'de başarısız migration ve Worker rollback tatbikatı. Yerel test bunların yerine geçmez. |
| 7 | Gerçek iOS/Android | Her iki platform için Metro/Hermes paketleri üretildi, TypeScript geçti. Yeni saf modüller lint'ten geçti. | Genel lint başarısız; son çalıştırmada 97 hata/50 uyarı. Expo proje bağlantısı, Apple/Google imzalama, mağaza derlemeleri, telefon/tablet akışları, push teslimatı ve Apple ile giriş değerlendirmesi. |

## Eşitlemenin bilinen sınırları

- Aynı alan aynı anda değiştirilirse deterministik tek değer seçilir; eşzamanlı silme/düzenleme durumunda silme kazanır. Metin düzenlemelerinin ikisi birden korunmaz.
- Eski aylık istatistikler olay kimliği taşımadığından maksimum değer kullanılır: tekrar gönderim toplamı şişirmez, ancak bağımsız eşzamanlı izlemelerin tam toplamı garanti edilmez.
- Eski cihazın referans snapshot'ı yoksa farklı yerel/bulut verisi otomatik birleştirilmez. Her iki yedek korunarak kullanıcı kontrollü taşıma ekranı yapılmalıdır.
- Kalıcı episode ID geçişi bitene kadar katalog koruması bazı geçerli katalog güncellemelerini de durdurabilir. Bu bir geçiş önlemidir.

## Web kaldırma durumu

Bu dalda web export / Pages deployment adımları, PWA üreticisi ve ikonları, browser push göndericisi, DOM tabanlı çeviri ve tarayıcı kodları kaldırıldı. İçe aktarma, yedek, paylaşım, geri hareketi, uygulamanın öne gelmesi ve OAuth dönüşleri native karşılıklarına taşındı. Doğrudan web bağımlılıkları kaldırıldı; Expo bağımlılık ağında bulunan üçüncü taraf web kodu uygulamanın web ürünü olduğu anlamına gelmez.

Canlı GitHub Pages yayını **henüz silinmedi**. Eski yayını kapatmak yönetim erişimi gerektirir. İlk ara workflow yazımı otomatik güvenlik incelemesince eski web/test referansları gerekçesiyle reddedildi; bu ara yazım uygulanmadı. Taslak dal main'e alınmadıkça mevcut main görevleri değişmez.

Eski push_subscriptions tablosu, KV dev:* kayıtları, eski deployment/artifact'lar ve VAPID secret'ları henüz canlıda temizlenmedi. Native geçiş ve geri dönüş planı doğrulandıktan sonra yalnızca bu web kaynakları kaldırılmalı; kullanıcı izleme verileri silinmemelidir.

## Devam sırası

1. Snapshot yaklaşımını kalıcı/atomik işlem günlüğü ile tamamla; çökme ve iki gerçek cihaz testlerini geçir.
2. Bölümleri kalıcı kimliklere taşı; eski katalog haritasını yedekle ve doğrula.
3. Sürümlü migration, eski istemci ve bütün hesap/cihaz yetki testlerini staging'de çalıştır.
4. Native push gönderim kuyruğu, teslim makbuzları, geçersiz token temizliği; auth/hesap değişimi ve Apple girişi.
5. Kararlaştırılan yükte maliyet ve gecikme ölçümü; geri yükleme ve başarısız yayın tatbikatı.
6. Gerçek imzalı cihaz akışları; tüm kapılar geçtiğinde mağazaya gönder.

Gereken dış bilgiler: Expo proje kimliği/erişimi; Apple Developer ve Google Play proje bağlantıları; ayrı staging Supabase/Worker erişimi; hedef kullanıcı hacmi ve harcama sınırı. Şifreler veya gizli anahtarlar sohbet metnine yazılmamalıdır.
