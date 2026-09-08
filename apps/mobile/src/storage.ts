import * as SecureStore from 'expo-secure-store';

import type { PairedDesktop } from './model';

const KEY = 'omarchy.mobile.paired-desktop.v1';

export async function loadPairing(): Promise<PairedDesktop | null> {
  const value = await SecureStore.getItemAsync(KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as PairedDesktop;
  } catch {
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}

export async function savePairing(pairing: PairedDesktop): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(pairing), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
