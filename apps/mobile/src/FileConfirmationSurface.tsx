import { Button, StyleSheet, Text, View } from 'react-native';

import type { FileConfirmationSurfaceProps } from './model';

export default function FileConfirmationSurface(props: FileConfirmationSurfaceProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{props.title}</Text>
      <Text>{props.fileName}</Text>
      <Text>{props.fileMeta}</Text>
      {props.progressLabel ? <Text>{props.progressLabel}</Text> : null}
      <Button title={props.transferring ? 'Cancel transfer' : 'Cancel'} onPress={props.onCancel} />
      {!props.transferring ? <Button title="Send" onPress={props.onSend} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: 18, padding: 24 },
  title: { fontSize: 24, fontWeight: '700' },
});
