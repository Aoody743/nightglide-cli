import type { ProviderLocality } from "@nightglide/core";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
]);

/**
 * Determine physical network locality based on the resolved network endpoint.
 * Enforces strict security: any endpoint not on loopback is classified as "remote",
 * regardless of display names or labels.
 */
export function resolveEndpointLocality(endpointUrl: string): ProviderLocality {
  try {
    const url = new URL(endpointUrl);
    const hostname = url.hostname.toLowerCase().trim();

    if (LOCAL_HOSTNAMES.has(hostname)) {
      return "local";
    }

    // IP address loopback range (127.0.0.0/8)
    if (hostname.startsWith("127.")) {
      return "local";
    }

    return "remote";
  } catch {
    // If URL is invalid, fail-safe to remote
    return "remote";
  }
}

/**
 * Validate that an endpoint string is a valid HTTP/HTTPS URL.
 */
export function isValidEndpointUrl(endpointUrl: string): boolean {
  try {
    const url = new URL(endpointUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
