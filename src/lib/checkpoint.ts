import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCheckpointStore } from './checkpoint-store';
export const checkpoint = createCheckpointStore(AsyncStorage);
