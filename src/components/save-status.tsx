import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { checkpoint } from '@/lib/checkpoint';
import { useAccount } from '@/lib/account';
import { C } from '@/lib/theme';
import { Btn, Small } from './ui';

/** onlyProblems: her şey yolundayken hiçbir şey göstermez (ana sayfada gereksiz yer kaplamasın) */
export function SaveStatus({ onlyProblems = false }: { onlyProblems?: boolean }) {
  const local = useSyncExternalStore(checkpoint.subscribeStatus,checkpoint.getStatus,checkpoint.getStatus);
  const acc = useAccount();
  const failed = local==='error' || acc.status==='error' || acc.status==='offline';
  if (onlyProblems && !failed) return null;
  const text = local==='error' ? 'Değişiklikler bu cihaza kaydedilemedi. Uygulamayı silme.' : local==='saving' ? 'Bu cihaza kaydediliyor…' : acc.status==='offline' ? 'Bu cihazda kaydedildi. Bağlantı kurulamadı; bağlantı gelince yeniden eşitle.' : acc.status==='error' ? 'Bu cihazda kaydedildi. Buluta eşitlenemedi. Ayrıntılar profilinde; yeniden deneyebilirsin.' : acc.status==='syncing' ? 'Bu cihazda kaydedildi. Buluta eşitleniyor…' : acc.user && acc.lastSync ? 'Bu cihazda kaydedildi · Son eşitleme '+new Date(acc.lastSync).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : 'Bu cihazda kaydedildi.';
  return <View accessibilityLiveRegion="polite" style={{marginVertical:12,gap:6}}>
    <Small style={{color:failed?C.amber:C.muted}}>{text}</Small>
    {failed && <Btn kind="quiet" label="Tekrar dene" onPress={()=>{ void checkpoint.flush().then(()=>acc.syncNow()).catch(()=>{}); }} />}
  </View>;
}
