import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View } from 'react-native';
import { C, F, R } from '@/lib/theme';
import { Eyebrow, Panel, Press, tap } from './ui';
export function RatingNotes({rating,note,onRating,onNote}:{rating:number;note:string;onRating:(n:number)=>void;onNote:(s:string)=>void}) {
  return <Panel style={{marginTop:14}}>
    <Eyebrow>Senin değerlendirmen</Eyebrow>
    <View accessibilityLabel={`Puan: ${rating} / 5`} style={{flexDirection:'row',gap:4,marginTop:8}}>
      {[1,2,3,4,5].map(n=><Press key={n} accessibilityRole="button" accessibilityLabel={`${n} yıldız`} accessibilityState={{selected:rating===n}} scaleTo={.85} hitSlop={4} onPress={()=>{onRating(n);tap();}} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name={rating>=n?'star':'star-outline'} size={28} color={rating>=n?C.amber:C.dim} />
      </Press>)}
    </View>
    <TextInput value={note} onChangeText={onNote} placeholder="Kısa bir not ekle (sadece sen görürsün)" placeholderTextColor={C.dim} multiline maxLength={500} accessibilityLabel="Not"
      style={{marginTop:10,minHeight:64,padding:12,borderRadius:R.md,backgroundColor:C.bg,borderWidth:StyleSheet.hairlineWidth,borderColor:C.line,color:C.text,fontFamily:F.regular,fontSize:16,lineHeight:22,textAlignVertical:'top'}} />
  </Panel>;
}
