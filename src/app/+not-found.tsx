import { router } from 'expo-router';
import { Empty, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Empty icon="compass" title="Bu sayfa bulunamadı." text="Bağlantı eski ya da hatalı olabilir." action="Ana sayfaya dön" onAction={() => router.replace('/')} />
    </Screen>
  );
}
