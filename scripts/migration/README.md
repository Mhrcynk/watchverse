# Katalog geçişi (tek seferlik kayıt)

`src/data/catalog.json` şu adımlarla üretildi. Bu klasör yalnızca kayıt amaçlıdır; tekrar çalıştırılması gerekmez.

1. ChatGPT/Codex prototipinin `dist/catalog.js` dosyasındaki 556 yapım (Marvel, DC, Star Wars, Wizarding World, Orta Dünya) aynen alındı. Gömülü afiş yolları çıkarıldı; görseller artık TMDB'den gelir.
2. `new-universes.mjs`: 20 yeni evren, 161 yapım, hepsi Türkçe özetli. Star Trek ve James Bond'daki gruplu kayıtlar tek tek filmlere açıldı. Apes devam filmleri, Sarah Connor Chronicles, The Continental, Lower Decks, Prodigy gibi eksikler eklendi.
3. Daha önceki UNIVERSE çalışmasından 175 yapıma Türkçe özet ve 98 ön koşul bağı aktarıldı.
4. Doğrulama: çift kimlik yok, kırık ön koşul yok, ön koşul döngüsü yok, bölüm sayıları sezon listesiyle uyumlu.
5. Düzeltme: "Teen Titans Go! See Space Jam" dizinin bölüm verisini taşıyordu; 2021 tarihli özel yapım olarak düzeltildi.

Bundan sonra kataloğu doğrudan `src/data/catalog.json` üzerinde güncelle.
