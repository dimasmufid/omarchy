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
  lastSeenAt?: string;
};

export type ConnectionState = 'checking' | 'online' | 'offline';

export type PairingSurfaceProps = {
  busy: boolean;
  message: string;
  manualCode: string;
  onManualCodeChange: (value: string) => void;
  onPair: () => void;
  onScan: () => void;
};

export type FileConfirmationSurfaceProps = {
  title: string;
  fileName: string;
  fileMeta: string;
  progress: number;
  progressLabel: string;
  transferring: boolean;
  onCancel: () => void;
  onSend: () => void;
};

export type TextComposerSurfaceProps = {
  value: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
};

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
  onSettings: () => void;
};

export type SettingsSurfaceProps = {
  desktopName: string;
  desktopId: string;
  endpointHost: string;
  endpointPort: number;
  endpointMessage: string;
  endpointSaving: boolean;
  connection: ConnectionState;
  lastSeen: string;
  onSaveEndpoint: (host: string, port: string) => void;
  onOpenSystemSettings: () => void;
  onClose: () => void;
  onForget: () => void;
};

export function parsePairingCode(value: string): PairingCode {
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 2048) {
    throw new Error('The pairing code is empty or too large.');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('This is not a valid Omarchy pairing code.');
  }
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
  const desktopId = required('desktop');
  const desktopName = required('name').trim();
  const secret = required('secret');
  const fingerprint = required('fp');
  const host = normalizeHost(required('host'));
  if (!/^desk_[a-f0-9]{32}$/.test(desktopId)) {
    throw new Error('The pairing code contains an invalid desktop identity.');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new Error('The pairing code contains an invalid one-time secret.');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(fingerprint)) {
    throw new Error('The pairing code contains an invalid certificate fingerprint.');
  }
  if (!desktopName || utf8ByteLength(desktopName) > 63 || [...desktopName].some((character) => /[\u0000-\u001f\u007f]/.test(character))) {
    throw new Error('The pairing code contains an invalid desktop name.');
  }
  return {
    desktopId,
    desktopName,
    secret,
    fingerprint,
    host,
    port,
  };
}

export function parseManualEndpoint(hostValue: string, portValue: string):
  | { ok: true; host: string; port: number }
  | { ok: false; message: string } {
  let host: string;
  try {
    host = normalizeHost(hostValue);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Enter a valid hostname or IP address.' };
  }
  const port = Number(portValue.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: 'Enter a port from 1 to 65535.' };
  }
  return { ok: true, host, port };
}

function normalizeHost(value: string): string {
  const raw = value.trim();
  const hasOpeningBracket = raw.startsWith('[');
  const hasClosingBracket = raw.endsWith(']');
  if (hasOpeningBracket !== hasClosingBracket) {
    throw new Error('Enter a valid hostname or IP address.');
  }
  const host = hasOpeningBracket ? raw.slice(1, -1) : raw;
  if (!host || host.length > 253 || /\s|[/?#@]|:\/\/|[\[\]]|[\u0000-\u001f\u007f]/.test(host)) {
    throw new Error('Enter a hostname or IP address without https:// or a path.');
  }
  return host;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
