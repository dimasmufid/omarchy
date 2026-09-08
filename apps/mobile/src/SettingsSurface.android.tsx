import { Button, Card, Column, Host, OutlinedButton, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import type { SettingsSurfaceProps } from './model';

export default function SettingsSurface(props: SettingsSurfaceProps) {
  const wide = [fillMaxWidth()];
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <Column modifiers={[paddingAll(24)]} verticalArrangement={{ spacedBy: 14 }} horizontalAlignment="start">
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
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Privacy</Text>
        <Text>No account, cloud relay, analytics, clipboard history, or automatic file opening. Shared content stays between this phone and your desktop.</Text>
        <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>Diagnostics</Text>
        <Text>Protocol 1 · foreground LAN · certificate pinned · one paired desktop</Text>
        <TextButton onClick={props.onForget}><Text color="#ba1a1a">Forget this desktop</Text></TextButton>
        <Button onClick={props.onClose} modifiers={wide}><Text>Done</Text></Button>
      </Column>
    </Host>
  );
}
