/** Web: yedek dosyası tarayıcıdan indirilir; içe aktarmada dosya seçici açılır. */

export async function shareTextFile(text: string, name: string, mimeType = 'text/plain'): Promise<boolean> {
  try {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    // Telefonda paylaşım menüsü varsa onu kullan (Dosyalar'a kaydet, AirDrop vb.)
    const file = typeof File !== 'undefined' ? new File([blob], name, { type: mimeType }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'WatchVerse' }); return true; }
      catch (e) { if ((e as { name?: string })?.name === 'AbortError') return false; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch { return false; }
}

export const saveBackupFile = (code: string) => shareTextFile(code, `watchverse-yedek-${Date.now()}.txt`);

export function pickDataFile(types: string[] = ['text/plain']): Promise<{ name: string; data: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = types.join(',');
    input.style.display = 'none';
    let done = false;
    const finish = (v: { name: string; data: Uint8Array } | null, err?: unknown) => {
      if (done) return; done = true; input.remove();
      if (err) reject(err); else resolve(v);
    };
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return finish(null);
      if (f.size > 20 * 1024 * 1024) return finish(null, new Error('Dosya en fazla 20 MB olabilir.'));
      try { finish({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }); } catch (e) { finish(null, e); }
    });
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await pickDataFile();
  return result ? new TextDecoder().decode(result.data) : null;
}
