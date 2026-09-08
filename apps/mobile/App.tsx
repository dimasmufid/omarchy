import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import ActionSurface from './src/ActionSurface';
import SettingsSurface from './src/SettingsSurface';
import { getClipboard, getStatus, lockDesktop, pairDesktop, rediscoverDesktop, sendClipboard, sendFile, sendText } from './src/client';
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
  const [desktop, setDesktop] = useState<PairedDesktop | null>();
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    if (busy) return;
    setScannerOpen(false);
    setBusy(true);
    setMessage('Waiting for approval on your desktop…');
    try {
      const id = `phone_${Crypto.randomUUID().replaceAll('-', '')}`;
      const paired = await pairDesktop(parsePairingCode(rawCode), id);
      await savePairing(paired);
      setDesktop(paired);
      setManualCode('');
      setMessage('Paired with your Omarchy desktop.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
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
        <View style={styles.pairContent}>
          <Text style={styles.eyebrow}>OWN YOUR CONNECTION</Text>
          <Text style={styles.hero}>Your Omarchy, in your pocket.</Text>
          <Text style={styles.body}>Run `omarchy-mobile pair`, then scan its QR code. Nothing leaves your local network.</Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={openScanner} disabled={busy}>
            <Text style={styles.primaryButtonText}>Scan pairing code</Text>
          </Pressable>
          <TextInput accessibilityLabel="Pairing code" autoCapitalize="none" autoCorrect={false} multiline placeholder="Or paste omarchy://pair…" placeholderTextColor="#817987" style={styles.input} value={manualCode} onChangeText={setManualCode} />
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void pair(manualCode)} disabled={busy || !manualCode.trim()}>
            <Text style={styles.secondaryButtonText}>{busy ? 'Waiting for desktop…' : 'Pair with pasted code'}</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
        </View>
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
            connection={connection}
            lastSeen={formatLastSeen(lastSeenAt)}
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
      <Modal visible={composerOpen} transparent animationType="fade" onRequestClose={() => {
        setComposerOpen(false);
        if (composerFromShare) {
          incomingShare.clearSharedPayloads(); handledShare.current = null; setComposerFromShare(false); setSharedText('');
        }
      }}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>Send text or URL</Text>
            <TextInput autoFocus multiline placeholder="What should appear in Omarchy Inbox?" style={styles.composerInput} value={sharedText} onChangeText={setSharedText} />
            <View style={styles.composerActions}>
              <Pressable onPress={() => {
                setComposerOpen(false);
                if (composerFromShare) {
                  incomingShare.clearSharedPayloads();
                  handledShare.current = null;
                  setComposerFromShare(false);
                  setSharedText('');
                }
              }}><Text style={styles.link}>Cancel</Text></Pressable>
              <Pressable onPress={() => {
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
              }}><Text style={styles.linkStrong}>Send</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={incomingFile !== null} transparent animationType="fade" onRequestClose={() => {
        if (transferController.current) transferController.current.abort();
        else dismissFile();
      }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>{incomingFile?.fromShare ? 'Send shared file?' : 'Send this file?'}</Text>
            <Text style={styles.fileName}>{incomingFile?.name}</Text>
            <Text style={styles.fileMeta}>{incomingFile?.size === undefined ? 'Size will be checked before sending' : formatBytes(incomingFile.size)} · to {desktop.desktopName}</Text>
            {transferProgress ? (
              <View accessibilityRole="progressbar" accessibilityValue={{
                min: 0,
                max: transferProgress.total || 1,
                now: transferProgress.sent,
              }}>
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill,
                    { width: `${transferPercent(transferProgress.sent, transferProgress.total)}%` },
                  ]} />
                </View>
                <Text style={styles.fileMeta}>
                  {transferProgress.total > 0
                    ? `${formatBytes(transferProgress.sent)} of ${formatBytes(transferProgress.total)}`
                    : 'Preparing secure transfer…'}
                </Text>
              </View>
            ) : null}
            <View style={styles.composerActions}>
              <Pressable onPress={() => {
                if (transferController.current) {
                  transferController.current.abort();
                  setMessage('Canceling file transfer…');
                } else {
                  dismissFile();
                }
              }}><Text style={styles.link}>{transferProgress ? 'Cancel transfer' : 'Cancel'}</Text></Pressable>
              {!transferProgress ? (
                <Pressable onPress={() => {
                  if (incomingFile) startFileTransfer(incomingFile);
                }}><Text style={styles.linkStrong}>Send</Text></Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
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
  pairRoot: { flex: 1, backgroundColor: '#0d0b12' }, pairContent: { flex: 1, justifyContent: 'center', gap: 18, padding: 28 },
  eyebrow: { color: '#a78bfa', fontSize: 12, fontWeight: '800', letterSpacing: 2 }, hero: { color: '#fafafa', fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
  title: { fontSize: 34, fontWeight: '800' }, body: { color: '#c4becb', fontSize: 17, lineHeight: 25 },
  primaryButton: { alignItems: 'center', borderRadius: 18, backgroundColor: '#7c3aed', padding: 17 }, primaryButtonText: { color: 'white', fontSize: 17, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderRadius: 18, borderColor: '#6d6474', borderWidth: 1, padding: 15 }, secondaryButtonText: { color: '#f5f3f7', fontSize: 16, fontWeight: '600' },
  input: { minHeight: 92, borderRadius: 16, backgroundColor: '#211d28', color: '#fff', padding: 15, textAlignVertical: 'top' }, message: { color: '#a9a1b1', minHeight: 42 },
  homeRoot: { flex: 1, backgroundColor: Platform.OS === 'android' ? '#fffbfe' : '#f2f2f7' }, cameraRoot: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  scanGuide: { position: 'absolute', top: 80, left: 24, right: 24, alignItems: 'center', borderRadius: 18, backgroundColor: '#000b', padding: 16 }, scanText: { color: 'white', fontSize: 17, fontWeight: '600' },
  closeButton: { alignItems: 'center', borderRadius: 18, backgroundColor: '#7c3aed', padding: 17, marginBottom: 24 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' },
  composer: { gap: 16, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#fff', padding: 24, paddingBottom: 38 }, composerTitle: { fontSize: 22, fontWeight: '700' },
  composerInput: { minHeight: 130, borderRadius: 14, backgroundColor: '#f2eff5', padding: 14, textAlignVertical: 'top' }, composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 28 },
  link: { color: '#5b5362', fontSize: 17 }, linkStrong: { color: '#6d28d9', fontSize: 17, fontWeight: '700' },
  fileName: { fontSize: 17, fontWeight: '600' }, fileMeta: { color: '#6f6875', fontSize: 14 },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: '#e3dfe7', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#7c3aed' },
});
