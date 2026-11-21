/**
 * Platform-Safe Haptic Feedback Helper with In-App Toggle Support
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_STORAGE_KEY = '@lexicard_haptics_enabled';

let hapticsEnabled = true;

// Initialize setting from AsyncStorage on app launch
AsyncStorage.getItem(HAPTICS_STORAGE_KEY)
  .then((val) => {
    if (val !== null) {
      hapticsEnabled = val === 'true';
    }
  })
  .catch(() => {});

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export async function loadHapticsSetting(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(HAPTICS_STORAGE_KEY);
    if (val !== null) {
      hapticsEnabled = val === 'true';
    }
  } catch {
    // Ignore storage errors
  }
  return hapticsEnabled;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  hapticsEnabled = enabled;
  try {
    await AsyncStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

export function triggerLightHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore on unsupported devices
  }
}

export function triggerSuccessHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }
}

export function triggerWarningHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore
  }
}
