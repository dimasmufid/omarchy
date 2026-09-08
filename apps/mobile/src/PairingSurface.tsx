import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PairingSurfaceProps } from './model';

export default function PairingSurface(props: PairingSurfaceProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>OWN YOUR CONNECTION</Text>
      <Text style={styles.hero}>Your Omarchy, in your pocket.</Text>
      <Text>Run `omarchy-mobile pair`, then scan its QR code. Nothing leaves your local network.</Text>
      <Button title="Scan pairing code" disabled={props.busy} onPress={props.onScan} />
      <TextInput multiline placeholder="Or paste omarchy://pair…" value={props.manualCode} onChangeText={props.onManualCodeChange} />
      <Button title={props.busy ? 'Waiting for desktop…' : 'Pair with pasted code'} disabled={props.busy || !props.manualCode.trim()} onPress={props.onPair} />
      <Text>{props.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: 18, padding: 28 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  hero: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
});
