import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
export async function currentPushToken(): Promise<string | null> {
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!Device.isDevice || !projectId) return null;
  const p = await Notifications.getPermissionsAsync();
  if (!p.granted) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
export const nativePushEnabled = process.env.EXPO_PUBLIC_NATIVE_PUSH_ENABLED === 'true';
export async function enablePush(_follow: string[]): Promise<{ok:true} | {ok:false;reason:string}> {
  try {
    if (!nativePushEnabled) return {ok:false,reason:'Bildirimler bu deneme sürümünde henüz kullanılamıyor.'};
    if (!Device.isDevice) return {ok:false,reason:'Bildirim için gerçek cihaz gerekir.'};
    if (!(Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId)) return {ok:false,reason:'Bildirim yapılandırması bu derlemede tamamlanmamış.'};
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {name:'Yeni bölümler',importance:Notifications.AndroidImportance.DEFAULT});
    const p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return {ok:false,reason:'Bildirim izni verilmedi. Telefon ayarlarından açabilirsin.'};
    return await currentPushToken() ? {ok:true} : {ok:false,reason:'Bildirim kaydı alınamadı.'};
  } catch { return {ok:false,reason:'Bildirim kaydı alınamadı. Daha sonra tekrar dene.'}; }
}
export async function copyText(text:string) { try { await Clipboard.setStringAsync(text); return true; } catch { return false; } }
