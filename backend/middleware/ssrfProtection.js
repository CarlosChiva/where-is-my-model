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

    /* --- Step 2: hard denylist check (always active) ------------- */
    for (const cidr of BLOCKED_RANGES) {
      const [addr, prefix] = cidr.split('/');
      if (parsed.match([ipaddr.parse(addr), Number.parseInt(prefix, 10)])) {
        return { allowed: false, reason: `denied by block range ${cidr}` };
      }
    }

    /* --- Step 3: optional allowlist (deny all unless explicitly   */
    /*              permitted)                                      */
    const allowlist = parseAllowlist();
    if (allowlist) {
      const inAllowlist = allowlist.some(([a, p]) =>
        parsed.match([ipaddr.parse(a), p])
      );
      if (!inAllowlist) {
        return { allowed: false, reason: 'not in HEALTH_CHECK_ALLOWED_NETWORKS' };
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
