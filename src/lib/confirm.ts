import { Alert, Platform } from 'react-native';

/** Onay penceresi — telefonda yerel uyarı, web önizlemesinde tarayıcı onayı */
export function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'Vazgeç', style: 'cancel' }, { text: ok, style: 'destructive', onPress: onOk }]);
}
