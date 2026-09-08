import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';

import type { PairedDesktop } from './model';

const KEY = 'omarchy.mobile.paired-desktop.v1';
const INSTALL_MARKER = new File(Paths.document, '.omarchy-install-v1');

export async function loadPairing(): Promise<PairedDesktop | null> {
  if (!INSTALL_MARKER.exists) {
    await SecureStore.deleteItemAsync(KEY);
    INSTALL_MARKER.create();
    INSTALL_MARKER.write('1');
    return null;
  }
  const value = await SecureStore.getItemAsync(KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PairedDesktop & { secret?: string };
    const { secret: _expiredSecret, ...pairing } = parsed;
    if (_expiredSecret) await savePairing(pairing);
    return pairing;
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
