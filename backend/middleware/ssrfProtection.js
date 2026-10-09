import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  SSRF — Server-Side Request Forgery protection                    */
/*  Resolve hostname, validate IP against denylist and optional      */
/*  allowlist, protect against DNS rebinding.                        */
/*  No external HTTP dependencies; uses Node built-in dns/promises   */
/*  and ipaddr.js for CIDR arithmetic.                               */
/* ------------------------------------------------------------------ */

/* --- Internal: IPv4 ranges permanently blocked ------------------- */

const BLOCKED_RANGES = [
  /* Loopback           — RFC 1122 (entire 127/8 prefix)            */
  '127.0.0.0/8',
  /* Private Class A    — RFC 1918                                  */
  '10.0.0.0/8',
  /* Private Class B    — RFC 1918                                  */
  '172.16.0.0/12',
  /* Private Class C    — RFC 1918                                  */
  '192.168.0.0/16',
  /* Link-local         — RFC 3927                                  */
  '169.254.0.0/16',
  /* Documentation      — RFC 5737                                 */
  '192.0.2.0/24',
  '198.51.100.0/24',
  '203.0.113.0/24',
  /* IETF Protocol Assignments — RFC 5736                           */
  '192.0.0.0/29',
  /* Carrier-grade NAT  — RFC 6598                                 */
  '100.64.0.0/10',
  /* Reserved           — RFC 6890 (various)                       */
  '0.0.0.0/8',
  '240.0.0.0/4',    /* Class E / reserved                           */
  '255.255.255.255/32', /* Broadcast                                */
];

/* --- Parse CIDR strings from comma-separated env var ------------- */

/**
 * Parse `HEALTH_CHECK_ALLOWED_NETWORKS` into an ipaddr.js-managed list
 * of [ip, prefixLength] tuples.  Returns null when the env var is empty
 * or unset (meaning allowlist is inactive and only the denylist applies).
 *
 * @returns {Array<[string, number]> | null}
 */
function parseAllowlist() {
  const raw = process.env.HEALTH_CHECK_ALLOWED_NETWORKS;
  if (!raw || raw.trim() === '') {
    return null;
  }

  /* Cache the parsed list at module-scope (hoisted once per process). */
  if (!parseAllowlist._cached) {
    parseAllowlist._cached = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((cidr) => {
        const [addr, prefixStr] = cidr.split('/');
        try {
          ipaddr.parse(addr); // validates addr is valid IPv4 or IPv6
          return [addr, Number.parseInt(prefixStr, 10)];
        } catch {
          logger.warn('[ssrf] invalid CIDR in allowlist: "%s" — skipping', cidr);
          return null;
        }
      })
      .filter(Boolean);
  }

  /* Return empty array → effectively "allow nothing"                */
  return parseAllowlist._cached.length === 0 ? null : parseAllowlist._cached;
}

/* --- Core: single-shot IP validation ----------------------------- */

/**
 * Validate that an IP address string is safe to connect to.
 * When HEALTH_CHECK_ALLOWED_NETWORKS is configured, an IP present in
 * the allowlist is permitted outright (bypassing the denylist, even
 * for private ranges); every other IP is checked against the denylist.
 *
 * @param {string} ip — dotted-decimal IPv4 or colon-separated IPv6
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function validateIp(ip) {
  try {
    let parsed = ipaddr.parse(ip);

    /* --- Step 1: normalize to IPv4 when mapping is safe ----------- */
    if (parsed.kind() === 'ipv6') {
      const mapped = parsed.toIPv4Fallback();
      if (mapped) {
        parsed = ipaddr.parse(mapped);
      }
    }

    /* --- Step 2: optional allowlist (explicit bypass of denylist) */
    /*  Active only when HEALTH_CHECK_ALLOWED_NETWORKS is set. An IP */
    /*  that belongs to any listed network is permitted outright —  */
    /*  the denylist is skipped, even for private ranges.          */
    const allowlist = parseAllowlist();
    if (allowlist) {
      const inAllowlist = allowlist.some(([a, p]) =>
        parsed.match([ipaddr.parse(a), p])
      );
      if (inAllowlist) {
        return { allowed: true };
      }
    }

    /* --- Step 3: hard denylist check (non-allowlisted IPs only)  */
    for (const cidr of BLOCKED_RANGES) {
      const [addr, prefix] = cidr.split('/');
      if (parsed.match([ipaddr.parse(addr), Number.parseInt(prefix, 10)])) {
        return { allowed: false, reason: `denied by block range ${cidr}` };
      }
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: `unparseable IP address: ${ip}` };
  }
}

/* --- Public: resolve + validate with DNS-rebinding protection ---- */

/**
 * Resolve a hostname to an IP and immediately validate it.
 * Caller must invoke this function directly before opening the socket
 * or fetching, so that re-resolution happens fresh every time (DNS
 * rebinding mitigation).
 *
 * @param {string} host — hostname or literal IP address
 * @returns {Promise<{ allowed: boolean, ip?: string, reason?: string }>}
 */
export async function resolveAndValidate(host) {
  if (!host || host.trim() === '') {
    return { allowed: false, reason: 'empty host' };
  }

  try {
    /* Use dns.lookup which returns the single IP the system would   */
    /* connect to. family=0 → prefer dual-stack (default).           */
    const result = await dns.lookup(host, { all: false });
    const ip = result.address;

    const validation = validateIp(ip);

    if (!validation.allowed) {
      logger.warn(
        '[ssrf] BLOCKED host="%s" resolved_ip="%s" reason="%s"', host, ip, validation.reason
      );
    } else {
      logger.debug('[ssrf] OK     host="%s" → "%s"', host, ip);
    }

    return { allowed: validation.allowed, ip, reason: validation.reason };
  } catch (err) {
    const code = err.code ?? 'DNS_UNKNOWN';
    logger.warn(
      '[ssrf] DNS FAIL host="%s" error="%s — %s"', host, code, err.message
    );
    return { allowed: false, reason: `dns resolution failed: ${code}` };
  }
}

/* ------------------------------------------------------------------ */
/*  DNS resolver SSRF protection — kill-switch for private resolvers  */
/* ------------------------------------------------------------------ */

/* --- Internal: ranges that are ALWAYS blocked for DNS resolvers --- */
/*  (subset of BLOCKED_RANGES relevant to resolver entries)          */

const RESOLVER_BLOCKED_RANGES = [
  /* Loopback           — RFC 1122                                  */
  '127.0.0.0/8',
  /* Link-local         — RFC 3927                                  */
  '169.254.0.0/16',
  /* Multicast          — RFC 5771                                  */
  '224.0.0.0/4',
  /* Broadcast                                           */
  '255.255.255.255/32',
  /* This-network       — RFC 1122                              */
  '0.0.0.0/8',
  /* IPv6 loopback                                  */
  '::1/128',
  /* IPv6 link-local        — RFC 4862                              */
  'fe80::/10',
  /* IPv6 multicast                                  */
  'ff00::/8',
  /* IPv6 unspecified                                 */
  '::/128',
];

/* --- Internal: private ranges conditionally blocked --------------- */
/*  Controlled by DNS_CHECK_ALLOW_PRIVATE_RESOLVERS env var.          */

const RESOLVER_PRIVATE_RANGES = [
  /* Private Class A    — RFC 1918                              */
  '10.0.0.0/8',
  /* Private Class B    — RFC 1918                              */
  '172.16.0.0/12',
  /* Private Class C    — RFC 1918                              */
  '192.168.0.0/16',
  /* IPv6 ULA           — RFC 4193                              */
  'fc00::/7',
];

/* --- Helper: read kill-switch env var (no cache) ------------------ */

/**
 * Returns true when private-LAN resolvers should be blocked.
 * Reads the env var on every call (no caching) so that tests or
 * runtime toggles take effect immediately.
 *
 * @returns {boolean}
 */
function isPrivateResolversBlocked() {
  const raw = (process.env.DNS_CHECK_ALLOW_PRIVATE_RESOLVERS ?? '').trim().toLowerCase();
  return raw === 'false' || raw === '0' || raw === 'no';
}

/* --- Helper: validate a single resolver IP ------------------------- */

/**
 * Validate a single IP address for use as a DNS resolver entry.
 * Does NOT consult HEALTH_CHECK_ALLOWED_NETWORKS (parseAllowlist).
 *
 * @param {string} ip — dotted-decimal IPv4 or colon-separated IPv6
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateResolverIp(ip) {
  try {
    let parsed = ipaddr.parse(ip);

    /* Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) to IPv4   */
    if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }

    /* Hard block ranges — always active                            */
    for (const cidr of RESOLVER_BLOCKED_RANGES) {
      const [addr, prefix] = cidr.split('/');
      const range = ipaddr.parse(addr);
      if (range.kind() !== parsed.kind()) continue;
      if (parsed.match([range, Number.parseInt(prefix, 10)])) {
        return { allowed: false, reason: `denied by resolver block range ${cidr}` };
      }
    }

    /* Private ranges — conditional on DNS_CHECK_ALLOW_PRIVATE_RESOLVERS */
    if (isPrivateResolversBlocked()) {
      for (const cidr of RESOLVER_PRIVATE_RANGES) {
        const [addr, prefix] = cidr.split('/');
        const range = ipaddr.parse(addr);
        if (range.kind() !== parsed.kind()) continue;
        if (parsed.match([range, Number.parseInt(prefix, 10)])) {
          return {
            allowed: false,
            reason: `private resolver ${cidr} blocked (DNS_CHECK_ALLOW_PRIVATE_RESOLVERS=false)`,
          };
        }
      }
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: `unparseable IP address: ${ip}` };
  }
}

/* --- Public: resolve + validate a DNS resolver entry -------------- */

/**
 * Validate a DNS resolver host (hostname or literal IP).
 * When a hostname is given, it is resolved fresh via dns.lookup
 * (DNS-rebinding mitigation) and the resolved IP is validated.
 *
 * @param {string} host — hostname or literal IP address
 * @returns {Promise<{ allowed: boolean, ip?: string, reason?: string }>}
 */
export async function validateDnsResolver(host) {
  if (!host || host.trim() === '') {
    return { allowed: false, reason: 'empty host' };
  }

  let ip;
  try {
    /* Literal IP detection */
    ipaddr.parse(host);
    ip = host;
  } catch {
    /* Hostname path — resolve fresh */
    try {
      const result = await dns.lookup(host, { all: false });
      ip = result.address;
    } catch (err) {
      const code = err.code ?? 'DNS_UNKNOWN';
      logger.warn(
        '[ssrf] DNS FAIL resolver="%s" error="%s — %s"', host, code, err.message
      );
      return { allowed: false, reason: `dns resolution failed: ${code}` };
    }
  }

  const validation = validateResolverIp(ip);

  if (!validation.allowed) {
    logger.warn(
      '[ssrf] BLOCKED resolver="%s" resolved_ip="%s" reason="%s"',
      host, ip, validation.reason
    );
  } else {
    logger.debug('[ssrf] OK resolver="%s" → "%s"', host, ip);
  }

  return { allowed: validation.allowed, ip, reason: validation.reason };
}
