import { afterEach, describe, expect, it, vi } from 'vitest';
import dns from 'node:dns';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import { assertSafeUrl, createSafeFetch, isBlockedIp, SafeFetchError } from '@/lib/security/safe-fetch';

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1', '127.1.2.3', '0.0.0.0', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1', '100.127.255.255', '192.0.0.1', '198.18.0.1',
    '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:10.0.0.1', '::ffff:a00:1', '::ffff:127.0.0.1', '::ffff:169.254.169.254',
    'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', 'ff02::1', '64:ff9b::a00:1', '64:ff9b::7f00:1',
    '2002:a00:1::1', '2002:7f00:1::', '2001::1', '2001:db8::1', '100::1', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each([
    '8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.0.1',
    '::ffff:8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4009:81f::200e', '64:ff9b::808:808', '2002:808:808::1',
  ])('allows %s', (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe('assertSafeUrl', () => {
  it.each([
    'http://localhost/', 'http://LOCALHOST./', 'http://app.localhost/', 'http://printer.local/', 'http://metadata.google.internal/',
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0x7f.1/', 'http://017700000001/', 'http://127.1/', 'http://0/',
    'http://10.1.2.3/', 'http://169.254.169.254/latest/meta-data/', 'http://2852039166/', 'http://100.64.0.1/',
    'http://[::1]/', 'http://[::ffff:10.0.0.1]/', 'http://[fc00::1]/', 'http://[fd00::1]:8080/', 'http://[fe80::1]/',
    'http://user:pass@example.com/', 'ftp://example.com/', 'file:///etc/passwd', 'gopher://example.com/',
  ])('rejects %s', (u) => expect(() => assertSafeUrl(u)).toThrow(SafeFetchError));

  it('accepts ordinary public URLs', () => {
    expect(assertSafeUrl('https://example.com/menu?x=1').hostname).toBe('example.com');
    expect(assertSafeUrl('http://8.8.8.8/').hostname).toBe('8.8.8.8');
  });
});

// Local servers on two loopback addresses stand in for "a public host" (127.0.0.1)
// and "an internal host" (127.0.0.2) by injecting a predicate that only blocks 127.0.0.2.
const testFetch = createSafeFetch({ isBlockedIp: (ip) => ip === '127.0.0.2' });

function listen(host: string, handler: http.RequestListener) {
  const hits = { n: 0 };
  const server = http.createServer((req, res) => { hits.n++; handler(req, res); });
  return new Promise<{ port: number; hits: { n: number }; close: () => void }>((resolve) =>
    server.listen(0, host, () => resolve({ port: (server.address() as AddressInfo).port, hits, close: () => server.close() })));
}

describe('safeFetch', () => {
  const closers: Array<() => void> = [];
  afterEach(() => { closers.splice(0).forEach((c) => c()); vi.restoreAllMocks(); });

  it('fetches a normal page', async () => {
    const s = await listen('127.0.0.1', (_q, r) => { r.setHeader('content-type', 'text/html'); r.end('<title>hi</title>'); });
    closers.push(s.close);
    const r = await testFetch(`http://127.0.0.1:${s.port}/`);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('<title>hi</title>');
    expect(r.contentType).toBe('text/html');
  });

  it('refuses to follow a redirect to an internal host, and never contacts it', async () => {
    const internal = await listen('127.0.0.2', (_q, r) => r.end('secret'));
    const pub = await listen('127.0.0.1', (_q, r) => { r.statusCode = 302; r.setHeader('location', `http://127.0.0.2:${internal.port}/`); r.end(); });
    closers.push(internal.close, pub.close);
    await expect(testFetch(`http://127.0.0.1:${pub.port}/`)).rejects.toMatchObject({ code: 'BLOCKED' });
    expect(internal.hits.n).toBe(0);
  });

  it('re-validates every hop, including a later one and a non-http scheme', async () => {
    const pub = await listen('127.0.0.1', (q, r) => {
      r.statusCode = 302;
      r.setHeader('location', q.url === '/a' ? '/b' : 'file:///etc/passwd');
      r.end();
    });
    closers.push(pub.close);
    await expect(testFetch(`http://127.0.0.1:${pub.port}/a`)).rejects.toBeInstanceOf(SafeFetchError);
  });

  it('follows safe redirects and reports the final URL', async () => {
    const pub = await listen('127.0.0.1', (q, r) => {
      if (q.url === '/start') { r.statusCode = 301; r.setHeader('location', '/final'); r.end(); } else r.end('ok');
    });
    closers.push(pub.close);
    const r = await testFetch(`http://127.0.0.1:${pub.port}/start`);
    expect(r.url).toBe(`http://127.0.0.1:${pub.port}/final`);
    expect(r.text).toBe('ok');
  });

  it('gives up on redirect loops', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => { r.statusCode = 302; r.setHeader('location', '/'); r.end(); });
    closers.push(pub.close);
    await expect(testFetch(`http://127.0.0.1:${pub.port}/`)).rejects.toMatchObject({ code: 'REDIRECTS' });
  });

  it('caps the body size', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => { r.write('a'.repeat(5_000_000)); r.end(); });
    closers.push(pub.close);
    const r = await testFetch(`http://127.0.0.1:${pub.port}/`, { maxBytes: 1000 });
    expect(r.text.length).toBe(1000);
    expect(r.truncated).toBe(true);
  });

  it('caps the DECOMPRESSED size (gzip bomb)', async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(50_000_000, 0x61));
    const pub = await listen('127.0.0.1', (_q, r) => { r.setHeader('content-encoding', 'gzip'); r.end(bomb); });
    closers.push(pub.close);
    const r = await testFetch(`http://127.0.0.1:${pub.port}/`, { maxBytes: 10_000 });
    expect(r.text.length).toBe(10_000);
    expect(r.truncated).toBe(true);
  });

  it('decompresses normal gzip responses', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => { r.setHeader('content-encoding', 'gzip'); r.end(zlib.gzipSync('hello world')); });
    closers.push(pub.close);
    expect((await testFetch(`http://127.0.0.1:${pub.port}/`)).text).toBe('hello world');
  });

  it('enforces the total timeout', async () => {
    const pub = await listen('127.0.0.1', () => { /* never respond */ });
    closers.push(pub.close);
    await expect(testFetch(`http://127.0.0.1:${pub.port}/`, { timeoutMs: 300 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('readBody:false returns status and headers only', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => { r.setHeader('content-type', 'image/png'); r.end('x'.repeat(1000)); });
    closers.push(pub.close);
    const r = await testFetch(`http://127.0.0.1:${pub.port}/`, { readBody: false });
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe('image/png');
    expect(r.text).toBe('');
  });

  // DNS: a public-looking name that resolves to an internal address (the
  // "public domain pointing at 169.254.169.254 / 10.x" case, and DNS rebinding).
  it('blocks hostnames that resolve to a blocked address, without connecting', async () => {
    const internal = await listen('127.0.0.2', (_q, r) => r.end('secret'));
    closers.push(internal.close);
    vi.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: '127.0.0.2', family: 4 }])) as unknown as typeof dns.lookup);
    await expect(testFetch(`http://rebind.example:${internal.port}/`)).rejects.toMatchObject({ code: 'BLOCKED' });
    expect(internal.hits.n).toBe(0);
  });

  it('blocks when ANY resolved address is blocked (mixed public + private records)', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => r.end('ok'));
    closers.push(pub.close);
    vi.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }, { address: '127.0.0.2', family: 4 }])) as unknown as typeof dns.lookup);
    await expect(testFetch(`http://mixed.example:${pub.port}/`)).rejects.toMatchObject({ code: 'BLOCKED' });
    expect(pub.hits.n).toBe(0);
  });

  it('connects to the validated address when a hostname resolves to an allowed one', async () => {
    const pub = await listen('127.0.0.1', (_q, r) => r.end('via-dns'));
    closers.push(pub.close);
    vi.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }])) as unknown as typeof dns.lookup);
    expect((await testFetch(`http://ok.example:${pub.port}/`)).text).toBe('via-dns');
  });
});

describe('default safeFetch (real rules)', () => {
  it('refuses loopback and metadata addresses outright', async () => {
    const { safeFetch } = await import('@/lib/security/safe-fetch');
    await expect(safeFetch('http://127.0.0.1:1/')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(safeFetch('http://[::ffff:10.0.0.1]/')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(safeFetch('http://localhost:3000/')).rejects.toMatchObject({ code: 'BLOCKED' });
  });
});
