import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { MediaCard } from '@/components/media';
import { BackLink, Btn, Empty, Grid, H1, Muted, Press, Screen, Small, useLayout, useToast } from '@/components/ui';
import { ShareListButton } from '@/components/share';
import { confirm } from '@/lib/confirm';
import { routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { img } from '@/lib/tmdb';

const inputStyle = { height: 50, borderRadius: R.md, backgroundColor: C.raised, color: C.text, paddingHorizontal: 14, fontFamily: F.semibold, fontSize: 18, outlineStyle: 'none' } as never;

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const toast = useToast();
  const { posterCols } = useLayout();
  const l = store.state.lists[id || ''];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(l?.name || '');
  const [removing, setRemoving] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  if (id === 'new') {
    const create = () => { if (!name.trim()) return; const nid = store.listCreate(name); toast('Liste oluşturuldu'); router.replace(`/lists/${nid}`); };
    return (
      <Screen>
        <BackLink label="Kütüphanem" onPress={back} />
        <H1>Yeni liste</H1>
        <Muted style={{ marginTop: 6, marginBottom: 18 }}>Bir ad ver; sonra bir yapımda "Kaydet"e dokunup bu listeyi seç.</Muted>
        <TextInput value={name} onChangeText={setName} autoFocus placeholder="Örn. Hafta sonu, Eşimle izleyeceklerim" placeholderTextColor={C.dim} maxLength={60} accessibilityLabel="Liste adı" onSubmitEditing={create} returnKeyType="done" style={inputStyle} />
        <Btn label="Oluştur" style={{ marginTop: 14 }} disabled={!name.trim()} onPress={create} />
      </Screen>
    );
  }

  if (!l) return <Screen><BackLink label="Kütüphanem" onPress={back} /><Empty icon="list" title="Bu liste bulunamadı." text="Silinmiş olabilir." /></Screen>;

  const save = () => { store.listRename(l.id, name); setEditing(false); };
  return (
    <Screen>
      <BackLink label="Kütüphanem" onPress={back} />
      {editing ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={name} onChangeText={setName} autoFocus maxLength={60} accessibilityLabel="Liste adı" onSubmitEditing={save} returnKeyType="done" style={[inputStyle as object, { flex: 1 }]} />
          <Btn label="Kaydet" onPress={save} disabled={!name.trim()} />
        </View>
      ) : (
        <Press accessibilityRole="button" accessibilityLabel={`${l.name}, adını değiştir`} onPress={() => { setName(l.name); setEditing(true); }} scaleTo={1} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <H1 style={{ flexShrink: 1 }}>{l.name}</H1>
          <Feather name="edit-2" size={17} color={C.dim} />
        </Press>
      )}
      <Small style={{ marginTop: 6 }}>{l.items.length} yapım</Small>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <ShareListButton list={l} />
        {l.items.length > 0 && <Btn kind="secondary" icon={removing ? 'check' : 'minus-circle'} label={removing ? 'Bitti' : 'Çıkar'} onPress={() => setRemoving((v) => !v)} />}
      </View>

      <View style={{ marginTop: 22 }}>
        {l.items.length ? (
          <Grid items={l.items} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.k}
            render={(x, cw) => (
              <View>
                <MediaCard uri={img(x.p, 'w342')} title={x.t} sub={x.y ? String(x.y) : undefined} width={cw}
                  onPress={() => (removing ? (store.listToggle(l.id, x), toast('Listeden çıkarıldı')) : router.push((x.k.includes(':') ? routeOf(x.k) : `/title/${x.k}`) as never))} />
                {removing && (
                  <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="x" size={16} color={C.onAccent} />
                  </View>
                )}
              </View>
            )} />
        ) : <Empty icon="list" title="Bu liste henüz boş." text={'Bir yapımda "Kaydet"e dokunup bu listeyi seç.'} action="Keşfet'e git" onAction={() => router.push('/explore')} />}
      </View>

      <Btn kind="quiet" label="Listeyi sil" style={{ alignSelf: 'flex-start', marginTop: 28 }}
        onPress={() => confirm('Liste silinsin mi?', `"${l.name}" listesi silinir. İçindeki yapımlar kütüphanende kalır.`, 'Sil', () => { store.listDelete(l.id); toast('Liste silindi'); back(); })} />
    </Screen>
  );
}
