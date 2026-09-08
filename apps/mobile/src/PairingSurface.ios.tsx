import { useState } from 'react';
import { Button, Host, ScrollView, Text, TextField, useNativeState, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, environment, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';

import type { PairingSurfaceProps } from './model';

export default function PairingSurface(props: PairingSurfaceProps) {
  const codeState = useNativeState(props.manualCode);
  const [code, setCode] = useState(props.manualCode);
  const updateCode = (value: string) => {
    setCode(value);
    props.onManualCodeChange(value);
  };
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <ScrollView>
      <VStack alignment="leading" spacing={18} modifiers={[environment('colorScheme', 'dark'), padding({ all: 28 }), frame({ maxWidth: 680 })]}>
        <Text modifiers={[foregroundStyle('#a78bfa'), font({ textStyle: 'caption', weight: 'bold' })]}>OWN YOUR CONNECTION</Text>
        <Text modifiers={[foregroundStyle('#fafafa'), font({ textStyle: 'largeTitle', weight: 'bold', design: 'rounded' })]}>Your Omarchy, in your pocket.</Text>
        <Text modifiers={[foregroundStyle('#c4becb'), font({ textStyle: 'body' })]}>Run `omarchy-mobile pair`, then scan its QR code. Nothing leaves your local network.</Text>
        <Button
          label="Scan pairing code"
          systemImage="qrcode.viewfinder"
          onPress={props.onScan}
          modifiers={[buttonStyle('glassProminent'), controlSize('large'), disabled(props.busy)]}
        />
        <TextField text={codeState} axis="vertical" maxLength={2048} placeholder="Or paste omarchy://pair…" onTextChange={updateCode} />
        <Button
          label={props.busy ? 'Waiting for desktop…' : 'Pair with pasted code'}
          systemImage="link"
          onPress={props.onPair}
          modifiers={[buttonStyle('glass'), controlSize('large'), disabled(props.busy || !code.trim())]}
        />
        <Text modifiers={[foregroundStyle('#a9a1b1'), font({ textStyle: 'callout' })]}>{props.message}</Text>
      </VStack>
      </ScrollView>
    </Host>
  );
}
