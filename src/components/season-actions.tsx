import { View } from 'react-native';
import { changedEpisodes } from '@/lib/audit-logic';
import { Btn, Small, tap, useToast } from './ui';
export function SeasonActions({nums,seen,set}:{nums:number[];seen:number[];set:(nums:number[],value:boolean)=>void}) {
  const toast=useToast();const count=nums.filter(n=>seen.includes(n)).length;const done=nums.length>0 && count===nums.length;
  if(!nums.length)return null;
  return <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',marginTop:14}}>
    <Small>{count} / {nums.length} bölüm izlendi</Small>
    <Btn kind="quiet" label={done?'Sezonun işaretlerini kaldır':'Sezonu tamamladım'} onPress={()=>{
      const changed=changedEpisodes(nums,seen,done);set(changed,!done);tap('success');
      toast(done?'Sezon işaretleri kaldırıldı':'Sezon tamamlandı',{label:'Geri al',onPress:()=>set(changed,done)});
    }} />
  </View>;
}
