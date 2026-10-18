import { Redirect } from 'expo-router';

/** Öneriler artık Keşfet sekmesinin kendisi; eski bağlantılar oraya gider. */
export default function Discovery() {
  return <Redirect href="/explore" />;
}
