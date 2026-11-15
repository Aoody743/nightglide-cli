import type { ProviderLocality } from "@nightglide/core";

/**
 * Extracts the raw host string from an endpoint URL before WHATWG URL normalization.
 * Used to detect alternate IP representations (hex, octal, integer dword) that
 * could cause semantic confusion between URL parsers and HTTP clients.
 */
export function extractRawHost(urlStr: string): string | null {
  try {
    const match = urlStr.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
    if (!match) return null;
    let authority = match[1];

    // Strip userinfo if present
    const atIndex = authority.lastIndexOf("@");
    if (atIndex !== -1) {
      authority = authority.slice(atIndex + 1);
    }

    // Handle IPv6 brackets: e.g. [::1]:8000
    if (authority.startsWith("[")) {
      const closingBracket = authority.indexOf("]");
      if (closingBracket !== -1) {
        return authority.slice(0, closingBracket + 1);
      }
      return authority;
    }

    // Strip port
    const colonIndex = authority.indexOf(":");
    if (colonIndex !== -1) {
      authority = authority.slice(0, colonIndex);
    }

    return authority.trim();
  } catch {
    return null;
  }
}

/**
 * Check whether a raw host string contains alternate IP representations:
 * - Hexadecimal (e.g. 0x7f000001, 0x7f.0.0.1)
 * - Octal (IPv4 octet with leading zero followed by other digits, e.g. 0177.0.0.1, 00.0.0.0)
 * - Integer / Dword (single decimal integer without dots, e.g. 2130706433, 0)
 *
 * Alternate representations are rejected or treated as remote to prevent SSRF
 * and parser inconsistency exploits.
 */
export function hasAlternateRepresentation(rawHost: string | null): boolean {
  if (!rawHost) return false;
  // Hex representation (e.g. 0x7f000001, 0x7f.0.0.1)
  if (/0x[0-9a-fA-F]+/i.test(rawHost)) return true;
  // Octal representation: octet with leading zero followed by other digits (e.g. 0177.0.0.1)
  if (/(^|\.)0[0-9]+(\.|$)/.test(rawHost)) return true;
  // Integer / dword representation (pure digits without dots, e.g. 2130706433 or 0)
  if (/^\d+$/.test(rawHost)) return true;
  return false;
}

/**
 * Determine if a hostname is an IPv4 loopback address in the 127.0.0.0/8 range.
 * Requires strictly 4 decimal octets, each between 0 and 255, starting with 127.
 */
export function isIpv4Loopback(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;

  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) return false;
    // Disallow leading zeros in octet
    if (p.length > 1 && p.startsWith("0")) return false;
    nums.push(n);
  }

  // 127.0.0.0/8 loopback block
  return nums[0] === 127;
}

/**
 * Determine if a hostname is an IPv6 loopback address (::1 or uncompressed variants).
 */
export function isIpv6Loopback(host: string): boolean {
  let clean = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  clean = clean.toLowerCase().trim();

  if (clean === "::1") return true;
  if (clean === "0:0:0:0:0:0:0:1") return true;

  const parts = clean.split(":");
  if (parts.length === 8) {
    return parts.slice(0, 7).every((p) => /^0+$/.test(p)) && /^0*1$/.test(parts[7]);
  }

  return false;
}

/**
 * Validate that an endpoint string is a valid HTTP/HTTPS URL safe for provider registration.
 *
 * Enforces:
 * - Protocol must strictly be http: or https:
 * - Rejects URLs with embedded credentials (userinfo) to prevent credential leakage
 * - Validates host presence and port range (1-65535)
 * - Rejects alternate IP representations (hex, octal, dword)
 */
export function isValidEndpointUrl(endpointUrl: string): boolean {
  try {
    const trimmed = endpointUrl.trim();
    if (!trimmed) return false;

    const url = new URL(trimmed);

    // Protocol must strictly be http: or https:
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // Reject URLs with embedded credentials (userinfo)
    if (url.username || url.password) {
      return false;
    }

    // Hostname must be non-empty
    if (!url.hostname || url.hostname.trim() === "") {
      return false;
    }

    // Check raw host for alternate representations (hex, octal, dword)
    const rawHost = extractRawHost(trimmed);
    if (hasAlternateRepresentation(rawHost)) {
      return false;
    }

    // Port validation if present
    if (url.port) {
      const portNum = Number(url.port);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize an endpoint URL for safe client dispatch.
 *
 * Normalization behavior:
 * - Protocol and hostname lowercased and trimmed.
 * - Server Binding vs Client Destination: In networking, 0.0.0.0 represents INADDR_ANY
 *   (all local interfaces) when a server daemon binds to a port. However, RFC 1122
 *   dictates that 0.0.0.0 is not a valid unicast destination. When a user provides
 *   0.0.0.0 (e.g. copied from local server logs like oMLX or Ollama), Nightglide
 *   preserves compatibility by classifying it as 'local' while safely normalizing
 *   the host to 127.0.0.1 for actual client dispatch.
 * - IPv6 bracket formatting preserved.
 * - Trailing slashes stripped from pathname.
 */
export function normalizeEndpointUrl(endpointUrl: string): string {
  const trimmed = endpointUrl.trim();
  const url = new URL(trimmed);

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }

  let host = url.hostname.toLowerCase().trim();

  // Normalize client destination 0.0.0.0 to 127.0.0.1
  if (host === "0.0.0.0") {
    host = "127.0.0.1";
  }

  const portPart = url.port ? `:${url.port}` : "";
  const pathPart = url.pathname.replace(/\/+$/, "");

  let normalized = `${protocol}//${host}${portPart}${pathPart}`;
  if (url.search) {
    normalized += url.search;
  }
  return normalized;
}

/**
 * Sanitize a URL for display and logging, masking embedded credentials and tokens.
 */
export function sanitizeUrlForDisplay(urlStr: string): string {
  try {
    let sanitized = urlStr.replace(/:\/\/([^/@:]+)(?::([^/@]+))?@/, "://***:***@");
    sanitized = sanitized.replace(/([?&](?:api_?[kK]ey|token|secret|auth|password)=)[^&]+/gi, "$1***");
    return sanitized;
  } catch {
    return urlStr;
  }
}

/**
 * Mask any occurrences of secrets in an arbitrary text or error message.
 */
export function sanitizeSecrets(text: string, secrets: (string | undefined)[]): string {
  let result = text;
  for (const s of secrets) {
    if (s && s.trim().length > 0) {
      result = result.replaceAll(s, "***");
    }
  }
  // Also mask potential embedded URL credentials or key patterns
  result = result.replace(/:\/\/([^/@:]+)(?::([^/@]+))?@/g, "://***:***@");
  result = result.replace(/([?&](?:api_?[kK]ey|token|secret|auth|password)=)[^&]+/gi, "$1***");
  return result;
}

/**
 * Safely format an API key for diagnostic display without leaking raw secrets.
 */
export function maskApiKey(key: string | undefined): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 3)}••••••••${trimmed.slice(-4)}`;
}

/**
 * Determine physical network locality based on the resolved network endpoint.
 *
 * Strict Classification Rules:
 * - Local Loopback: 'localhost', '127.0.0.1', '127.0.0.0/8', '::1', '[::1]', and '0.0.0.0'
 *   (Server bind address treated as local developer target).
 * - Remote:
 *   - Private LAN addresses: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *   - Link-local addresses: 169.254.0.0/16, fe80::/10
 *   - Public IPv4 / IPv6 addresses
 *   - Public domains and subdomains (e.g. api.openai.com, 127.example.com)
 *   - Alternate representations (hex/octal/dword)
 *   - Malformed URLs or URLs with embedded credentials (fail-closed to 'remote')
 */
export function resolveEndpointLocality(endpointUrl: string): ProviderLocality {
  try {
    const trimmed = endpointUrl.trim();
    if (!trimmed) return "remote";

    const url = new URL(trimmed);

    // Fail-closed for non-HTTP protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "remote";
    }

    // Fail-closed for URLs with embedded credentials
    if (url.username || url.password) {
      return "remote";
    }

    // Fail-closed for alternate IP representations
    const rawHost = extractRawHost(trimmed);
    if (hasAlternateRepresentation(rawHost)) {
      return "remote";
    }

    let hostname = url.hostname.toLowerCase().trim();
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      hostname = hostname.slice(1, -1);
    }

    // Named loopback
    if (hostname === "localhost") {
      return "local";
    }

    // Server binding address 0.0.0.0
    if (hostname === "0.0.0.0") {
      return "local";
    }

    // IPv6 loopback
    if (isIpv6Loopback(hostname)) {
      return "local";
    }

    // IPv4 loopback (127.0.0.0/8)
    if (isIpv4Loopback(hostname)) {
      return "local";
    }

    // All other addresses (LAN, link-local, public IPs, external domains) are remote
    return "remote";
  } catch {
    // Fail-closed to remote on any error or malformed input
    return "remote";
  }
}
