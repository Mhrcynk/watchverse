import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { C, F, MAX_W, R, TABLET, alpha } from '@/lib/theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];

/* ---------- yerleşim ---------- */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  // Kısa kenara bak: yatay tutulan telefon tablet sayılmasın
  const tablet = Math.min(width, height) >= 600 && width >= TABLET;
  const contentW = Math.min(width, MAX_W) - (tablet ? 220 : 0);
  const pad = tablet ? 32 : 20;
  const posterCols = width >= 1200 ? 6 : tablet ? 5 : width >= 420 ? 3 : 3;
  return { width, height, tablet, pad, posterCols, contentW, landscape: width > height };
}

export function Screen({ children, scroll = true, style, refresh }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; refresh?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { pad, tablet } = useLayout();
  const inner = (
    <View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingLeft: pad + insets.left, paddingRight: pad + insets.right, paddingTop: insets.top + (tablet ? 28 : 14), paddingBottom: 40 + insets.bottom }, style]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: C.bg }}>{inner}</View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'android' ? 'height' : undefined} enabled={Platform.OS === 'android'}>
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
      {refresh}
      {inner}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const Row = ({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

/* ---------- yazı ---------- */
type TxtProps = TextProps & { style?: StyleProp<TextStyle> };
const mk = (base: TextStyle) => ({ style, ...p }: TxtProps) => <Text {...p} style={[base, style]} />;
export const H1 = mk({ fontFamily: F.bold, fontSize: 30, lineHeight: 36, color: C.text, letterSpacing: -0.8 });
export const H2 = mk({ fontFamily: F.bold, fontSize: 21, lineHeight: 27, color: C.text, letterSpacing: -0.4 });
export const H3 = mk({ fontFamily: F.semibold, fontSize: 16, lineHeight: 22, color: C.text });
export const Body = mk({ fontFamily: F.regular, fontSize: 15, lineHeight: 23, color: C.text });
export const Muted = mk({ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: C.muted });
export const Small = mk({ fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: C.muted });
/** Büyük harfli küçük başlık. Türkçe arayüz metni için lang="tr", yapım/evren adları için lang="en" (I/İ dönüşümü). */
const eyebrowBase: TextStyle = { fontFamily: F.semibold, fontSize: 11.5, letterSpacing: 1.6, color: C.accentSoft };
const upper = (c: ReactNode, lang: string): ReactNode =>
  typeof c === 'string' ? c.toLocaleUpperCase(lang) : Array.isArray(c) ? c.map((x) => upper(x, lang)) : c;
export function Eyebrow({ children, lang = 'tr', style, ...p }: TxtProps & { lang?: 'tr' | 'en' }) {
  return <Text {...p} style={[eyebrowBase, style]}>{upper(children, lang)}</Text>;
}

/* ---------- etkileşim ---------- */
export function tap(kind: 'light' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function Press({ style, children, ...p }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Pressable {...p} style={({ pressed }) => [style, pressed && { opacity: 0.72, transform: [{ scale: 0.985 }] }]}>
      {children}
    </Pressable>
  );
}

type BtnKind = 'primary' | 'secondary' | 'quiet' | 'success';
export function Btn({ label, icon, kind = 'primary', onPress, style, disabled, accessibilityLabel }: {
  label: string; icon?: IconName; kind?: BtnKind; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; accessibilityLabel?: string;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'success' ? alpha(C.green, 0.16) : kind === 'secondary' ? C.raised : 'transparent';
  const fg = kind === 'success' ? C.green : kind === 'quiet' ? C.accentSoft : C.text;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress?.(); }}
      style={[{ minHeight: 46, paddingHorizontal: kind === 'quiet' ? 4 : 18, borderRadius: R.md, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.4 : 1, borderWidth: kind === 'secondary' ? StyleSheet.hairlineWidth : 0, borderColor: C.line }, style]}
    >
      {icon && <Feather name={icon} size={17} color={fg} />}
      <Text style={{ fontFamily: F.semibold, fontSize: 15, color: fg }}>{label}</Text>
    </Press>
  );
}

export function Chip({ label, icon, color = C.muted, bg = C.card, onPress, active }: { label: string; icon?: IconName; color?: string; bg?: string; onPress?: () => void; active?: boolean }) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: active ? alpha(C.accent, 0.22) : bg, borderWidth: StyleSheet.hairlineWidth, borderColor: active ? C.accent : C.line }}>
      {icon && <Feather name={icon} size={13} color={active ? C.accentSoft : color} />}
      <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: active ? C.text : color }}>{label}</Text>
    </View>
  );
  return onPress ? <Press accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={() => { tap(); onPress(); }}>{content}</Press> : content;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: R.md, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(o.id); }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: R.sm, backgroundColor: on ? C.raised : 'transparent', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? F.semibold : F.medium, fontSize: 13, color: on ? C.text : C.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pills<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {options.map((o) => <Chip key={o.id} label={o.label} active={o.id === value} onPress={() => onChange(o.id)} />)}
    </ScrollView>
  );
}

/* ---------- ilerleme ---------- */
export function Bar({ pct, color = C.accent, height = 5 }: { pct: number; color?: string; height?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height, borderRadius: 9, backgroundColor: C.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: 9 }} />
    </View>
  );
}

export function Ring({ pct, size = 86, color = C.accent, label }: { pct: number; size?: number; color?: string; label?: string }) {
  const sw = Math.max(6, size * 0.085), r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <View accessibilityLabel={`Yüzde ${pct}${label ? ' ' + label : ''}`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontFamily: F.bold, fontSize: size * 0.24, color: C.text, letterSpacing: -0.5 }}>{pct}%</Text>
      {label && <Text style={{ fontFamily: F.regular, fontSize: Math.max(10, size * 0.11), color: C.muted }}>{label}</Text>}
    </View>
  );
}

/* ---------- bölümler ---------- */
export function SectionHead({ title, action, onAction, note }: { title: string; action?: string; onAction?: () => void; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 34, marginBottom: 14, gap: 12 }}>
      <H2 style={{ flexShrink: 1 }} accessibilityRole="header">{title}</H2>
      {action && onAction ? (
        <Press accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={{ fontFamily: F.medium, fontSize: 14, color: C.accentSoft }}>{action}</Text></Press>
      ) : note ? <Small>{note}</Small> : null}
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.card, borderRadius: R.lg, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }, style]}>{children}</View>;
}

export function Empty({ icon = 'compass', title, text, action, onAction }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, borderRadius: R.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: alpha(C.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={22} color={C.accentSoft} />
      </View>
      <H3 style={{ marginTop: 14, textAlign: 'center' }}>{title}</H3>
      {text && <Muted style={{ marginTop: 6, textAlign: 'center', maxWidth: 360 }}>{text}</Muted>}
      {action && onAction && <Btn label={action} onPress={onAction} style={{ marginTop: 18 }} />}
    </View>
  );
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 16 }} />;

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${label} sayfasına dön`} onPress={onPress} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 18, paddingVertical: 4 }}>
      <Feather name="chevron-left" size={20} color={C.muted} />
      <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.muted }}>{label}</Text>
    </Press>
  );
}

/* ---------- bildirim ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { tablet } = useLayout();
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    Animated.spring(a, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 8 }).start();
    timer.current = setTimeout(() => Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(), 2300);
  }, [a]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
        style={{ position: 'absolute', alignSelf: 'center', bottom: insets.bottom + (tablet ? 28 : 92), opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        {msg && (
          <View style={{ backgroundColor: C.text, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 99, maxWidth: 420 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.bg, textAlign: 'center' }}>{msg}</Text>
          </View>
        )}
      </Animated.View>
    </ToastCtx.Provider>
  );
}

/** Kendi genişliğini ölçen ızgara: kenar çubuğu ve ekran dönüşünden bağımsız doğru sütun genişliği */
export function Grid<T>({ items, cols, gap = 14, rowGap, render, keyOf }: {
  items: T[]; cols: number; gap?: number; rowGap?: number; render: (item: T, width: number) => ReactNode; keyOf: (item: T) => string;
}) {
  const [w, setW] = useState(0);
  const cw = w ? Math.floor((w - gap * (cols - 1)) / cols) : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: rowGap ?? gap }}>
      {cw > 0 && items.map((it) => <View key={keyOf(it)} style={{ width: cw }}>{render(it, cw)}</View>)}
    </View>
  );
}
