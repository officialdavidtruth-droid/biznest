import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

/**
 * SSRF-safe HTTP(S) GET for fetching URLs that a user supplied (website
 * scanner, logo probes, ownership checks...). Server-side only (Node runtime).
 *
 * What it guarantees:
 *  - Only http/https, no embedded credentials.
 *  - Every address the target resolves to is checked, and the connection is
 *    made to exactly the address that was checked (the check lives in the
 *    socket's `lookup`, so there is no resolve-then-connect gap for DNS
 *    rebinding). If ANY resolved address is non-public, the request is refused.
 *  - IP literals are checked directly (the WHATWG URL parser already
 *    normalises decimal/hex/octal/short forms such as http://2130706433/ or
 *    http://0x7f.1/ to dotted quads, and IPv6 forms to canonical hex).
 *  - Blocked: loopback, private (RFC1918), CGNAT 100.64/10, link-local
 *    (169.254/16, fe80::/10), ULA fc00::/7, multicast/reserved, "this
 *    network", documentation/benchmark ranges, and IPv6 forms that embed an
 *    IPv4 address (::ffff:a.b.c.d, 64:ff9b::/96, 2002::/16), which are
 *    judged by the IPv4 address inside. IPv6 is allow-listed to 2000::/3.
 *  - Redirects are followed manually (max 5) and each hop is re-validated.
 *  - Total wall-clock timeout across all hops, and a hard cap on bytes read
 *    (applied after decompression, so gzip/brotli bombs are capped too).
 *  - Errors are generic so callers can't use messages as a port/host oracle.
 */

export type SafeFetchErrorCode = 'INVALID' | 'BLOCKED' | 'TIMEOUT' | 'NETWORK' | 'REDIRECTS';

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(message: string, code: SafeFetchErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SafeFetchError';
    this.code = code;
  }
}

const BLOCKED_MESSAGE = 'That website address cannot be scanned.';

// ---------------------------------------------------------------- IP checks

function parseIPv4(s: string): number[] | null {
  if (!net.isIPv4(s)) return null;
  return s.split('.').map(Number);
}

function parseIPv6(input: string): number[] | null {
  let s = input.split('%')[0];
  if (!net.isIPv6(s)) return null;
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    const n = parseInt(g, 16);
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function cidr4(spec: string): { net: number; mask: number } {
  const [ip, bits] = spec.split('/');
  const b = ip.split('.').map(Number);
  const base = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  const mask = Number(bits) === 0 ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
  return { net: (base & mask) >>> 0, mask };
}

const V4_BLOCKED = [
  '0.0.0.0/8',        // "this network"
  '10.0.0.0/8',       // private
  '100.64.0.0/10',    // carrier-grade NAT
  '127.0.0.0/8',      // loopback
  '169.254.0.0/16',   // link-local (cloud metadata lives at 169.254.169.254)
  '172.16.0.0/12',    // private
  '192.0.0.0/24',     // IETF protocol assignments
  '192.0.2.0/24',     // documentation
  '192.88.99.0/24',   // deprecated 6to4 relay
  '192.168.0.0/16',   // private
  '198.18.0.0/15',    // benchmarking
  '198.51.100.0/24',  // documentation
  '203.0.113.0/24',   // documentation
  '224.0.0.0/3',      // multicast + reserved + broadcast (224.0.0.0 - 255.255.255.255)
].map(cidr4);

function isBlockedIPv4(b: number[]): boolean {
  const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  return V4_BLOCKED.some((r) => ((n & r.mask) >>> 0) === r.net);
}

function isBlockedIPv6(b: number[]): boolean {
  // ::/96 covers "::", "::1" and deprecated IPv4-compatible addresses.
  if (b.slice(0, 12).every((x) => x === 0)) return true;
  // IPv4-mapped ::ffff:a.b.c.d -> judge by the embedded IPv4 address.
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) return isBlockedIPv4(b.slice(12));
  // NAT64 64:ff9b::/96 -> judge by the embedded IPv4 address.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every((x) => x === 0)) {
    return isBlockedIPv4(b.slice(12));
  }
  // Allow-list: only global unicast 2000::/3. Everything else (fc00::/7,
  // fe80::/10, ff00::/8, 100::/64, ...) is refused.
  if ((b[0] & 0xe0) !== 0x20) return true;
  // 6to4 2002::/16 embeds an IPv4 address in bytes 2-5.
  if (b[0] === 0x20 && b[1] === 0x02) return isBlockedIPv4(b.slice(2, 6));
  // 2001::/23 (IETF assignments incl. Teredo 2001::/32), 2001:db8::/32 (docs).
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] < 0x02) return true;
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true;
  // 3fff::/20 documentation.
  if (b[0] === 0x3f && b[1] === 0xff && (b[2] & 0xf0) === 0) return true;
  return false;
}

/** True if the address is not a public unicast address. Unparseable input is treated as blocked. */
export function isBlockedIp(ip: string): boolean {
  const s = ip.trim().replace(/^\[|\]$/g, '');
  const v4 = parseIPv4(s);
  if (v4) return isBlockedIPv4(v4);
  const v6 = parseIPv6(s);
  if (v6) return isBlockedIPv6(v6);
  return true;
}

// ----------------------------------------------------------------- URL check

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

function checkUrl(input: string | URL, blocked: (ip: string) => boolean): URL {
  let u: URL;
  try {
    u = new URL(typeof input === 'string' ? input : input.toString());
  } catch {
    throw new SafeFetchError('Enter a valid website URL.', 'INVALID');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SafeFetchError('Only HTTP and HTTPS websites are supported.', 'INVALID');
  }
  if (u.username || u.password) throw new SafeFetchError(BLOCKED_MESSAGE, 'BLOCKED');
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) throw new SafeFetchError('Enter a valid website URL.', 'INVALID');
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new SafeFetchError(BLOCKED_MESSAGE, 'BLOCKED');
  }
  if (net.isIP(host) && blocked(host)) {
    throw new SafeFetchError('Private network addresses cannot be scanned.', 'BLOCKED');
  }
  return u;
}

/**
 * Synchronous, string-level validation (protocol, credentials, hostname deny
 * list, IP literals in every notation). Does NOT resolve DNS; use safeFetch()
 * for anything that actually makes a request.
 */
export function assertSafeUrl(input: string | URL): URL {
  return checkUrl(input, isBlockedIp);
}

// ------------------------------------------------------------------- fetching

export type SafeFetchOptions = {
  headers?: Record<string, string>;
  /** Total wall-clock budget across all redirect hops. Default 15s. */
  timeoutMs?: number;
  /** Max bytes of (decompressed) body to read; the rest is dropped. Default 2 MB. */
  maxBytes?: number;
  /** Max redirect hops. Default 5. */
  maxRedirects?: number;
  /** Set false to read headers only (probes). Default true. */
  readBody?: boolean;
};

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  /** Final URL after redirects. */
  url: string;
  headers: Record<string, string>;
  contentType: string;
  text: string;
  truncated: boolean;
};

type RawResponse = { status: number; headers: Record<string, string>; body: Buffer; truncated: boolean };

function flattenHeaders(h: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

function requestOnce(
  url: URL,
  o: { headers: Record<string, string>; timeoutMs: number; maxBytes: number; readBody: boolean; lookup: LookupFunction },
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      req.destroy(new SafeFetchError('The website took too long to respond.', 'TIMEOUT'));
    }, o.timeoutMs);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method: 'GET', headers: o.headers, lookup: o.lookup, agent: false },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = flattenHeaders(res.headers);
        res.on('error', (err) => finish(() => reject(err)));

        // Redirects and header-only probes don't need the body.
        if (!o.readBody || (status >= 300 && status < 400)) {
          res.destroy();
          finish(() => resolve({ status, headers, body: Buffer.alloc(0), truncated: false }));
          return;
        }

        let stream: Readable = res;
        const enc = (headers['content-encoding'] || '').toLowerCase().trim();
        if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc && enc !== 'identity') {
          res.destroy();
          finish(() => reject(new SafeFetchError('The website sent an unsupported response.', 'NETWORK')));
          return;
        }
        if (stream !== res) stream.on('error', (err) => finish(() => reject(err)));

        const chunks: Buffer[] = [];
        let total = 0;
        stream.on('data', (chunk: Buffer) => {
          if (settled) return;
          const remaining = o.maxBytes - total;
          if (chunk.length >= remaining) {
            chunks.push(chunk.subarray(0, remaining));
            total += remaining;
            res.destroy();
            stream.destroy();
            finish(() => resolve({ status, headers, body: Buffer.concat(chunks), truncated: true }));
            return;
          }
          chunks.push(chunk);
          total += chunk.length;
        });
        stream.on('end', () => finish(() => resolve({ status, headers, body: Buffer.concat(chunks), truncated: false })));
      },
    );
    req.on('error', (err) => finish(() => reject(err)));
    req.end();
  });
}

export function createSafeFetch(deps: { isBlockedIp?: (ip: string) => boolean } = {}) {
  const blocked = deps.isBlockedIp ?? isBlockedIp;

  return async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
    const { timeoutMs = 15_000, maxBytes = 2_000_000, maxRedirects = 5, readBody = true } = opts;
    const headers = { 'accept-encoding': 'gzip, deflate, br', ...(opts.headers ?? {}) };
    const deadline = Date.now() + timeoutMs;
    const state = { blocked: false };

    // The address check happens here, inside the socket's DNS lookup, so the
    // connection goes to exactly the addresses that were validated.
    const lookup: LookupFunction = (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 4);
        if (!addresses.length || addresses.some((a) => blocked(a.address))) {
          state.blocked = true;
          return callback(new SafeFetchError(BLOCKED_MESSAGE, 'BLOCKED'), '', 4);
        }
        if (options.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
      });
    };

    let current = checkUrl(input, blocked);
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new SafeFetchError('The website took too long to respond.', 'TIMEOUT');

      let raw: RawResponse;
      try {
        raw = await requestOnce(current, { headers, timeoutMs: remaining, maxBytes, readBody, lookup });
      } catch (err) {
        if (state.blocked) throw new SafeFetchError(BLOCKED_MESSAGE, 'BLOCKED', { cause: err });
        if (err instanceof SafeFetchError) throw err;
        throw new SafeFetchError('Could not reach the website.', 'NETWORK', { cause: err });
      }

      const location = raw.headers['location'];
      if (raw.status >= 300 && raw.status < 400 && location) {
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new SafeFetchError('The website sent an invalid redirect.', 'INVALID');
        }
        current = checkUrl(next, blocked); // re-validate every hop
        continue;
      }

      return {
        ok: raw.status >= 200 && raw.status < 300,
        status: raw.status,
        url: current.toString(),
        headers: raw.headers,
        contentType: raw.headers['content-type'] || '',
        text: raw.body.toString('utf8'),
        truncated: raw.truncated,
      };
    }
    throw new SafeFetchError('The website redirected too many times.', 'REDIRECTS');
  };
}

export const safeFetch = createSafeFetch();
