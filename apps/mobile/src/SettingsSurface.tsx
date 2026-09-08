import { Button, StyleSheet, Text, View } from 'react-native';

import type { SettingsSurfaceProps } from './model';

export default function SettingsSurface(props: SettingsSurfaceProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Settings</Text>
      <Text>{props.desktopName}</Text>
      <Text>{props.connection === 'online' ? 'Online now' : `Last seen ${props.lastSeen}`}</Text>
      <Text>Identity {props.desktopId}</Text>
      <Text>No account or cloud relay. Core features stay on your local network.</Text>
      <Button title="Open system Settings" onPress={props.onOpenSystemSettings} />
      <Text>Direct address: {props.endpointHost}:{props.endpointPort}</Text>
      <Button title="Forget this desktop" color="#ba1a1a" onPress={props.onForget} />
      <Button title="Done" onPress={props.onClose} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, gap: 16, padding: 24 }, title: { fontSize: 32, fontWeight: '700' } });
