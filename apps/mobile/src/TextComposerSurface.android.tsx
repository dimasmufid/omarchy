import { useState } from 'react';
import { Button, Column, Host, OutlinedButton, OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import type { TextComposerSurfaceProps } from './model';

export default function TextComposerSurface(props: TextComposerSurfaceProps) {
  const valueState = useNativeState(props.value);
  const [value, setValue] = useState(props.value);
  const updateValue = (next: string) => {
    setValue(next);
    props.onValueChange(next);
  };
  const wide = [fillMaxWidth()];
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <Column modifiers={[fillMaxSize(), paddingAll(24)]} verticalArrangement={{ spacedBy: 18 }} horizontalAlignment="start">
        <Text style={{ typography: 'headlineLarge', fontWeight: 'bold' }}>Send text or URL</Text>
        <OutlinedTextField autoFocus value={valueState} minLines={5} maxLines={12} maxLength={65_536} onValueChange={updateValue} modifiers={wide}>
          <OutlinedTextField.Label><Text>Omarchy Inbox content</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <Button enabled={Boolean(value.trim())} onClick={props.onSend} modifiers={wide}><Text>Send</Text></Button>
        <OutlinedButton onClick={props.onCancel} modifiers={wide}><Text>Cancel</Text></OutlinedButton>
      </Column>
    </Host>
  );
}
