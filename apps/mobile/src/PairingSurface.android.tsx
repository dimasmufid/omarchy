import { useState } from 'react';
import { Button, Host, LazyColumn, OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import type { PairingSurfaceProps } from './model';

export default function PairingSurface(props: PairingSurfaceProps) {
  const codeState = useNativeState(props.manualCode);
  const [code, setCode] = useState(props.manualCode);
  const updateCode = (value: string) => {
    setCode(value);
    props.onManualCodeChange(value);
  };
  const wide = [fillMaxWidth()];
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <LazyColumn modifiers={[fillMaxSize()]} contentPadding={{ start: 28, top: 48, end: 28, bottom: 28 }} verticalArrangement={{ spacedBy: 18 }} horizontalAlignment="start">
        <Text color="#6d28d9" style={{ typography: 'labelMedium', fontWeight: 'bold' }}>OWN YOUR CONNECTION</Text>
        <Text style={{ typography: 'displaySmall', fontWeight: 'bold' }}>Your Omarchy, in your pocket.</Text>
        <Text style={{ typography: 'bodyLarge' }}>Run `omarchy-mobile pair`, then scan its QR code. Nothing leaves your local network.</Text>
        <Button enabled={!props.busy} onClick={props.onScan} modifiers={wide}><Text>Scan pairing code</Text></Button>
        <OutlinedTextField value={codeState} enabled={!props.busy} maxLines={4} maxLength={2048} onValueChange={updateCode} modifiers={wide} keyboardOptions={{ autoCorrectEnabled: false, keyboardType: 'uri' }}>
          <OutlinedTextField.Label><Text>Paste pairing code</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <Button enabled={!props.busy && Boolean(code.trim())} onClick={props.onPair} modifiers={wide}><Text>{props.busy ? 'Waiting for desktop…' : 'Pair with pasted code'}</Text></Button>
        <Text color="#756f7a" style={{ typography: 'bodyMedium' }}>{props.message}</Text>
      </LazyColumn>
    </Host>
  );
}
