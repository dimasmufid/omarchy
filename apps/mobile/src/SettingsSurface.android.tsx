import { useState } from 'react';
import { Button, Card, Column, Host, LazyColumn, OutlinedButton, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import type { SettingsSurfaceProps } from './model';

export default function SettingsSurface(props: SettingsSurfaceProps) {
  const wide = [fillMaxWidth()];
  const hostState = useNativeState(props.endpointHost);
  const portState = useNativeState(String(props.endpointPort));
  const [host, setHost] = useState(props.endpointHost);
  const [port, setPort] = useState(String(props.endpointPort));
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <LazyColumn contentPadding={{ start: 24, top: 24, end: 24, bottom: 24 }} verticalArrangement={{ spacedBy: 14 }} horizontalAlignment="start">
        <Text style={{ typography: 'headlineLarge', fontWeight: 'bold' }}>Settings</Text>
        <Card modifiers={wide}>
          <Column modifiers={[paddingAll(16)]} verticalArrangement={{ spacedBy: 8 }} horizontalAlignment="start">
            <Text style={{ typography: 'titleLarge', fontWeight: 'bold' }}>{props.desktopName}</Text>
            <Text>{props.connection === 'online' ? 'Online now' : `Last seen ${props.lastSeen}`}</Text>
            <Text color="#756f7a">Identity {props.desktopId}</Text>
          </Column>
        </Card>
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Local network</Text>
        <Text>Omarchy Mobile connects directly to this desktop. If discovery is blocked, allow nearby network access in system Settings.</Text>
        <OutlinedButton onClick={props.onOpenSystemSettings} modifiers={wide}><Text>Open system Settings</Text></OutlinedButton>
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Direct address fallback</Text>
        <Text>Use this only when mDNS discovery is blocked. The saved certificate and desktop identity are still verified.</Text>
        <OutlinedTextField value={hostState} singleLine onValueChange={setHost} modifiers={wide} keyboardOptions={{ autoCorrectEnabled: false, keyboardType: 'uri' }}>
          <OutlinedTextField.Label><Text>Hostname or IP address</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <OutlinedTextField value={portState} singleLine maxLength={5} onValueChange={setPort} modifiers={wide} keyboardOptions={{ keyboardType: 'number' }}>
          <OutlinedTextField.Label><Text>Port</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <Button enabled={!props.endpointSaving} onClick={() => props.onSaveEndpoint(host, port)} modifiers={wide}><Text>{props.endpointSaving ? 'Verifying…' : 'Verify and save address'}</Text></Button>
        {props.endpointMessage ? <Text color="#756f7a">{props.endpointMessage}</Text> : null}
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Privacy</Text>
        <Text>No account, cloud relay, analytics, clipboard history, or automatic file opening. Shared content stays between this phone and your desktop.</Text>
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Diagnostics</Text>
        <Text>Protocol 1 · foreground LAN · certificate pinned · one paired desktop</Text>
        <TextButton onClick={props.onForget}><Text color="#ba1a1a">Forget this desktop</Text></TextButton>
        <Button onClick={props.onClose} modifiers={wide}><Text>Done</Text></Button>
      </LazyColumn>
    </Host>
  );
}
