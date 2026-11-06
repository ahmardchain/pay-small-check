import type { Finding, ParsedInput } from "./types.js";

const SCAM =
  /scam|fraud|419|wahala|rip-?off|no delivery|did(?:n'?t| not) deliver|collected (?:my )?money|took my money|yahoo|fake (?:vendor|seller|shop)|alert\b/i;

export function collectStrings(value: unknown, limit = 40): string[] {
  const out: string[] = [];
  walk(value, out, limit, 0);
  return out;
}

function walk(value: unknown, out: string[], limit: number, depth: number): void {
  if (out.length >= limit || depth > 8 || value == null) return;
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length >= 8 && text.length <= 500) out.push(text.slice(0, 240));
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, out, limit, depth + 1);
      if (out.length >= limit) return;
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) continue;
      walk(item, out, limit, depth + 1);
      if (out.length >= limit) return;
    }
  }
}

function isSecretKey(key: string): boolean {
  const name = key.toLowerCase();
  return (
    name.includes("token") ||
    name.includes("secret") ||
    name.includes("authorization") ||
    name === "commandurl" ||
    name === "statusurl" ||
    name === "poll"
  );
}

export function scamHits(texts: string[], tokens: string[]): { hits: number; excerpts: string[] } {
  const excerpts: string[] = [];
  let hits = 0;
  for (const text of texts) {
    if (!SCAM.test(text)) continue;
    const aboutVendor = tokens.length === 0 || tokens.some((token) => text.toLowerCase().includes(token.toLowerCase()));
    if (!aboutVendor) continue;
    hits += 1;
    if (excerpts.length < 3) excerpts.push(text.slice(0, 180));
  }
  return { hits, excerpts };
}

export function findInstagramCode(value: unknown): string | null {
  const direct = findString(value, ["shortcode", "code"], 0);
  if (direct && /^[A-Za-z0-9_-]{5,30}$/.test(direct)) return direct;
  const texts = collectStrings(value, 80);
  for (const text of texts) {
    const match = text.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]{5,30})/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function findRedditPostId(value: unknown): string | null {
  const texts = collectStrings(value, 80);
  for (const text of texts) {
    const match = text.match(/\bt3_[a-z0-9]{1,17}\b/i);
    if (match?.[0]) return match[0].toLowerCase();
  }
  const id = findString(value, ["post_id", "postId", "id"], 0);
  if (id && /^t3_[a-z0-9]{1,17}$/i.test(id)) return id.toLowerCase();
  return null;
}

export function readCount(value: unknown, keys: string[]): number | null {
  const found = findNumber(value, keys, 0);
  return found;
}

function findString(value: unknown, keys: string[], depth: number): string | null {
  if (depth > 6 || value == null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(key) && typeof item === "string" && item.trim()) return item.trim();
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findString(item, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function findNumber(value: unknown, keys: string[], depth: number): number | null {
  if (depth > 6 || value == null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumber(item, keys, depth + 1);
      if (found != null) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!keys.includes(key)) continue;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item === "string" && /^\d+$/.test(item)) return Number(item);
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findNumber(item, keys, depth + 1);
    if (found != null) return found;
  }
  return null;
}

export function findingFromPayload(
  source: string,
  summary: string,
  payload: unknown,
  tokens: string[],
  present: boolean,
): Finding {
  const texts = collectStrings(payload);
  const scam = scamHits(texts, tokens);
  return {
    source,
    summary,
    excerpts: scam.excerpts,
    scamHits: scam.hits,
    present,
  };
}

export function profileLooksPresent(payload: unknown, username: string): boolean {
  const texts = collectStrings(payload, 20).join(" ").toLowerCase();
  if (!texts) return false;
  if (texts.includes("not found") || texts.includes("user not found")) return false;
  return texts.includes(username.toLowerCase()) || readCount(payload, ["follower_count", "followers", "edge_followed_by"]) != null;
}

export function evidenceForModel(input: ParsedInput, findings: Finding[]): string {
  const lines = [
    "<untrusted-evidence>",
    `instagram: ${input.instagram ?? "none"}`,
    `phone: ${input.phone ?? "none"}`,
    `url: ${input.url ?? "none"}`,
  ];
  for (const finding of findings) {
    lines.push(`source: ${finding.source}`);
    lines.push(`summary: ${finding.summary}`);
    for (const excerpt of finding.excerpts) lines.push(`excerpt: ${excerpt}`);
  }
  lines.push("</untrusted-evidence>");
  return lines.join("\n");
}
