import { useState } from 'react';
import { Button, Host, ScrollView, Text, TextField, useNativeState, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';

import type { SettingsSurfaceProps } from './model';

export default function SettingsSurface(props: SettingsSurfaceProps) {
  const hostState = useNativeState(props.endpointHost);
  const portState = useNativeState(String(props.endpointPort));
  const [host, setHost] = useState(props.endpointHost);
  const [port, setPort] = useState(String(props.endpointPort));
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <ScrollView>
      <VStack alignment="leading" spacing={16} modifiers={[padding({ all: 24 }), frame({ maxWidth: 680 })]}>
        <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold', design: 'rounded' })]}>Settings</Text>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{props.desktopName}</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {props.connection === 'online' ? 'Online now' : `Last seen ${props.lastSeen}`}
        </Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>Identity {props.desktopId}</Text>
        <Text modifiers={[font({ textStyle: 'headline' })]}>Local network</Text>
        <Text>Omarchy Mobile connects directly to this desktop. If discovery is blocked, allow Local Network access in system Settings.</Text>
        <Button label="Open system Settings" systemImage="gear" onPress={props.onOpenSystemSettings} modifiers={[buttonStyle('glass'), controlSize('large')]} />
        <Text modifiers={[font({ textStyle: 'headline' })]}>Direct address fallback</Text>
        <Text>Use this only when mDNS discovery is blocked. The saved certificate and desktop identity are still verified.</Text>
        <TextField text={hostState} placeholder="Hostname or IP address" onTextChange={setHost} />
        <TextField text={portState} placeholder="Port" maxLength={5} onTextChange={setPort} />
        <Button
          label={props.endpointSaving ? 'Verifying…' : 'Verify and save address'}
          systemImage="network"
          onPress={() => props.onSaveEndpoint(host, port)}
          modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(props.endpointSaving)]}
        />
        {props.endpointMessage ? <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{props.endpointMessage}</Text> : null}
        <Text modifiers={[font({ textStyle: 'headline' })]}>Privacy</Text>
        <Text>No account, cloud relay, analytics, clipboard history, or automatic file opening. Shared content stays between this phone and your desktop.</Text>
        <Text modifiers={[font({ textStyle: 'headline' })]}>Diagnostics</Text>
        <Text>Protocol 1 · foreground LAN · certificate pinned · one paired desktop</Text>
        <Button label="Forget this desktop" role="destructive" onPress={props.onForget} modifiers={[buttonStyle('bordered'), controlSize('large')]} />
        <Button label="Done" systemImage="checkmark" onPress={props.onClose} modifiers={[buttonStyle('glassProminent'), controlSize('large')]} />
      </VStack>
      </ScrollView>
    </Host>
  );
}
