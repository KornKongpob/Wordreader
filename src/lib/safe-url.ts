import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_URL_LENGTH = 2048;

const privateIpv4BlockList = new BlockList();
const privateIpv6BlockList = new BlockList();

([
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] satisfies Array<[string, number]>).forEach(([address, prefix]) => {
  privateIpv4BlockList.addSubnet(address, prefix, "ipv4");
});

([
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] satisfies Array<[string, number]>).forEach(([address, prefix]) => {
  privateIpv6BlockList.addSubnet(address, prefix, "ipv6");
});

export type SafeArticleUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function normalizeAddress(address: string) {
  return address.startsWith("[") && address.endsWith("]")
    ? address.slice(1, -1)
    : address;
}

function isBlockedHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "local" ||
    normalized.endsWith(".local")
  );
}

function isPrivateOrReservedAddress(address: string) {
  const normalized = normalizeAddress(address);
  const family = isIP(normalized);

  if (family === 4) {
    return privateIpv4BlockList.check(normalized, "ipv4");
  }

  if (family === 6) {
    return privateIpv6BlockList.check(normalized, "ipv6");
  }

  return false;
}

export async function validatePublicArticleUrl(
  input: string
): Promise<SafeArticleUrlResult> {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: "Please provide a valid URL." };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That article URL is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Please use a public article URL that starts with http or https.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "Please use an article URL without embedded credentials.",
    };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: "Please use a public article URL." };
  }

  const directAddress = normalizeAddress(hostname);
  if (isIP(directAddress)) {
    return isPrivateOrReservedAddress(directAddress)
      ? { ok: false, error: "Please use a public article URL." }
      : { ok: true, url: parsed.toString() };
  }

  let addresses: Array<{ address: string }> = [];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return {
      ok: false,
      error: "Could not verify this article URL. Try another public URL.",
    };
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      error: "Could not verify this article URL. Try another public URL.",
    };
  }

  if (addresses.some((entry) => isPrivateOrReservedAddress(entry.address))) {
    return { ok: false, error: "Please use a public article URL." };
  }

  return { ok: true, url: parsed.toString() };
}
