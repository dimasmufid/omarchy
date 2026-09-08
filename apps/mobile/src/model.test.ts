import { describe, expect, it } from 'vitest';

import { parseManualEndpoint, parsePairingCode } from './model';

const validCode = new URL('omarchy://pair');
validCode.search = new URLSearchParams({
  v: '1',
  desktop: `desk_${'a'.repeat(32)}`,
  name: 'Omarchy Desktop',
  secret: 's'.repeat(43),
  fp: 'f'.repeat(43),
  host: '192.168.1.20',
  port: '42783',
}).toString();

describe('parsePairingCode', () => {
  it('accepts the bounded Phase 1 pairing URI', () => {
    expect(parsePairingCode(validCode.toString())).toMatchObject({
      desktopId: `desk_${'a'.repeat(32)}`,
      desktopName: 'Omarchy Desktop',
      host: '192.168.1.20',
      port: 42783,
    });
  });

  it.each([
    ['wrong scheme', 'https://pair?v=1'],
    ['unsupported version', validCode.toString().replace('v=1', 'v=2')],
    ['short secret', validCode.toString().replace(`secret=${'s'.repeat(43)}`, 'secret=short')],
    ['bad fingerprint', validCode.toString().replace(`fp=${'f'.repeat(43)}`, 'fp=not-a-fingerprint')],
    ['path-like host', validCode.toString().replace('host=192.168.1.20', 'host=desktop%2Flocal')],
  ])('rejects %s', (_label, value) => {
    expect(() => parsePairingCode(value)).toThrow();
  });

  it('rejects oversized input before URL parsing', () => {
    expect(() => parsePairingCode(`omarchy://pair?${'x'.repeat(2048)}`)).toThrow(/too large/i);
  });
});

describe('parseManualEndpoint', () => {
  it('normalizes a bracketed IPv6 address', () => {
    expect(parseManualEndpoint('[fd00::20]', '42783')).toEqual({ ok: true, host: 'fd00::20', port: 42783 });
  });

  it.each([
    ['https://desktop.local', '42783'],
    ['desktop.local/path', '42783'],
    ['desktop.local?override=true', '42783'],
    ['[fd00::20', '42783'],
    ['desktop.local', '0'],
    ['desktop.local', '65536'],
    ['', '42783'],
  ])('rejects an unsafe endpoint', (host, port) => {
    expect(parseManualEndpoint(host, port).ok).toBe(false);
  });
});
