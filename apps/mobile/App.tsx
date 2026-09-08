import { useEffect, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';

import ActionSurface from './src/ActionSurface';
import { getClipboard, getStatus, lockDesktop, pairDesktop, sendClipboard, sendFile, sendText } from './src/client';
import type { ConnectionState, PairedDesktop } from './src/model';
import { parsePairingCode } from './src/model';
import { clearPairing, loadPairing, savePairing } from './src/storage';

export default function App() {
  const [desktop, setDesktop] = useState<PairedDesktop | null>();
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [sharedText, setSharedText] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    loadPairing().then(setDesktop).catch((error) => {
      setMessage(errorMessage(error));
      setDesktop(null);
    });
  }, []);

  const refresh = async (paired = desktop) => {
    if (!paired) return;
    setConnection('checking');
    try {
      await getStatus(paired);
      setConnection('online');
      setMessage('Connected directly over your local network.');
    } catch (error) {
      setConnection('offline');
      setMessage(errorMessage(error));
    }
  };

  useEffect(() => { if (desktop) void refresh(desktop); }, [desktop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && desktop) void refresh(desktop);
    });
    return () => subscription.remove();
  }, [desktop]);

  const run = async (operation: () => Promise<{ message?: string }>, success?: string) => {
    setBusy(true);
    try {
      const result = await operation();
      setConnection('online');
      setMessage(result.message ?? success ?? 'Done');
    } catch (error) {
      setMessage(errorMessage(error));
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
        onSendClipboard={() => void run(async () => sendClipboard(desktop, await Clipboard.getStringAsync()))}
        onGetClipboard={() => void run(async () => {
          const result = await getClipboard(desktop);
          await Clipboard.setStringAsync(result.text);
          return { message: result.text ? 'Desktop clipboard copied to your phone.' : 'Desktop clipboard is empty.' };
        })}
        onSendText={() => setComposerOpen(true)}
        onSendFile={() => void run(async () => {
          const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
          if (result.canceled) return { message: 'File selection canceled.' };
          return sendFile(desktop, result.assets[0]);
        })}
        onLock={() => Alert.alert('Lock your desktop?', `This will immediately lock ${desktop.desktopName}.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Lock', style: 'destructive', onPress: () => void run(() => lockDesktop(desktop)) },
        ])}
        onForget={() => Alert.alert('Forget this desktop?', 'You will need to pair again. Revoke this phone on the desktop too.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Forget', style: 'destructive', onPress: () => void clearPairing().then(() => setDesktop(null)) },
        ])}
      />
      <Modal visible={composerOpen} transparent animationType="fade" onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>Send text or URL</Text>
            <TextInput autoFocus multiline placeholder="What should appear in Omarchy Inbox?" style={styles.composerInput} value={sharedText} onChangeText={setSharedText} />
            <View style={styles.composerActions}>
              <Pressable onPress={() => setComposerOpen(false)}><Text style={styles.link}>Cancel</Text></Pressable>
              <Pressable onPress={() => {
                const value = sharedText.trim();
                if (!value) return;
                setComposerOpen(false); setSharedText(''); void run(() => sendText(desktop, value));
              }}><Text style={styles.linkStrong}>Send</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
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
});
