import { Platform, Share } from 'react-native';

const fileName = () => `watchverse-yedek-${new Date().toISOString().slice(0, 10)}.txt`;

/** Yedeği dosya olarak verir: iPhone'da paylaşma sayfası açılır ("Dosyalar'a Kaydet" → iCloud Drive), bilgisayarda indirilir */
export async function saveBackupFile(code: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try { await Share.share({ message: code, title: 'WatchVerse yedeği' }); return true; } catch { return false; }
  }
  try {
    const file = new File([code], fileName(), { type: 'text/plain' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'WatchVerse yedeği' });
      return true;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (e) {
    // Kullanıcı paylaşmayı iptal ettiyse sessizce dön
    return false;
  }
}

/** Dosya seçtirir ve içeriğini döndürür (yalnızca web) */
export function pickBackupFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then((t) => resolve(t)).catch(() => resolve(null));
    };
    input.click();
  });
}
