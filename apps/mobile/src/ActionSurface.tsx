import { Button, StyleSheet, Text, View } from 'react-native';

import type { ActionSurfaceProps } from './model';

export default function ActionSurface(props: ActionSurfaceProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{props.desktopName}</Text>
      <Text>{props.connection}</Text>
      <Button title="Send clipboard" onPress={props.onSendClipboard} />
      <Button title="Get desktop clipboard" onPress={props.onGetClipboard} />
      <Button title="Send text or URL" onPress={props.onSendText} />
      <Button title="Send file" onPress={props.onSendFile} />
      <Button title="Lock desktop" onPress={props.onLock} />
      <Text>{props.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, gap: 16, padding: 24 }, title: { fontSize: 32, fontWeight: '700' } });
