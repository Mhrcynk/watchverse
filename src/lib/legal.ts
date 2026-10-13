/**
 * Gizlilik / KVKK aydınlatma metni ve kullanım şartları.
 * Uygulama herkese açılacaksa metni bir hukukçuya gözden geçirt.
 */
export const OWNER = process.env.EXPO_PUBLIC_OWNER || 'Mihraç Yanık';
export const CONTACT = process.env.EXPO_PUBLIC_CONTACT || 'watchverse.destek@gmail.com';
export const LEGAL_UPDATED = '14 Ekim 2026';

export type LegalDoc = { id: 'gizlilik' | 'sartlar'; title: string; intro: string; sections: { h: string; p: string[] }[] };

export const PRIVACY: LegalDoc = {
  id: 'gizlilik',
  title: 'Gizlilik ve KVKK aydınlatma metni',
  intro: `Bu metin, WatchVerse'ü kullanırken hangi bilgilerin neden tutulduğunu 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında anlatır. Veri sorumlusu: ${OWNER}.`,
  sections: [
    {
      h: 'Hesap açmadan kullanırsan',
      p: [
        'İzlediklerin, puanların, notların ve listelerin yalnızca kendi cihazında saklanır. Bize hiçbir kişisel bilgi gelmez.',
        'Arama yaptığında aramalar ara sunucumuz üzerinden TMDB\'ye iletilir; arama kayıtları tutulmaz. Afiş görselleri doğrudan TMDB\'den yüklendiği için TMDB, internet adresini görebilir.',
      ],
    },
    {
      h: 'Hesap açarsan tutulan bilgiler',
      p: [
        'Mail adresin ve şifren. Şifren açık hâliyle saklanmaz, yalnızca geri çözülemeyen bir özeti tutulur.',
        'Google ile girersen Google\'ın paylaştığı mail adresin, adın ve profil fotoğrafının bağlantısı.',
        'Uygulamadaki kayıtların: izlediğin film ve bölümler, puanların, notların, listelerin, takip ettiğin evrenler, girdiğin ad ve görünüm tercihlerin.',
        'Giriş yaptığın zaman ve oturum bilgisi (güvenlik için).',
      ],
    },
    {
      h: 'Diğer bilgiler',
      p: [
        'Bildirimleri açarsan: cihazına özel bir kimlik, tarayıcının verdiği bildirim adresi ve takip ettiğin dizilerin kimlikleri. Bunlar yalnızca bildirim göndermek için kullanılır.',
        'Uygulamada bir hata olursa: hata metni, hatanın olduğu ekran, uygulama sürümü ve tarayıcı bilgisi. Mail adresin, kimliğin ya da izlediklerin bu kayda eklenmez. Hata kayıtları 60 gün sonra silinir.',
        'Reklam, takip çerezi ya da kullanım analizi yoktur. Bilgilerin satılmaz, başkasıyla paylaşılmaz.',
      ],
    },
    {
      h: 'Neden tutuluyor, hukuki sebebi ne',
      p: [
        'Hesabını açmak, girişini doğrulamak ve kayıtlarını cihazların arasında eşitlemek için. Hukuki sebep: hizmetin sunulması için gerekli olması (KVKK md. 5/2-c).',
        'Hata kayıtları ve oturum bilgisi, uygulamanın güvenli ve düzgün çalışması için tutulur (KVKK md. 5/2-f, meşru menfaat).',
      ],
    },
    {
      h: 'Bilgiler nerede saklanıyor',
      p: [
        'Hesap ve kayıtlar Supabase\'in Avrupa Birliği\'ndeki sunucularında saklanır. Bildirim kayıtları ve ara sunucu Cloudflare\'de, site GitHub Pages\'te çalışır. Bu hizmetler yurt dışındadır.',
        'Bu nedenle hesap açarken bilgilerinin yurt dışında saklanmasına açık rızan istenir (KVKK md. 9). Rıza vermezsen hesap açmadan, yalnızca cihazında kullanmaya devam edebilirsin.',
      ],
    },
    {
      h: 'Ne kadar süre saklanıyor',
      p: [
        'Hesabını silene kadar. Profil → Hesap → Hesabı sil dediğinde hesabın ve sunucudaki tüm kayıtların hemen ve kalıcı olarak silinir.',
        `Bildirim kaydını sildirmek istersen ${CONTACT} adresine yazabilirsin.`,
      ],
    },
    {
      h: 'Hakların',
      p: [
        'KVKK md. 11 uyarınca bilgilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme, aktarıldığı yerleri öğrenme ve itiraz etme hakkın var.',
        `Hesabını uygulamanın içinden kendin silebilirsin. Diğer talepler için: ${CONTACT}`,
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  id: 'sartlar',
  title: 'Kullanım şartları',
  intro: 'WatchVerse\'ü kullanarak aşağıdaki şartları kabul etmiş olursun.',
  sections: [
    {
      h: 'Hizmet',
      p: [
        'WatchVerse, izlediğin film ve dizileri takip etmen için ücretsiz bir araçtır. Film ve dizi izletmez; yalnızca bilgi ve takip sunar.',
        'Hizmet "olduğu gibi" sunulur. Kesintisiz ya da hatasız çalışacağı garanti edilmez; özellikler değişebilir ya da hizmet sonlandırılabilir.',
      ],
    },
    {
      h: 'İçerik bilgileri',
      p: [
        'Film ve dizi bilgileri, puanlar ve görseller TMDB\'den, platform bilgileri JustWatch\'tan (TMDB üzerinden) gelir. Bu bilgiler eksik ya da güncel olmayabilir.',
        'This product uses the TMDB API but is not endorsed or certified by TMDB.',
        'İzleme sıraları ve "Neden?" notları öneridir; resmî değildir.',
      ],
    },
    {
      h: 'Hesabın',
      p: [
        'Hesabının güvenliğinden sen sorumlusun; şifreni kimseyle paylaşma.',
        'Uygulamayı kötüye kullanmak (sunucuyu yormak, başkasının hesabına girmeye çalışmak gibi) yasaktır; bu durumda hesap kapatılabilir.',
        'Hesabını istediğin an Profil → Hesap bölümünden silebilirsin.',
      ],
    },
    {
      h: 'Değişiklikler',
      p: ['Bu şartlar ve gizlilik metni güncellenebilir. Önemli bir değişiklik olursa uygulamada duyurulur.'],
    },
  ],
};

export const LEGAL = { gizlilik: PRIVACY, sartlar: TERMS };
