import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import type { TextComposerSurfaceProps } from './model';

export default function TextComposerSurface(props: TextComposerSurfaceProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Send text or URL</Text>
      <TextInput autoFocus multiline placeholder="What should appear in Omarchy Inbox?" value={props.value} onChangeText={props.onValueChange} />
      <Button title="Cancel" onPress={props.onCancel} />
      <Button title="Send" disabled={!props.value.trim()} onPress={props.onSend} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: 18, padding: 24 },
  title: { fontSize: 24, fontWeight: '700' },
});
