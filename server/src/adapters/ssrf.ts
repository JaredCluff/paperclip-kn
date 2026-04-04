import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DNS_TIMEOUT_MS = 5_000;

/**
 * Check if an IP address is in a private/reserved range (RFC 1918, loopback,
 * link-local, etc.) that should never be reachable via user-supplied URLs.
 *
 * Handles IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1) which Node's
 * dns.lookup may return depending on OS configuration.
 */
export function isPrivateIP(ip: string): boolean {
  const lower = ip.toLowerCase();

  // Unwrap IPv4-mapped IPv6 addresses (::ffff:x.x.x.x) and re-check as IPv4
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedMatch && v4MappedMatch[1]) return isPrivateIP(v4MappedMatch[1]);

  // IPv4 patterns
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1]!, 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("127.")) return true;                   // loopback
  if (ip.startsWith("169.254.")) return true;               // link-local
  if (ip === "0.0.0.0") return true;

  // IPv6 patterns
  if (lower === "::1") return true;                          // loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true;                 // link-local
  if (lower === "::") return true;

  return false;
}

/**
 * Assert that a URL is safe to fetch (not an SSRF target).
 *
 * Validates the URL syntax, enforces an http/https protocol whitelist, resolves
 * the hostname via DNS, and rejects the request if all resolved IPs fall within
 * private/reserved ranges.  IP literals in the URL are checked directly without
 * a DNS round-trip.
 *
 * @throws {Error} If the URL is invalid, uses a disallowed protocol, the DNS
 *   lookup times out, or all resolved addresses are private/reserved.
 */
export async function assertNotSsrfTarget(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Disallowed protocol "${parsed.protocol}"`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // If hostname is already an IP literal, check it directly without DNS lookup
  if (isIP(hostname) !== 0) {
    if (isPrivateIP(hostname)) {
      throw new Error(`URL resolves to a private/reserved IP address`);
    }
    return;
  }

  // Resolve hostname and validate all IPs
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`DNS lookup timed out for ${hostname}`)),
      DNS_TIMEOUT_MS,
    );
  });

  let results: Awaited<ReturnType<typeof dnsLookup>>;
  try {
    results = await Promise.race([
      dnsLookup(hostname, { all: true }),
      timeoutPromise,
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("DNS lookup timed out")) throw err;
    throw new Error(`DNS resolution failed for ${hostname}: ${(err as Error).message}`);
  }

  if (results.length === 0) {
    throw new Error(`DNS resolution returned no results for ${hostname}`);
  }

  const safeIPs = results.filter((r) => !isPrivateIP(r.address));
  if (safeIPs.length === 0) {
    throw new Error(`All resolved IPs for ${hostname} are in private/reserved ranges`);
  }
}
