# Telefon ve tablet düzeltmeleri — 15 Ekim 2026

Başlangıç: `5fb847f` (main). Bu değişiklikler kaynak kodu içindir; üretim yayını yapılmadı.

## Tamamlananlar

- **WV-01:** Evren ilerlemesi, kalan süre ve sıradaki ana hikâye havuzu seçili rotanın ana yapımlarından hesaplanır. Sıralama havuzu değiştirmez.
- **WV-02:** Keşfet'in yerel sonuçları Film/Dizi seçimine uyar. Ana sayfanın öne çıkanları yanıt beklerken de seçili türe uyar.
- **WV-03:** Tamamlanan dizi ve ana hikâyede tamamlanma metni gösterilir; sıfır dakika bilinmeyen süre sayılmaz.
- **WV-05:** Yerel arama kartıyla aynı TMDB medya türü ve kimliğine sahip uzak sonuç tekrar gösterilmez. Film ve dizilerde eşit sayısal kimlikler farklı yapım olarak korunur.
- **Tablet:** Izgara gerçek içerik genişliğine göre sütun azaltır. Hesaplanan örnekler: 320 px telefon 2 × 133 px; 390 px telefon 2 × 168 px; 768 px tablet/208 px menü 3 × 156 px; 1024 px tablet 4 × 177 px. Bunlar yerleşim hesabıdır, fiziksel cihaz ölçümü değildir.
- **WV-04:** Web için açık ARIA durumları eklenir; bölüm checkbox'ları, sekmeler, seçenekler, yıldızlar seçili/işaretli durumu iletir. Eksik slider rolü kaldırılır; yıldızlar basılabilir puan düğmeleridir.
- **WV-07:** İzlemeye devam et, başlangıç kartı/platformlar/vitrinden önce gelir. Film veya sıradaki bölüm doğrudan işaretlenebilir, geri alınabilir.
- **WV-08:** Koleksiyonlarda Sadece izlemediklerim ve liste sırası/yıl/puan/ad sıralaması bulunur. İzlemediklerim mevcut koleksiyon mantığıyla hiç başlanmamış yapımlardır.
- Sezon toplu işlemlerinde 6 saniyelik Geri al yalnızca işlemde değişen bölümleri geri çevirir; önceki izleme kayıtlarını korur.
- Bugün ne izlesem ekranında kendi kütüphanesi/özel listelerinden öneri seçilir. Bu modda tür filtresi vardır; platform/süre/ruh hali keşif filtreleri gizlenir. TMDB kimliği bulunan, henüz başlanmamış kayıtlar önerilir. Kaynaklar arasında tekrarlar kaldırılır.
- Bir hafta sonunda biter yazımı hem veri üretiminde hem mevcut önbellek/sunucu verisi okunurken düzeltilir. Tam sayı ifadelerinde İngilizce tekil/çoğul ayrımı eklenir.

## Doğrulama

- `npm run typecheck`: geçti.
- `npm run test:audit`: geçti. Gerçek katalogdaki 25 evren × 4 görünüm, tamamlanan Hawkeye, 8 ekran genişliği, medya+kimlik tekilleştirmesi, kısmi sezon geri alma, tekil/çoğul ve kendi listem öneri havuzu kontrol edildi.
- `npm run build:web`: geçti. Üretim API ortam değişkenleri olmadan derleme kontrolüdür; canlı servis entegrasyon testi değildir.
- Gerçek React Native Web bileşenini sunucu tarafında HTML'ye çizerek `aria-checked`, `aria-selected`, `aria-pressed` çıktıları doğrulandı.
- Lint çalıştırıldı. Depoda lint yapılandırması yoktu; geçici Expo 57 lint yapılandırmasıyla başlangıç ve değişiklik sürümü karşılaştırıldı. Her ikisi de aynı dosya/kural bazında 103 hata bildiriyor; yeni hata eklenmedi. Bu yüzden lint temiz olarak raporlanmaz. Kontrol araçları ürün bağımlılıklarına eklenmedi.
- `git diff --check`: geçti.

## Yayın öncesi cihaz kontrolü

Bu ortamda yerel önizleme tarayıcı tarafından `ERR_BLOCKED_BY_CLIENT` ile engellendi. Bu değişiklikler için görsel tarayıcı testi, fiziksel iPhone/iPad/Android, VoiceOver/TalkBack ve canlı API uçtan uca testi yapılmadı.

Cihazda kontrol: Marvel sıralamasını değiştir ve ilerlemeyi karşılaştır; Hawkeye tamamla; bir bölümü izleyip sezonu tamamla ve Geri al; Iron Man aramasını Film/Dizi arasında değiştir; tablette dikey/yatay ızgaraya bak; kendi listenden öneri al; koleksiyon filtrelerini değiştir; ana sayfadan sıradaki bölümü işaretle; ekran okuyucuda bölüm ve yıldız durumlarını dinle.

Kapsam dışında: GitHub Pages doğrudan bağlantı HTTP durumu, spoiler özeti politikasını değiştirme, iki panelli tablet tasarımı ve platform erişim güvencesi.
