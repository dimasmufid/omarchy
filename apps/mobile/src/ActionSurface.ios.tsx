import { Button, Host, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import type { ActionSurfaceProps } from './model';

export default function ActionSurface(props: ActionSurfaceProps) {
  const unavailable = props.busy || props.connection !== 'online';
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <VStack alignment="leading" spacing={18} modifiers={[padding({ all: 24 }), frame({ maxWidth: 680 })]}>
        <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold', design: 'rounded' })]}>
          {props.desktopName}
        </Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {props.connection === 'online' ? 'Online on your local network' : props.connection === 'checking' ? 'Checking connection…' : 'Desktop unavailable'}
        </Text>
        {props.busy ? <ProgressView><Text>Working…</Text></ProgressView> : null}
        <Button label="Send clipboard" systemImage="doc.on.clipboard" onPress={props.onSendClipboard} modifiers={[buttonStyle('glassProminent'), controlSize('large'), disabled(unavailable)]} />
        <Button label="Get desktop clipboard" systemImage="clipboard" onPress={props.onGetClipboard} modifiers={[buttonStyle('glass'), controlSize('large'), disabled(unavailable)]} />
        <Button label="Send text or URL" systemImage="text.bubble" onPress={props.onSendText} modifiers={[buttonStyle('glass'), controlSize('large'), disabled(unavailable)]} />
        <Button label="Send file" systemImage="document.badge.arrow.up" onPress={props.onSendFile} modifiers={[buttonStyle('glass'), controlSize('large'), disabled(unavailable)]} />
        <Button label="Lock desktop" systemImage="lock" role="destructive" onPress={props.onLock} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(unavailable)]} />
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{props.message}</Text>
        <Spacer />
        <Button label="Check connection" systemImage="arrow.clockwise" onPress={props.onRefresh} modifiers={[buttonStyle('borderless'), disabled(props.busy)]} />
        <Button label="Forget this desktop" role="destructive" onPress={props.onForget} modifiers={[buttonStyle('borderless'), disabled(props.busy)]} />
      </VStack>
    </Host>
  );
}
