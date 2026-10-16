# Mobil yayın kanıtları — 16 Ekim 2026

Bu belge tamamlanma iddiası değildir. Yedi koşulun hiçbiri henüz uçtan uca kabul edilmiş değildir. Kod ve testler geliştirme dalındadır; canlı veritabanına uygulandıkları varsayılmamalıdır.

| Sıra | Koşul | Yapılan / mevcut kanıt | Kalan iş |
|---|---|---|---|
| 1 | İki cihaz çevrimdışı eşitleme | Son onaylı snapshot ile üçlü birleştirme; silme/ekleme, tekrar gönderim, özel liste ve 4.096 bölüm kombinasyonu test edildi. | Yerel veri ve eşitleme referansı tek sürümlü checkpoint içinde, sıralı yazılıyor. Yazma hatası/yeniden deneme, yeniden açılış ve gönderim sırasındaki değişiklikler dahil 14 test geçti. Kalıcı işlem günlüğü, gerçek uygulama sonlandırma, üç cihaz ve gerçek ağ testleri hâlâ gerekli. |
| 2 | Katalogda bölüm kimliği | Bölüm sırasını değiştiren katalog veya sezon güncellemesi reddediliyor; ekleme/silme/sıra değişimi test edildi. | Geçici koruma yerine sağlayıcının kalıcı bölüm kimlikleri; mevcut kayıtları doğrulanmış eski katalogla taşıma; numarası değişen/birleşen bölümler. |
| 3 | Eski istemci / yeni sunucu | v4 yazım sonrası eski v2/v3 RPC yazamıyor; CAS ve boş sürüm reddi PostgreSQL tabanlı yerel testten geçti. | İmzalı eski sürümle staging testi, anlaşılır zorunlu güncelleme ekranı, sürümlü migration ve rollback protokolü. Eski istemci güvenli biçimde reddedilir; tüm işlevleri çalışır denmiyor. |
| 4 | Hesap ve cihaz yetkisi | Native cihazın sahibi auth.uid() ile belirleniyor. Başka hesabın okuma/silme/kayıt değiştirmesi, anonim RPC, hesap silmede cihaz temizliği test edildi. Eski anonim Worker /sync ve /devices yolları 410 dönüyor. | Gerçek Supabase JWT ile entegrasyon, oturum değişiminde cihaz devri/iptali, paylaşım RPC yarışları ve bütün API yüzeyinin denetimi. |
| 5 | Yük ve maliyet | Henüz ölçülmedi. | Beklenen kullanıcı/istek yükü, güvenlik payı, gecikme/hata sınırı ve harcama tavanı belirlenmeli; staging'de ölçülmeli. Ücretsiz kota garantisi verilmez. |
| 6 | Yedek/başarısız yayın | PGlite snapshot'ı yeni veritabanına geri yüklendi; kayıt ve cihaz tokenı karşılaştırıldı. | Gerçek Supabase yedeği/PITR, kurtarma süresi/veri kaybı sınırı; staging'de başarısız migration ve Worker rollback tatbikatı. Yerel test bunların yerine geçmez. |
| 7 | Gerçek iOS/Android | Her iki platform için Metro/Hermes paketleri üretildi, TypeScript geçti. Yeni saf modüller lint'ten geçti. | Genel lint artık başarılı: 0 hata/0 uyarı. Expo proje bağlantısı, Apple/Google imzalama, mağaza derlemeleri, telefon/tablet akışları, push teslimatı ve Apple ile giriş değerlendirmesi. |

## Eşitlemenin bilinen sınırları

- Aynı alan aynı anda değiştirilirse deterministik tek değer seçilir; eşzamanlı silme/düzenleme durumunda silme kazanır. Metin düzenlemelerinin ikisi birden korunmaz.
- Eski aylık istatistikler olay kimliği taşımadığından maksimum değer kullanılır: tekrar gönderim toplamı şişirmez, ancak bağımsız eşzamanlı izlemelerin tam toplamı garanti edilmez.
- Eski cihazın referans snapshot'ı yoksa farklı yerel/bulut verisi otomatik birleştirilmez. Her iki yedek korunarak kullanıcı kontrollü taşıma ekranı yapılmalıdır.
- Kalıcı episode ID geçişi bitene kadar katalog koruması bazı geçerli katalog güncellemelerini de durdurabilir. Bu bir geçiş önlemidir.

## Web kaldırma durumu

Bu dalda web export / Pages deployment adımları, PWA üreticisi ve ikonları, browser push göndericisi, DOM tabanlı çeviri ve tarayıcı kodları kaldırıldı. İçe aktarma, yedek, paylaşım, geri hareketi, uygulamanın öne gelmesi ve OAuth dönüşleri native karşılıklarına taşındı. Doğrudan web bağımlılıkları kaldırıldı; Expo bağımlılık ağında bulunan üçüncü taraf web kodu uygulamanın web ürünü olduğu anlamına gelmez.

Kullanıcının son kararı: canlı web yayınının kaldırılması en son yapılacak; şimdilik Pages ve main görevlerine dokunulmayacak. Canlı GitHub Pages yayını **henüz silinmedi**. Eski yayını kapatmak yönetim erişimi gerektirir. İlk ara workflow yazımı otomatik güvenlik incelemesince eski web/test referansları gerekçesiyle reddedildi; bu ara yazım uygulanmadı. Taslak dal main'e alınmadıkça mevcut main görevleri değişmez.

Eski push_subscriptions tablosu, KV dev:* kayıtları, eski deployment/artifact'lar ve VAPID secret'ları henüz canlıda temizlenmedi. Native geçiş ve geri dönüş planı doğrulandıktan sonra yalnızca bu web kaynakları kaldırılmalı; kullanıcı izleme verileri silinmemelidir.

## Devam sırası

1. Snapshot yaklaşımını kalıcı/atomik işlem günlüğü ile tamamla; çökme ve iki gerçek cihaz testlerini geçir.
2. Bölümleri kalıcı kimliklere taşı; eski katalog haritasını yedekle ve doğrula.
3. Sürümlü migration, eski istemci ve bütün hesap/cihaz yetki testlerini staging'de çalıştır.
4. Native push gönderim kuyruğu, teslim makbuzları, geçersiz token temizliği; auth/hesap değişimi ve Apple girişi.
5. Kararlaştırılan yükte maliyet ve gecikme ölçümü; geri yükleme ve başarısız yayın tatbikatı.
6. Gerçek imzalı cihaz akışları; tüm kapılar geçtiğinde mağazaya gönder.

Gereken dış bilgiler: Expo proje kimliği/erişimi; Apple Developer ve Google Play proje bağlantıları; ayrı staging Supabase/Worker erişimi; hedef kullanıcı hacmi ve harcama sınırı. Şifreler veya gizli anahtarlar sohbet metnine yazılmamalıdır.

## Tutarlı yerel checkpoint

`watchverse:checkpoint:1` hem yerel durumu hem bulut birleştirme referansını içerir. Yazımlar sıraya alınır ve anında kopyalanır; 250 ms gecikmeli bağımsız yazımlar kaldırıldı. Buluta gönderimden önce bekleyen kayıt tamamlanır. Sunucu yanıtı beklenirken yapılan yeni değişiklikler referans kaydedildiğinde korunur. Eski iki anahtar kurtarma kopyası olarak tutulur; yeni biçim okunamıyorsa eskiye sessiz dönüş veya boş kayıtla üzerine yazma yapılmaz. Okuma hatasında başlangıç engellenir; yazma hatası kullanıcıya gösterilir ve tekrar denenebilir.

Bu, iki ayrı anahtarın farklı anlara ait kalmasını önler; işletim sistemi zorla kapatma, fiziksel disk arızası veya AsyncStorage'ın disk dayanıklılığı için kanıt değildir. Eski sürüme geri dönmek eski anahtarları okuyacağından son değişiklikleri göstermeyebilir; downgrade öncesinde yedek/taşıma gerekir. Checkpoint ve hesap eşitleme dosyalarının hedefli lint kontrolü geçti; sonraki mobil arayüz düzeltmeleriyle genel lint de 0 hataya indi (uyarılar da giderildi).

## Mobil arayüz ve React kontrolleri

92 lint hatası kurallar kapatılmadan giderildi. Animasyon değerleri bileşen ömrü boyunca sabit tutuluyor; render sırasında ref/global yazımları kaldırıldı. Liste seçim göstergesi her render'da yeniden oluşturulan bir bileşen olmaktan çıkarıldı. Arama, öneri satırları, takvim, sezonlar, logolar ve arkadaş önerileri sonuç kimliğiyle eşleştiriliyor. Yapım/kişi/kategori ekranları kimlik değişiminde kendi durumlarını sıfırlıyor; geç gelen yanıtlar kapanmış ekranı güncellemiyor. Paylaşılan listelerde eski bağlantının sonucu yeni bağlantıda gösterilmiyor.

TypeScript, lint, 14 eşitleme testi ve mevcut mantık denetimi geçti. Telefon/tablet gerçek dokunma, sürükleme, ekran okuyucu ve hızlı ağ geçişi testleri henüz yapılmadı. Lint'in geçmesi bu akışların cihazda doğrulandığı anlamına gelmez.

## Uyarı temizliği

Kullanılmayan bileşenler, yardımcılar ve importlar kaldırıldı; yinelenen importlar birleştirildi. Keşfet'te sonucu arayüzde kullanılmayan platform isteği kaldırıldı. İzleme işaretleme ve geçmiş gruplama işlemlerindeki yan etkili koşullu ifadeler açık if/else biçimine taşındı. Lint artık hem hata hem uyarı olmadan geçiyor. Önceki mobil düzeltme commit'i GitHub Actions üzerinde de başarılı: run 38874085118.

## Oturum ve hesap silme güvenliği

İstekler artık yalnızca kullanıcı kimliğiyle değil oturum nesliyle de doğrulanıyor. A → çıkış → A ve A → B → A geçişlerinde eski yanıtlar ve kuyruk işleri uygulanmıyor. Hesap silinirken eşitleme duraklatılıyor ve önceki işler tamamlanıyor. Cihazda tutulacak kayıtların sahip kimliği silinmiyor; sonraki hesapta misafir verisi olarak birleştirilmeleri önleniyor. Başarısız çıkış arayüzde başarı olarak gösterilmiyor.

Yeni sunucu fonksiyonları `save_state_v4(p_data,p_base,p_owner)` ve `delete_my_account_v2(p_owner)` talep edilen kullanıcıyı `auth.uid()` ile karşılaştırır; istemcinin gönderdiği kimliğe güvenerek yetki vermez. Yanlış/boş hesap kimliği ve anonim istekler, CAS ve v4 sonrası eski yazıcı reddi PGlite testinden geçti. Eşitleme/oturum test sayısı 20 oldu; lint 0 hata/0 uyarı, TypeScript başarılı.

**Yayın sırası:** Önce ayrı staging ortamında `supabase/schema.sql` ile yeni fonksiyonlar kurulup gerçek JWT testleri yapılmalı; ardından bu istemci sürümü denenmeli. Yeni istemci eksik RPC durumunda eski güvensiz çağrıya geri dönmez. Canlı şema değiştirilmedi. v4 kaydı yazıldıktan sonra v3'e istemci geri dönüşü yazmayı durdurur; sürüm geri alma planı bununla uyumlu hazırlanmalı. Bu değişiklik tüm API yüzeyindeki oturum yarışlarını çözdüğü iddiası değildir: native cihaz devri, paylaşım işlemleri, gerçek ağ/cihaz testleri hâlâ açık.
