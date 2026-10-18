import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCheckpointStore } from './checkpoint-store';
import { freeCacheSpace } from './storage-space';

/** Yer kalmazsa (web) önce yeniden indirilebilen önbellek temizlenir, kayıt bir kez daha denenir. */
const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  async setItem(key: string, value: string) {
    try { return await AsyncStorage.setItem(key, value); }
    catch (error) {
      if (await freeCacheSpace()) return AsyncStorage.setItem(key, value);
      throw error;
    }
  },
};
export const checkpoint = createCheckpointStore(storage);
