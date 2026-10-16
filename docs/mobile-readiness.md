# Mobil yayın kanıtları — 16 Ekim 2026

Bu belge tamamlanma iddiası değildir. Yedi koşulun hiçbiri henüz uçtan uca kabul edilmiş değildir. Kod ve testler geliştirme dalındadır; canlı veritabanına uygulandıkları varsayılmamalıdır.

| Sıra | Koşul | Yapılan / mevcut kanıt | Kalan iş |
|---|---|---|---|
| 1 | Çevrimdışı eşitleme | Cihaz başına kalıcı sayaç, nedensel işlem kayıtları, silme işaretleri ve tek checkpoint. Üç cihazın farklı teslim sıraları, yeniden gönderim ve yeniden açılış testleri mevcut. | Gerçek cihazda zorla kapatma, ağ kesintisi ve staging eşitleme testi. |
| 2 | Bölüm kimliği | İzleme kayıtları kalıcı kimlik setine taşındı; sıra numaraları yalnızca ekran izdüşümü. TMDB kimliği doldurma hattı ve eski kimlik eşlemeleri eklendi. | Gerçek katalogda sağlayıcı kimliklerini doldurma ve kapsam raporu. Kimliği eksik kayıtlarda ihtiyatlı uyumluluk kontrolü devam ediyor. |
| 3 | Eski istemci / yeni sunucu | v5 yazımından sonra eski v2/v3/v4 yazıcıları reddediliyor. CAS, beklenen hesap ve sürüm testleri mevcut. | İmzalı eski sürüm + yeni sunucu staging denemesi ve geri dönüş provası. Eski istemcinin yazması engellenir; tüm işlevleri çalışır denmiyor. |
| 4 | Hesap ve cihaz yetkisi | Paylaşım/arkadaşlık/cihaz çağrılarında beklenen hesap doğrulanıyor. Paylaşım sahibini değiştirme yarışı kilitle korunuyor; cihaz iptal kaydı gecikmiş kayıt isteğini reddediyor. | Gerçek Supabase JWT, eşzamanlı bağlantılar, oturum değişimi ve tüm API yüzeyinin staging denetimi. |
| 5 | Yük ve maliyet | Henüz ölçülmedi. | Hedef yük, güvenlik payı ve bütçe sınırıyla gecikme/hata/maliyet ölçümü. |
| 6 | Yedek/başarısız yayın | PGlite snapshot geri yükleme testi mevcut. | Gerçek Supabase yedek dönüşü ve başarısız yayın tatbikatı. |
| 7 | Gerçek iOS/Android | TypeScript/lint ve Metro/Hermes paketleme kontrolü uygulanıyor. | Expo/mağaza bağlantıları, imzalı derlemeler, gerçek telefon/tablet testleri ve push teslimatı. |

## Eşitlemenin tasarımı ve sınırları

- Her yerel işlem, checkpoint içinde saklanan cihaz kimliği ve artan sayaçla kaydedilir. Birleştirme duvar saatine dayanmaz; nedensel olarak eşzamanlı değerleri korur ve ekrana deterministik bir değer yansıtır. Eşzamanlı silme/düzenlemede silme kazanır; silmeyi gördükten sonra açıkça yeniden eklemek mümkündür.
- Metin alanının eşzamanlı iki düzenlemesi tek metin olarak birleştirilmez. İşlem sınırı, kullanıcının uygulamadaki eylemidir; iki cihazda aynı izlemeyi ayrı ayrı işaretlemek iki sayaç olayı olabilir.
- Yeni sayaç olayları kimlikleriyle bir kez toplanır. Eski kimliksiz istatistiklerin başlangıcı maksimum değerle uzlaştırılır; geçmişteki bağımsız eylemler yeniden oluşturulamaz.
- Silme kayıtları ve sayaç olayları henüz budanmıyor; eski çevrimdışı cihazların veri diriltmesini önlemek için güvenli sıkıştırma ayrıca tasarlanmalı. Sunucunun 2 MB sınırı aşılırsa eşitleme hata verir; kullanıcı hatayı görür, sessiz veri kaybı olmaz. Uzun kullanımda boyut/maliyet testi gerekli.
- Eski eşitleme referansı eksikse farklı yerel/bulut verisi tahminle birleştirilmez. Eski bölüm konumu çözülemiyorsa yedekte tutulur ve profilde uyarılır. Tarihsel katalog sürümü bilinmeyen her eski yedeğin doğru eşlendiği iddia edilmez.
- Sağlayıcı kimliği olan bölümün yeri/numarası değişebilir; izleme işareti kimlikle korunur. Sağlayıcının kaldırdığı kimlik gizli olarak korunur. Sağlayıcı bölüm birleştirmesi/bölmesi için otomatik tahmin yapılmaz.
- `scripts/update-catalog.mjs` TMDB bölüm kimliklerini eksik olan yerlere ekler, mevcut kimlikleri değiştirmez. Bu turda canlı TMDB zenginleştirmesi çalıştırılmadı. Geçici `legacy:` kimlikler ve güvenli katalog güncelleme kontrolü hâlâ gerekli.

## Web kaldırma durumu

Bu dalda web export / Pages deployment adımları, PWA üreticisi ve ikonları, browser push göndericisi, DOM tabanlı çeviri ve tarayıcı kodları kaldırıldı. İçe aktarma, yedek, paylaşım, geri hareketi, uygulamanın öne gelmesi ve OAuth dönüşleri native karşılıklarına taşındı. Doğrudan web bağımlılıkları kaldırıldı; Expo bağımlılık ağında bulunan üçüncü taraf web kodu uygulamanın web ürünü olduğu anlamına gelmez.

Kullanıcının son kararı: canlı web yayınının kaldırılması en son yapılacak; şimdilik Pages ve main görevlerine dokunulmayacak. Canlı GitHub Pages yayını **henüz silinmedi**. Eski yayını kapatmak yönetim erişimi gerektirir. İlk ara workflow yazımı otomatik güvenlik incelemesince eski web/test referansları gerekçesiyle reddedildi; bu ara yazım uygulanmadı. Taslak dal main'e alınmadıkça mevcut main görevleri değişmez.

Eski push_subscriptions tablosu, KV dev:* kayıtları, eski deployment/artifact'lar ve VAPID secret'ları henüz canlıda temizlenmedi. Native geçiş ve geri dönüş planı doğrulandıktan sonra yalnızca bu web kaynakları kaldırılmalı; kullanıcı izleme verileri silinmemelidir.

## Devam sırası

1. Ayrı staging Supabase ortamına yeni şemayı kur; gerçek JWT, eşzamanlı paylaşım ve cihaz iptali testlerini çalıştır.
2. TMDB katalog kimliklerini doldur; eski yedek örnekleriyle kimlik kapsamını ve geçişi doğrula.
3. İki/üç gerçek cihazda çevrimdışı düzenleme, süreç sonlandırma, hesap değişimi ve eski sürüm testlerini geçir.
4. Native push gönderim kuyruğu, teslim makbuzları, geçersiz token temizliği ve Apple girişini tamamla.
5. Yük/maliyet ölçümü, gerçek yedek dönüşü ve başarısız yayın tatbikatı.
6. İmzalı telefon/tablet akışlarını tamamla; tüm kapılar geçtiğinde mağazaya gönder.

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

Yeni istemci `save_state_v5(p_data,p_base,p_owner)` kullanır; sunucu `p_owner` değerini `auth.uid()` ile karşılaştırır. Paylaşım, profil, arkadaşlık ve cihaz kayıt işlemleri de beklenen hesap doğrulamasından geçer. İstemci yanıt sonrası oturumu yeniden kontrol eder. Çıkışta cihaz iptal kaydı, sonradan ulaşan eski kayıt isteğinin cihazı yeniden etkinleştirmesini engeller. Arkadaşlık kotası her iki hesap için uygulanır.

**Yayın sırası:** Önce ayrı staging ortamında `supabase/schema.sql` ile yeni fonksiyonlar kurulup gerçek JWT testleri yapılmalı; ardından istemci denenmeli. Yeni istemci eksik RPC durumunda eski çağrıya dönmez. Canlı şema değiştirilmedi. v5 kaydı yazıldıktan sonra v4 ve daha eski istemciler yazamaz; geri alma aynı protokolü destekleyen sürümle yapılmalı veya doğrulanmış veri dönüşümü planlanmalıdır.

Worker dağıtım betiği artık Supabase yönetici anahtarını istemiyor/dağıtmıyor. Canlıda daha önce tanımlanmış anahtar bu kod değişikliğiyle silinmiş sayılmaz; kullanılmadığı doğrulandıktan sonra ayrı olarak kaldırılmalıdır.

## Bu değişiklik paketinin doğrulanması

Başarılı kontroller: TypeScript, lint (0 hata/0 uyarı), 36 eşitleme/kimlik/oturum testi, PGlite veritabanı testleri, mevcut arayüz mantık denetimi ve 3 Worker testi. iOS ve Android için Metro/Hermes paketleri başarıyla üretildi (`expo export`); bunlar imzalı mağaza derlemeleri değildir. Testler PGlite, saf TypeScript ve paketleme düzeyindedir; gerçek Supabase erişimi, imzalı mağaza derlemesi veya fiziksel cihaz testi yerine geçmez.

## Ürün sadeleştirme paketi

Dört ana sekme, odaklı ana sayfa, Keşfet üzerinden koleksiyon/platform erişimi, geçmiş bölüm işaretleme, yedek önizlemesi ve kayıt durumları eklendi. Kütüphane sanallaştırıldı; TMDB istekleri birleştirilip sınırlandırıldı. Ayrıntılar ve henüz açık olan boyut/cihaz doğrulamaları `docs/product-improvements.md` içindedir.
