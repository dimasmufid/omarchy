import { Button, Card, CircularProgressIndicator, Column, Host, OutlinedButton, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import type { ActionSurfaceProps } from './model';

export default function ActionSurface(props: ActionSurfaceProps) {
  const unavailable = props.busy || props.connection !== 'online';
  const wide = [fillMaxWidth()];
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <Column modifiers={[paddingAll(24)]} verticalArrangement={{ spacedBy: 16 }} horizontalAlignment="start">
        <Text style={{ typography: 'headlineLarge', fontWeight: 'bold' }}>{props.desktopName}</Text>
        <Text color="#756f7a">{props.connection === 'online' ? 'Online on your local network' : props.connection === 'checking' ? 'Checking connection…' : 'Desktop unavailable'}</Text>
        <Card modifiers={wide}>
          <Column modifiers={[paddingAll(16)]} verticalArrangement={{ spacedBy: 12 }} horizontalAlignment="start">
            {props.busy ? <CircularProgressIndicator /> : null}
            <Button enabled={!unavailable} onClick={props.onSendClipboard} modifiers={wide}><Text>Send clipboard</Text></Button>
            <Button enabled={!unavailable} onClick={props.onGetClipboard} modifiers={wide}><Text>Get desktop clipboard</Text></Button>
            <OutlinedButton enabled={!unavailable} onClick={props.onSendText} modifiers={wide}><Text>Send text or URL</Text></OutlinedButton>
            <OutlinedButton enabled={!unavailable} onClick={props.onSendFile} modifiers={wide}><Text>Send file</Text></OutlinedButton>
            <OutlinedButton enabled={!unavailable} onClick={props.onLock} modifiers={wide}><Text color="#ba1a1a">Lock desktop</Text></OutlinedButton>
          </Column>
        </Card>
        <Text style={{ typography: 'bodyMedium' }}>{props.message}</Text>
        <TextButton enabled={!props.busy} onClick={props.onRefresh}><Text>Check connection</Text></TextButton>
        <TextButton enabled={!props.busy} onClick={props.onForget}><Text color="#ba1a1a">Forget this desktop</Text></TextButton>
      </Column>
    </Host>
  );
}
