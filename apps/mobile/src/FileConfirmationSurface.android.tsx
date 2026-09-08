import { Button, Card, Column, Host, LinearProgressIndicator, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import type { FileConfirmationSurfaceProps } from './model';

export default function FileConfirmationSurface(props: FileConfirmationSurfaceProps) {
  const wide = [fillMaxWidth()];
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <Column modifiers={[fillMaxSize(), paddingAll(24)]} verticalArrangement={{ spacedBy: 18 }} horizontalAlignment="start">
        <Text style={{ typography: 'headlineLarge', fontWeight: 'bold' }}>{props.title}</Text>
        <Card modifiers={wide}>
          <Column modifiers={[paddingAll(16)]} verticalArrangement={{ spacedBy: 10 }} horizontalAlignment="start">
            <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>{props.fileName}</Text>
            <Text color="#756f7a">{props.fileMeta}</Text>
            {props.transferring ? <LinearProgressIndicator progress={props.progress} modifiers={wide} /> : null}
            {props.progressLabel ? <Text style={{ typography: 'bodyMedium' }}>{props.progressLabel}</Text> : null}
          </Column>
        </Card>
        {!props.transferring ? <Button onClick={props.onSend} modifiers={wide}><Text>Send</Text></Button> : null}
        <OutlinedButton onClick={props.onCancel} modifiers={wide}><Text>{props.transferring ? 'Cancel transfer' : 'Cancel'}</Text></OutlinedButton>
      </Column>
    </Host>
  );
}
