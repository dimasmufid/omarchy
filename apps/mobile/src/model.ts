export type PairingCode = {
  desktopId: string;
  desktopName: string;
  secret: string;
  fingerprint: string;
  host: string;
  port: number;
};

export type PairedDesktop = Omit<PairingCode, 'secret'> & {
  clientToken: string;
  deviceId: string;
};

export type ConnectionState = 'checking' | 'online' | 'offline';

export type ActionSurfaceProps = {
  desktopName: string;
  connection: ConnectionState;
  busy: boolean;
  message: string;
  onSendClipboard: () => void;
  onGetClipboard: () => void;
  onSendText: () => void;
  onSendFile: () => void;
  onLock: () => void;
  onRefresh: () => void;
  onForget: () => void;
};

export function parsePairingCode(value: string): PairingCode {
  const url = new URL(value.trim());
  if (url.protocol !== 'omarchy:' || url.hostname !== 'pair') {
    throw new Error('This is not an Omarchy pairing code.');
  }
  if (url.searchParams.get('v') !== '1') {
    throw new Error('This pairing code uses an unsupported protocol version.');
  }
  const required = (name: string) => {
    const result = url.searchParams.get(name);
    if (!result) throw new Error(`The pairing code is missing ${name}.`);
    return result;
  };
  const port = Number(required('port'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('The pairing code contains an invalid port.');
  }
  return {
    desktopId: required('desktop'),
    desktopName: required('name'),
    secret: required('secret'),
    fingerprint: required('fp'),
    host: required('host'),
    port,
  };
}
