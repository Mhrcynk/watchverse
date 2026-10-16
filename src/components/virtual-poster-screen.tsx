import { useRef, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { useScrollToTop } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { posterGrid } from '@/lib/audit-logic';
import { C, MAX_W } from '@/lib/theme';
import { useLayout } from './ui';
/** One vertical scroller; cards outside the window are not mounted. */
export function VirtualPosterScreen<T>({items,header,empty,footer,render,keyOf,resetKey}:{items:T[];header:ReactNode;empty:ReactNode;footer?:ReactNode;render:(item:T,width:number)=>ReactNode;keyOf:(item:T)=>string;resetKey:string}) {
  const {pad,tablet,posterCols}=useLayout();
  const insets=useSafeAreaInsets();
  const [width,setWidth]=useState(0);
  const {cols,cardWidth}=posterGrid(width-pad*2-insets.left-insets.right,posterCols);
  const ref=useRef<FlatList<T>>(null);
  useScrollToTop(ref);
  return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{flex:1,width:'100%',maxWidth:MAX_W,alignSelf:'center',backgroundColor:C.bg}}>
    {width>0 && <FlatList ref={ref} key={`${cols}:${resetKey}`} data={items} numColumns={cols} keyExtractor={keyOf}
      ListHeaderComponent={<View style={{marginBottom:20}}>{header}</View>}
      ListEmptyComponent={<>{empty}</>} ListFooterComponent={<>{footer}</>}
      renderItem={({item})=><View style={{width:cardWidth,marginBottom:22}}>{render(item,cardWidth)}</View>}
      columnWrapperStyle={cols>1?{gap:14}:undefined}
      initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{paddingLeft:pad+insets.left,paddingRight:pad+insets.right,paddingTop:insets.top+(tablet?28:14),paddingBottom:(tablet?40:100)+insets.bottom}}
    />}
  </View>;
}
