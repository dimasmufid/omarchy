import { Button, Host, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';

import type { FileConfirmationSurfaceProps } from './model';

export default function FileConfirmationSurface(props: FileConfirmationSurfaceProps) {
  return (
    <Host style={{ flex: 1 }} seedColor="#7c3aed" useViewportSizeMeasurement>
      <VStack alignment="leading" spacing={18} modifiers={[padding({ all: 24 }), frame({ maxWidth: 680 })]}>
        <Spacer />
        <Text modifiers={[font({ textStyle: 'title', weight: 'bold', design: 'rounded' })]}>{props.title}</Text>
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{props.fileName}</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{props.fileMeta}</Text>
        {props.transferring ? (
          <ProgressView value={props.progress}>
            <Text>{props.progressLabel || 'Preparing secure transfer…'}</Text>
          </ProgressView>
        ) : null}
        {!props.transferring ? <Button label="Send" systemImage="arrow.up.circle.fill" onPress={props.onSend} modifiers={[buttonStyle('glassProminent'), controlSize('large')]} /> : null}
        <Button label={props.transferring ? 'Cancel transfer' : 'Cancel'} role="cancel" onPress={props.onCancel} modifiers={[buttonStyle('glass'), controlSize('large')]} />
        <Spacer />
      </VStack>
    </Host>
  );
}
