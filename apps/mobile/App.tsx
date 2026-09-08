import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import ActionSurface from './src/ActionSurface';
import FileConfirmationSurface from './src/FileConfirmationSurface';
import PairingSurface from './src/PairingSurface';
import SettingsSurface from './src/SettingsSurface';
import TextComposerSurface from './src/TextComposerSurface';
import { getClipboard, getStatus, lockDesktop, OmarchyClientError, pairDesktop, rediscoverDesktop, sendClipboard, sendFile, sendText, updateDesktopEndpoint } from './src/client';
import type { ConnectionState, PairedDesktop } from './src/model';
import { parsePairingCode } from './src/model';
import { clearPairing, loadPairing, savePairing } from './src/storage';
import { useLocalIncomingShare } from './src/useLocalIncomingShare';

type PendingFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  fromShare: boolean;
};

export default function App() {
  const incomingShare = useLocalIncomingShare();
  const handledShare = useRef<string | null>(null);
  const pairingInFlight = useRef(false);
  const [desktop, setDesktop] = useState<PairedDesktop | null>();
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [endpointMessage, setEndpointMessage] = useState('');
  const [endpointSaving, setEndpointSaving] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string>();
  const [manualCode, setManualCode] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFromShare, setComposerFromShare] = useState(false);
  const [sharedText, setSharedText] = useState('');
  const [incomingFile, setIncomingFile] = useState<PendingFile | null>(null);
  const [transferProgress, setTransferProgress] = useState<{ sent: number; total: number } | null>(null);
  const transferController = useRef<AbortController | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    loadPairing().then((paired) => {
      setDesktop(paired);
      setLastSeenAt(paired?.lastSeenAt);
    }).catch((error) => {
      setMessage(errorMessage(error));
      setDesktop(null);
    });
  }, []);

  const refresh = async (paired = desktop) => {
    if (!paired) return;
    setConnection('checking');
    try {
      await getStatus(paired);
      const seenAt = new Date().toISOString();
      setLastSeenAt(seenAt);
      const saved = await savePairing({ ...paired, lastSeenAt: seenAt }).then(() => true, () => false);
      setConnection('online');
      setMessage(saved
        ? 'Connected directly over your local network.'
        : 'Connected, but the last-seen time could not be saved.');
    } catch (initialError) {
      try {
        const recovered = await rediscoverDesktop(paired);
        if (!recovered) throw initialError;
        await getStatus(recovered);
        const seenAt = new Date().toISOString();
        const updated = { ...recovered, lastSeenAt: seenAt };
        const saved = await savePairing(updated).then(() => true, () => false);
        setLastSeenAt(seenAt);
        setDesktop(updated);
        setConnection('online');
        setMessage(saved
          ? 'Reconnected after your desktop address changed.'
          : 'Reconnected, but the new desktop address could not be saved.');
      } catch {
        setConnection('offline');
        setMessage(errorMessage(initialError));
      }
    }
  };

  useEffect(() => { if (desktop) void refresh(desktop); }, [desktop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && desktop) void refresh(desktop);
    });
    return () => subscription.remove();
  }, [desktop]);

  useEffect(() => {
    if (!desktop) {
      if (incomingShare.sharedPayloads.length > 0) setMessage('Pair a desktop before sending this shared item.');
      return;
    }
    if (incomingShare.error) {
      setMessage(`Could not read the shared item: ${incomingShare.error.message}`);
      incomingShare.clearSharedPayloads();
      handledShare.current = null;
      return;
    }
    if (incomingShare.sharedPayloads.length === 0) return;
    if (incomingShare.sharedPayloads.length !== 1) {
      setMessage('Omarchy accepts one shared item at a time.');
      incomingShare.clearSharedPayloads();
      handledShare.current = null;
      return;
    }
    const payload = incomingShare.sharedPayloads[0];
    const key = `${payload.shareType}:${payload.value}`;
    if (handledShare.current === key) return;
    handledShare.current = key;
    if (payload.shareType === 'text' || payload.shareType === 'url') {
      setSharedText(payload.value);
      setComposerFromShare(true);
      setComposerOpen(true);
      return;
    }
    if (payload.shareType === 'image' || payload.shareType === 'file') {
      const uri = payload.value;
      let file: File;
      try {
        file = new File(uri);
      } catch {
        setMessage('The shared file is no longer available. Please share it again.');
        incomingShare.clearSharedPayloads();
        handledShare.current = null;
        return;
      }
      const size = file.size ?? undefined;
      if (size !== undefined && size > 25 * 1024 * 1024) {
        setMessage('That shared file exceeds the 25 MiB limit.');
        incomingShare.clearSharedPayloads();
        handledShare.current = null;
        return;
      }
      setIncomingFile({
        uri,
        name: file.name || filenameFromUri(uri, payload.shareType === 'image' ? 'shared-image' : 'shared-file'),
        size,
        mimeType: payload.mimeType,
        fromShare: true,
      });
      return;
    }
    setMessage('Omarchy accepts shared text, URLs, images, and files.');
    incomingShare.clearSharedPayloads();
    handledShare.current = null;
  }, [desktop, incomingShare.error, incomingShare.sharedPayloads]);

  const run = async (operation: () => Promise<{ message?: string }>, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await operation();
      setConnection('online');
      setMessage(result.message ?? success ?? 'Done');
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pair = async (rawCode: string) => {
    if (pairingInFlight.current) return;
    pairingInFlight.current = true;
    setScannerOpen(false);
    setBusy(true);
    try {
      const code = parsePairingCode(rawCode);
      setMessage(`Waiting for approval on ${code.desktopName} · ${shortDesktopId(code.desktopId)}…`);
      const id = `phone_${Crypto.randomUUID().replaceAll('-', '')}`;
      const paired = await pairDesktop(code, id);
      await savePairing(paired);
      setDesktop(paired);
      setManualCode('');
      setMessage('Paired with your Omarchy desktop.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      pairingInFlight.current = false;
      setBusy(false);
    }
  };

  const openScanner = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (permission.granted) setScannerOpen(true);
    else setMessage('Camera access is needed to scan the desktop pairing code.');
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled) {
      setMessage('File selection canceled.');
      return;
    }
    const asset = result.assets[0];
    if (asset.size !== undefined && asset.size > 25 * 1024 * 1024) {
      setMessage('Choose a file up to 25 MiB.');
      return;
    }
    setIncomingFile({ ...asset, fromShare: false });
  };

  const dismissFile = () => {
    const cameFromShare = incomingFile?.fromShare === true;
    setIncomingFile(null);
    if (cameFromShare) {
      incomingShare.clearSharedPayloads();
      handledShare.current = null;
    }
  };

  const startFileTransfer = (file: PendingFile) => {
    const controller = new AbortController();
    transferController.current = controller;
    setTransferProgress({ sent: 0, total: file.size ?? 0 });
    void run(() => sendFile(desktop!, file, {
      signal: controller.signal,
      onProgress: (sent, total) => setTransferProgress({ sent, total }),
    })).then((sent) => {
      if (!sent) return;
      if (file.fromShare) {
        incomingShare.clearSharedPayloads();
        handledShare.current = null;
      }
      setIncomingFile(null);
    }).finally(() => {
      transferController.current = null;
      setTransferProgress(null);
    });
  };

  if (desktop === undefined) {
    return <SafeAreaView style={styles.center}><Text style={styles.title}>Omarchy</Text><Text>Opening your space…</Text></SafeAreaView>;
  }

  if (!desktop) {
    return (
      <SafeAreaView style={styles.pairRoot}>
        <StatusBar style="light" />
        <PairingSurface
          busy={busy}
          message={message}
          manualCode={manualCode}
          onManualCodeChange={setManualCode}
          onPair={() => void pair(manualCode)}
          onScan={() => void openScanner()}
        />
        <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
          <View style={styles.cameraRoot}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => void pair(data)} />
            <View style={styles.scanGuide}><Text style={styles.scanText}>Point at the QR code shown by Omarchy</Text></View>
            <Pressable style={styles.closeButton} onPress={() => setScannerOpen(false)}><Text style={styles.primaryButtonText}>Cancel</Text></Pressable>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.homeRoot}>
      <StatusBar style="auto" />
      <ActionSurface
        desktopName={desktop.desktopName} connection={connection} busy={busy} message={message}
        onRefresh={() => void refresh()}
        onSettings={() => setSettingsOpen(true)}
        onSendClipboard={() => void run(async () => sendClipboard(desktop, await Clipboard.getStringAsync()))}
        onGetClipboard={() => void run(async () => {
          const result = await getClipboard(desktop);
          await Clipboard.setStringAsync(result.text);
          return { message: result.text ? 'Desktop clipboard copied to your phone.' : 'Desktop clipboard is empty.' };
        })}
        onSendText={() => { setComposerFromShare(false); setComposerOpen(true); }}
        onSendFile={() => void chooseFile()}
        onLock={() => Alert.alert('Lock your desktop?', `This will immediately lock ${desktop.desktopName}.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Lock', style: 'destructive', onPress: () => void run(() => lockDesktop(desktop)) },
        ])}
      />
      <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <SafeAreaView style={styles.homeRoot}>
          <SettingsSurface
            desktopName={desktop.desktopName}
            desktopId={shortDesktopId(desktop.desktopId)}
            endpointHost={desktop.host}
            endpointPort={desktop.port}
            endpointMessage={endpointMessage}
            endpointSaving={endpointSaving}
            connection={connection}
            lastSeen={formatLastSeen(lastSeenAt)}
            onSaveEndpoint={(host, port) => {
              if (endpointSaving) return;
              const parsed = parseManualEndpoint(host, port);
              if (!parsed.ok) {
                setEndpointMessage(parsed.message);
                return;
              }
              setEndpointSaving(true);
              setEndpointMessage('Verifying the pinned desktop…');
              void updateDesktopEndpoint(desktop, parsed.host, parsed.port).then(async (updated) => {
                await savePairing(updated);
                setDesktop(updated);
                setConnection('online');
                setEndpointMessage('Address verified and saved.');
                setMessage('Connected using the manually entered address.');
              }).catch((error) => {
                setEndpointMessage(errorMessage(error));
              }).finally(() => setEndpointSaving(false));
            }}
            onOpenSystemSettings={() => void Linking.openSettings()}
            onClose={() => setSettingsOpen(false)}
            onForget={() => Alert.alert('Forget this desktop?', 'You will need to pair again. Revoke this phone on the desktop too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Forget', style: 'destructive', onPress: () => void clearPairing().then(() => {
                setSettingsOpen(false);
                setDesktop(null);
              }) },
            ])}
          />
        </SafeAreaView>
      </Modal>
      <Modal visible={composerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
        setComposerOpen(false);
        if (composerFromShare) {
          incomingShare.clearSharedPayloads(); handledShare.current = null; setComposerFromShare(false); setSharedText('');
        }
      }}>
        <SafeAreaView style={styles.homeRoot}>
          <TextComposerSurface
            value={sharedText}
            onValueChange={setSharedText}
            onCancel={() => {
              setComposerOpen(false);
              if (composerFromShare) {
                incomingShare.clearSharedPayloads();
                handledShare.current = null;
                setComposerFromShare(false);
                setSharedText('');
              }
            }}
            onSend={() => {
                const value = sharedText.trim();
                if (!value) return;
                const cameFromShare = composerFromShare;
                setComposerOpen(false); setSharedText(''); setComposerFromShare(false);
                void run(() => sendText(desktop, value)).then((sent) => {
                  if (sent && cameFromShare) {
                    incomingShare.clearSharedPayloads();
                    handledShare.current = null;
                  } else if (!sent) {
                    setSharedText(value);
                    setComposerFromShare(cameFromShare);
                    setComposerOpen(true);
                  }
                });
            }}
          />
        </SafeAreaView>
      </Modal>
      <Modal visible={incomingFile !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
        if (transferController.current) transferController.current.abort();
        else dismissFile();
      }}>
        <SafeAreaView style={styles.homeRoot}>
          <FileConfirmationSurface
            title={incomingFile?.fromShare ? 'Send shared file?' : 'Send this file?'}
            fileName={incomingFile?.name ?? 'Selected file'}
            fileMeta={`${incomingFile?.size === undefined ? 'Size will be checked before sending' : formatBytes(incomingFile.size)} · to ${desktop.desktopName}`}
            progress={transferProgress ? transferPercent(transferProgress.sent, transferProgress.total) / 100 : 0}
            progressLabel={transferProgress ? (transferProgress.total > 0 ? `${formatBytes(transferProgress.sent)} of ${formatBytes(transferProgress.total)}` : 'Preparing secure transfer…') : ''}
            transferring={transferProgress !== null}
            onCancel={() => {
              if (transferController.current) {
                transferController.current.abort();
                setMessage('Canceling file transfer…');
              } else {
                dismissFile();
              }
            }}
            onSend={() => { if (incomingFile) startFileTransfer(incomingFile); }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof OmarchyClientError) {
    switch (error.code) {
      case 'pair.rejected':
        return 'Pairing was rejected on the desktop.';
      case 'pair.expired':
      case 'pair.closed':
        return 'The pairing code expired. Create a new code on the desktop and scan it again.';
      case 'pair.replaced':
        return 'A newer pairing code replaced this request. Scan the newest code.';
      case 'auth.denied':
      case 'auth.revoked':
        return 'This phone is no longer authorized. Revoke any stale pairing on the desktop, then pair again.';
      default:
        return error.retryable ? `${error.message} You can retry.` : error.message;
    }
  }
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const normalized = message.toLowerCase();
  if (normalized.includes('canceled') || normalized.includes('cancelled')) {
    return 'File transfer canceled. You can retry when ready.';
  }
  if (normalized.includes('identity') || normalized.includes('certificate') || normalized.includes('trust anchor')) {
    return 'Desktop identity mismatch. Do not continue; create a new pairing code on the desktop.';
  }
  if (normalized.includes('timed out') || normalized.includes('timeout')) {
    return 'The desktop did not respond. Keep both devices awake on the same network, then retry.';
  }
  if (normalized.includes('network request failed') || normalized.includes('connection refused') || normalized.includes('unreachable') || normalized.includes('could not connect')) {
    return 'The desktop is unreachable. Check the LAN connection and that omarchy-linkd is running.';
  }
  return message;
}

function parseManualEndpoint(hostValue: string, portValue: string):
  | { ok: true; host: string; port: number }
  | { ok: false; message: string } {
  const host = hostValue.trim().replace(/^\[|\]$/g, '');
  const port = Number(portValue.trim());
  if (!host || /\s|\/|:\/\//.test(host)) {
    return { ok: false, message: 'Enter a hostname or IP address without https:// or a path.' };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: 'Enter a port from 1 to 65535.' };
  }
  return { ok: true, host, port };
}

function filenameFromUri(uri: string, fallback: string): string {
  const value = uri.split('/').pop()?.split('?')[0];
  if (!value) return fallback;
  try { return decodeURIComponent(value); } catch { return value; }
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
}

function transferPercent(sent: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (sent / total) * 100));
}

function shortDesktopId(desktopId: string): string {
  return desktopId.replace(/^desk_/, '').slice(0, 12).toUpperCase();
}

function formatLastSeen(value?: string): string {
  if (!value) return 'never on this phone';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'at an unknown time' : date.toLocaleString();
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  pairRoot: { flex: 1, backgroundColor: Platform.OS === 'android' ? '#fffbfe' : '#0d0b12' },
  title: { fontSize: 34, fontWeight: '800' },
  primaryButtonText: { color: 'white', fontSize: 17, fontWeight: '700' },
  homeRoot: { flex: 1, backgroundColor: Platform.OS === 'android' ? '#fffbfe' : '#f2f2f7' }, cameraRoot: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  scanGuide: { position: 'absolute', top: 80, left: 24, right: 24, alignItems: 'center', borderRadius: 18, backgroundColor: '#000b', padding: 16 }, scanText: { color: 'white', fontSize: 17, fontWeight: '600' },
  closeButton: { alignItems: 'center', borderRadius: 18, backgroundColor: '#7c3aed', padding: 17, marginBottom: 24 },
});
