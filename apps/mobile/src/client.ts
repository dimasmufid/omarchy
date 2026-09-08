import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { discoverDesktops, pinnedRequest, pinnedUpload } from '../modules/omarchy-link/src/OmarchyLinkModule';
import type { PairingCode, PairedDesktop } from './model';

type Status = { desktopName: string; desktopId: string; serverTime: string };
type Operation = { completed: boolean; message: string; operationId: string };

type DesktopEndpoint = Omit<PairingCode, 'secret'>;

function baseUrl(pairing: DesktopEndpoint): string {
  const host = pairing.host.includes(':') ? `[${pairing.host}]` : pairing.host;
  return `https://${host}:${pairing.port}`;
}

async function request<T>(
  pairing: DesktopEndpoint,
  path: string,
  method: 'GET' | 'POST',
  token?: string,
  body?: unknown,
): Promise<T> {
  const response = await pinnedRequest({
    url: `${baseUrl(pairing)}${path}`,
    method,
    fingerprint: pairing.fingerprint,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    timeoutMs: path === '/v1/pair/request' ? 300_000 : 15_000,
  });
  const parsed = response.body ? JSON.parse(response.body) : {};
  if (response.status < 200 || response.status >= 300) {
    throw new Error(parsed?.error?.message ?? `Desktop returned ${response.status}.`);
  }
  return parsed as T;
}

export async function pairDesktop(code: PairingCode, deviceId: string): Promise<PairedDesktop> {
  const result = await request<{ clientToken: string; desktopName: string }>(
    code,
    '/v1/pair/request',
    'POST',
    undefined,
    {
      secret: code.secret,
      deviceId,
      deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android phone',
      platform: Platform.OS,
      appVersion: '1.0.0',
    },
  );
  const { secret: _usedSecret, ...identity } = code;
  return { ...identity, desktopName: result.desktopName, clientToken: result.clientToken, deviceId };
}

export async function rediscoverDesktop(desktop: PairedDesktop): Promise<PairedDesktop | null> {
  const discovered = (await discoverDesktops(2_000)).find((candidate) => candidate.id === desktop.desktopId);
  if (!discovered) return null;
  return { ...desktop, host: discovered.host, port: discovered.port, desktopName: discovered.name };
}

export const getStatus = (desktop: PairedDesktop) =>
  request<Status>(desktop, '/v1/status', 'GET', desktop.clientToken);

export const sendClipboard = (desktop: PairedDesktop, text: string) =>
  request<Operation>(desktop, '/v1/clipboard', 'POST', desktop.clientToken, { text });

export const getClipboard = (desktop: PairedDesktop) =>
  request<{ text: string }>(desktop, '/v1/clipboard', 'GET', desktop.clientToken);

export const sendText = (desktop: PairedDesktop, text: string) =>
  request<Operation>(desktop, '/v1/inbox/text', 'POST', desktop.clientToken, {
    text,
    contentType: /^https?:\/\//i.test(text.trim()) ? 'url' : 'text',
  });

export const lockDesktop = (desktop: PairedDesktop) =>
  request<Operation>(desktop, '/v1/actions/lock', 'POST', desktop.clientToken, {
    idempotencyKey: Crypto.randomUUID(),
  });

export async function sendFile(
  desktop: PairedDesktop,
  asset: { uri: string; name: string; size?: number; mimeType?: string },
): Promise<Operation> {
  const file = new File(asset.uri);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Choose a file up to 25 MiB.');
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = await pinnedUpload({
    url: `${baseUrl(desktop)}/v1/inbox/file`,
    method: 'POST',
    fingerprint: desktop.fingerprint,
    fileUri: asset.uri,
    timeoutMs: 300_000,
    headers: {
      Authorization: `Bearer ${desktop.clientToken}`,
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'X-Omarchy-Filename': asset.name,
      'X-Omarchy-Sha256': sha256,
    },
  });
  const parsed = response.body ? JSON.parse(response.body) : {};
  if (response.status < 200 || response.status >= 300) {
    throw new Error(parsed?.error?.message ?? `Desktop returned ${response.status}.`);
  }
  return parsed as Operation;
}
