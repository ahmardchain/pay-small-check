import { profileUrl, statusUrl } from "./handles.js";

export interface AccountFacts {
  handle: string;
  displayName?: string;
  bio?: string;
  createdAt?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  verified?: boolean;
  defaultProfileImage?: boolean;
  location?: string;
  id?: string;
}

export interface PostFacts {
  id?: string;
  handle?: string;
  text: string;
  createdAt?: string;
  likes?: number;
  reposts?: number;
  replies?: number;
  url?: string;
}

export interface ParsedSlice {
  accounts: AccountFacts[];
  posts: PostFacts[];
  /** True when the payload had a recognized list, including an empty one. */
  recognized: boolean;
}

const MAX_NODES = 4000;
const MAX_DEPTH = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function bool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function handleOf(record: Record<string, unknown>): string | undefined {
  const raw = text(record.screen_name) ?? text(record.screenName) ?? text(record.username);
  if (!raw) return undefined;
  return raw.replace(/^@+/, "");
}

function readAccount(record: Record<string, unknown>): AccountFacts | null {
  const handle = handleOf(record);
  const followers = num(record.followers_count) ?? num(record.followersCount) ?? num(record.followers);
  const following = num(record.friends_count) ?? num(record.following_count) ?? num(record.following);
  const postsCount = num(record.statuses_count) ?? num(record.posts_count) ?? num(record.postsCount);
  if (!handle || (followers === undefined && following === undefined && postsCount === undefined)) return null;
  return {
    handle,
    displayName: text(record.name) ?? text(record.display_name),
    bio: text(record.description) ?? text(record.bio),
    createdAt: text(record.created_at) ?? text(record.createdAt),
    followers,
    following,
    postsCount,
    verified: bool(record.verified) ?? bool(record.is_blue_verified) ?? bool(record.isBlueVerified),
    defaultProfileImage: bool(record.default_profile_image) ?? bool(record.defaultProfileImage),
    location: text(record.location),
    id: text(record.rest_id) ?? text(record.id_str) ?? text(record.id),
  };
}

function preferredAuthor(host: Record<string, unknown>): string | undefined {
  const paths = [
    ["core", "user_results", "result", "legacy", "screen_name"],
    ["user", "legacy", "screen_name"],
    ["user", "screen_name"],
    ["author", "userName"],
    ["author", "screen_name"],
  ];
  for (const path of paths) {
    let current: unknown = host;
    for (const key of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    const value = text(current);
    if (value) return value.replace(/^@+/, "");
  }
  return undefined;
}

function nestedAuthor(record: Record<string, unknown>, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  const direct = handleOf(record);
  const followers = num(record.followers_count) ?? num(record.followersCount);
  if (direct && (followers !== undefined || record.screen_name || record.username)) {
    if (record.screen_name || record.username || record.screenName) return direct;
  }
  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const found = nestedAuthor(value, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function readPost(record: Record<string, unknown>, host?: Record<string, unknown>): PostFacts | null {
  const body = text(record.full_text) ?? text(record.text) ?? text(record.fullText);
  if (!body) return null;
  const id = text(record.id_str) ?? text(record.rest_id) ?? (typeof record.id === "string" ? text(record.id) : undefined);
  const author = (host ? preferredAuthor(host) : undefined) ?? nestedAuthor(record);
  return {
    id,
    handle: author,
    text: body.slice(0, 500),
    createdAt: text(record.created_at) ?? text(record.createdAt),
    likes: num(record.favorite_count) ?? num(record.like_count) ?? num(record.likes),
    reposts: num(record.retweet_count) ?? num(record.repost_count) ?? num(record.reposts),
    replies: num(record.reply_count) ?? num(record.replies),
    url: text(record.url) ?? text(record.tweet_url),
  };
}

function looksLikeContainer(record: Record<string, unknown>): boolean {
  return ["tweets", "posts", "results", "users", "followers", "timeline", "instructions", "entries", "data"].some(
    (key) => key in record,
  );
}

/** Walk a provider payload and pull accounts and posts out of whatever shape it has. */
export function parseProviderPayload(output: unknown): ParsedSlice {
  const accounts: AccountFacts[] = [];
  const posts: PostFacts[] = [];
  let recognized = Array.isArray(output);
  const seen = new WeakSet<object>();
  let nodes = 0;

  const visit = (value: unknown, depth: number) => {
    if (value == null || depth > MAX_DEPTH || nodes > MAX_NODES) return;
    if (typeof value === "object") {
      if (seen.has(value)) return;
      seen.add(value);
    }
    nodes += 1;
    if (Array.isArray(value)) {
      recognized = true;
      for (const item of value.slice(0, 80)) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    if (looksLikeContainer(value)) recognized = true;
    const account = readAccount(value);
    if (account) accounts.push(account);
    const postSource = isRecord(value.legacy) ? value.legacy : value;
    const post = readPost(postSource, value);
    if (post) posts.push(post);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };

  visit(unwrapOutput(output), 0);
  return {
    accounts: dedupeAccounts(accounts).slice(0, 40),
    posts: dedupePosts(posts).slice(0, 40),
    recognized: recognized || accounts.length > 0 || posts.length > 0,
  };
}

export function unwrapOutput(body: unknown): unknown {
  if (isRecord(body) && "output" in body) return body.output;
  return body;
}

function dedupeAccounts(accounts: AccountFacts[]): AccountFacts[] {
  const byHandle = new Map<string, AccountFacts>();
  for (const account of accounts) {
    const key = account.handle.toLowerCase();
    const prev = byHandle.get(key);
    if (!prev || scoreAccount(account) > scoreAccount(prev)) byHandle.set(key, account);
  }
  return [...byHandle.values()];
}

function scoreAccount(account: AccountFacts): number {
  return (
    (account.followers !== undefined ? 2 : 0) +
    (account.createdAt ? 2 : 0) +
    (account.bio ? 1 : 0) +
    (account.postsCount !== undefined ? 1 : 0)
  );
}

function dedupePosts(posts: PostFacts[]): PostFacts[] {
  const seen = new Set<string>();
  const unique: PostFacts[] = [];
  for (const post of posts) {
    const key = `${post.id ?? ""}|${post.text.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(post);
  }
  return unique;
}

export function snowflakeDate(id: string | undefined): Date | null {
  if (!id || !/^\d{15,22}$/.test(id)) return null;
  try {
    const ms = Number((BigInt(id) >> 22n) + 1288834974657n);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function parseTime(value: string | undefined, id?: string): Date | null {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return snowflakeDate(id);
}

export function postLink(post: PostFacts, fallbackHandle: string): string | undefined {
  if (post.url && /^https?:\/\//i.test(post.url)) return post.url;
  const handle = post.handle || fallbackHandle;
  if (post.id && /^\d{6,}$/.test(post.id)) return statusUrl(handle, post.id);
  return undefined;
}

export function accountLink(handle: string): string {
  return profileUrl(handle);
}
