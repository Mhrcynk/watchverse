import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { finishAuth } from '@/lib/auth-callback';
import { Screen, Muted, Btn } from '@/components/ui';
export default function AuthCallback() {
  const url = Linking.useURL();
  const [message, setMessage] = useState('Giriş tamamlanıyor…');
  useEffect(() => {
    if (!url) return;
    let active = true;
    finishAuth(url).then(() => { if (active) router.replace('/account'); })
      .catch(() => { if (active) setMessage('Bağlantı kullanılmış veya süresi dolmuş olabilir. Giriş ekranından yeniden dene.'); });
    return () => { active = false; };
  }, [url]);
  return <Screen><Muted>{message}</Muted><Btn label="Hesabı aç" onPress={() => router.replace('/account')} /></Screen>;
}
