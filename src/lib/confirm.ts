import { Alert, Platform } from 'react-native';

type Ask = (title: string, message: string, ok: string, onOk: () => void) => void;
let handler: Ask | null = null;
/** Uygulama içi onay penceresi kaydolur (web/ana ekran uygulaması için) */
export const setConfirmHandler = (h: Ask | null) => { handler = h; };

/** Onay penceresi — uygulama içi sayfa varsa o, yoksa telefonda yerel uyarı */
export function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (handler) return handler(title, message, ok, onOk);
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'Vazgeç', style: 'cancel' }, { text: ok, style: 'destructive', onPress: onOk }]);
}
