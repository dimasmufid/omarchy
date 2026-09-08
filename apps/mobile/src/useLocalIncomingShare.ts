import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Sharing from 'expo-sharing';

function readPayloads(): Sharing.SharePayload[] {
  try {
    return Sharing.getSharedPayloads();
  } catch {
    return [];
  }
}

export function useLocalIncomingShare() {
  const [sharedPayloads, setSharedPayloads] = useState<Sharing.SharePayload[]>(readPayloads);
  const [error, setError] = useState<Error | null>(null);
  const signature = useRef('');

  const refresh = useCallback(() => {
    try {
      const payloads = Sharing.getSharedPayloads();
      const nextSignature = JSON.stringify(payloads);
      if (nextSignature !== signature.current) {
        signature.current = nextSignature;
        setSharedPayloads(payloads);
      }
      setError(null);
    } catch (value) {
      setError(value instanceof Error ? value : new Error('Could not read the shared item.'));
    }
  }, []);

  const clear = useCallback(() => {
    Sharing.clearSharedPayloads();
    signature.current = '';
    setSharedPayloads([]);
    setError(null);
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { sharedPayloads, error, clearSharedPayloads: clear };
}
