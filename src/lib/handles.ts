const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const INSTAGRAM = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

/** Strip a leading @ and reject anything that is not an X handle. */
export function parseHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/^@+/, "");
  if (!HANDLE.test(trimmed)) return null;
  return trimmed;
}

/** Strip a leading @ and reject anything that is not an Instagram username. */
export function parseInstagramHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/^@+/, "");
  if (!INSTAGRAM.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function instagramProfileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

export function profileUrl(handle: string): string {
  return `https://x.com/${handle}`;
}

export function statusUrl(handle: string, id: string): string {
  return `https://x.com/${handle}/status/${id}`;
}
