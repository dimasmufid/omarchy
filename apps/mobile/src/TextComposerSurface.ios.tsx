import { useState } from 'react';
import { Button, Host, Spacer, Text, TextField, useNativeState, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, font, frame, padding } from '@expo/ui/swift-ui/modifiers';

import type { TextComposerSurfaceProps } from './model';

export default function TextComposerSurface(props: TextComposerSurfaceProps) {
  const valueState = useNativeState(props.value);
  const [value, setValue] = useState(props.value);
  const updateValue = (next: string) => {
    setValue(next);
    props.onValueChange(next);
  };
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <VStack alignment="leading" spacing={18} modifiers={[padding({ all: 24 }), frame({ maxWidth: 680 })]}>
        <Spacer />
        <Text modifiers={[font({ textStyle: 'title', weight: 'bold', design: 'rounded' })]}>Send text or URL</Text>
        <TextField autoFocus text={valueState} axis="vertical" maxLength={65_536} placeholder="What should appear in Omarchy Inbox?" onTextChange={updateValue} />
        <Button label="Send" systemImage="arrow.up.circle.fill" onPress={props.onSend} modifiers={[buttonStyle('glassProminent'), controlSize('large'), disabled(!value.trim())]} />
        <Button label="Cancel" role="cancel" onPress={props.onCancel} modifiers={[buttonStyle('glass'), controlSize('large')]} />
        <Spacer />
      </VStack>
    </Host>
  );
}
