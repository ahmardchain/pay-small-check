import type { ParsedInput } from "./types.js";

const HANDLE = /^[a-z0-9._]{1,30}$/;

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function parseQuery(raw: string): ParsedInput {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) throw new InputError("Paste an Instagram handle, a WhatsApp number, or a shop link.");
  if (text.length > 300) throw new InputError("That is too long. Paste one handle, number, or link.");

  const instagram = readInstagram(text);
  if (instagram) return { raw: text, instagram, phone: null, url: null };

  const phone = readPhone(text);
  if (phone) return { raw: text, instagram: null, phone, url: null };

  const url = readUrl(text);
  if (url) return { raw: text, instagram: null, phone: null, url };

  const bare = text.replace(/^@/, "").toLowerCase();
  if (!text.includes(" ") && HANDLE.test(bare)) {
    return { raw: text, instagram: bare, phone: null, url: null };
  }

  throw new InputError("Use @handle, a phone number such as 0803…, or an http(s) shop link.");
}

function readInstagram(text: string): string | null {
  const at = text.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (at?.[1] && HANDLE.test(at[1].toLowerCase())) return at[1].toLowerCase();
  const url = text.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i,
  );
  if (url?.[1] && HANDLE.test(url[1].toLowerCase())) return url[1].toLowerCase();
  return null;
}

function readPhone(text: string): string | null {
  const wa = text.match(/wa\.me\/(\d{10,15})/i) ?? text.match(/[?&]phone=(\d{10,15})/i);
  const source = wa?.[1] ?? text;
  if (!wa && /[a-z]/i.test(text) && !text.includes("whatsapp")) return null;
  const digits = source.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith("234") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (text.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (!/[a-z]/i.test(text) && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function readUrl(text: string): string | null {
  const withScheme = /^https?:\/\//i.test(text) ? text : text.includes(".") && !text.includes(" ") ? `https://${text}` : "";
  if (!withScheme) return null;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".")) return null;
  if (isBlockedHost(host)) {
    throw new InputError("That address is on a private network. Paste a public shop link.");
  }
  url.hash = "";
  return url.toString();
}

function isBlockedHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return true;
  }
  if (host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

export function vendorTokens(input: ParsedInput): string[] {
  const tokens = new Set<string>();
  if (input.instagram) {
    tokens.add(input.instagram.toLowerCase());
    tokens.add(`@${input.instagram.toLowerCase()}`);
  }
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    tokens.add(digits);
    if (digits.startsWith("234")) tokens.add(`0${digits.slice(3)}`);
  }
  if (input.url) {
    try {
      const host = new URL(input.url).hostname.replace(/^www\./, "").toLowerCase();
      tokens.add(host);
      const label = host.split(".")[0];
      if (label && label.length >= 3) tokens.add(label);
    } catch {
      /* already validated */
    }
  }
  return [...tokens];
}

export function scamSearchQuery(input: ParsedInput): string {
  const label = input.instagram ? `@${input.instagram}` : input.phone ?? input.url ?? input.raw;
  return `${label} (scam OR fraud OR 419 OR wahala)`.slice(0, 500);
}
