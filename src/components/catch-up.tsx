import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAccount } from '@/lib/account';
import { confirm } from '@/lib/confirm';
import { C, F, R } from '@/lib/theme';
import { Btn, Pills, Small, useToast } from './ui';
export type CatchUpResult = { nums:number[]; ids?:Record<string,number> };
export function CatchUpControl({ seasons, load, seen, apply }: {
  seasons:number[]; load:(season:number,episode:number)=>Promise<CatchUpResult>;
  seen:()=>number[]; apply:(nums:number[],value:boolean,ids?:Record<string,number>)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [season,setSeason]=useState(seasons[0] || 1);
  const [episode,setEpisode]=useState('1');
  const [busy,setBusy]=useState(false);
  const toast=useToast();
  const account=useAccount();
  const generation=useRef({value:0});
  useEffect(()=>{const scope=generation.current;scope.value++;return ()=>{scope.value++;};},[account.user?.id]);
  const preview=async()=>{
    const ticket=++generation.current.value;setBusy(true);
    try {
      const result=await load(season,Number(episode));
      if(ticket!==generation.current.value)return;
      const current=new Set(seen());const changed=result.nums.filter(n=>!current.has(n));
      if(!changed.length){toast('Seçtiğin yere kadar tüm bölümler zaten işaretli.');return;}
      confirm('Buraya kadar izledim', `${season}. sezon ${Number(episode)}. bölüme kadar ${changed.length} yeni bölüm işaretlenecek. Önceden işaretlediklerin korunur. İzleme tarihi bilinmediğinden bugünün istatistiğine eklenmez.`, 'İşaretle', ()=>{
        if(ticket!==generation.current.value)return;
        const latest=new Set(seen());const added=changed.filter(n=>!latest.has(n));
        try { apply(added,true,result.ids); } catch(error) { toast(error instanceof Error ? error.message : 'İşaretleme yapılamadı.'); return; }
        setOpen(false);
        toast(`${added.length} bölüm işaretlendi`,{label:'Geri al',onPress:()=>{if(ticket===generation.current.value)apply(added,false);}});
      });
    } catch(error){if(ticket===generation.current.value)toast(error instanceof Error?error.message:'Bölümler yüklenemedi. Tekrar dene.');}
    finally{if(ticket===generation.current.value)setBusy(false);}
  };
  return <View style={{marginTop:12,gap:10}}>
    <Btn kind="secondary" label="Buraya kadar izledim" onPress={()=>setOpen(v=>!v)} disabled={busy} />
    {open && <>
      <Small>Sezonu ve son izlediğin bölümün numarasını seç.</Small>
      <Pills value={String(season)} onChange={v=>{setSeason(Number(v));setEpisode('1');}} options={seasons.map(s=>({id:String(s),label:`Sezon ${s}`}))} />
      <TextInput value={episode} onChangeText={setEpisode} editable={!busy} keyboardType="number-pad" maxLength={4} accessibilityLabel="Son izlenen bölüm numarası" style={{color:C.text,fontFamily:F.regular,backgroundColor:C.card,padding:12,borderRadius:R.md,fontSize:16}} />
      <Btn label={busy?'Bölümler kontrol ediliyor…':'Değişikliği önizle'} onPress={()=>void preview()} disabled={busy || !/^[1-9]\d*$/.test(episode)} />
    </>}
  </View>;
}
