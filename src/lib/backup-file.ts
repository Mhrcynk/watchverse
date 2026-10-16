import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareTextFile(text: string, name: string, mimeType = 'text/plain', UTI = 'public.plain-text'): Promise<boolean> {
  const file = new File(Paths.cache, name);
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: 'WatchVerse' });
    return true;
  } catch { return false; }
  finally { if (file.exists) file.delete(); }
}
export const saveBackupFile = (code: string) => shareTextFile(code, `watchverse-yedek-${Date.now()}.txt`);
export async function pickDataFile(types: string[] = ['text/plain']): Promise<{ name: string; data: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Dosya en fazla 20 MB olabilir.');
    return { name: asset.name, data: await file.bytes() };
  } finally { if (file.exists) file.delete(); }
}
export async function pickBackupFile(): Promise<string | null> {
  const result = await pickDataFile();
  return result ? new TextDecoder().decode(result.data) : null;
}
