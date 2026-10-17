import { createContext, useContext, type ReactNode } from 'react';
import { Linking } from 'react-native';
const TrailerCtx = createContext({ play: (yt: string, _title?: string) => { Linking.openURL(`https://www.youtube.com/watch?v=${encodeURIComponent(yt)}`).catch(() => {}); } });
export const useTrailer = () => useContext(TrailerCtx);
export function TrailerProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
